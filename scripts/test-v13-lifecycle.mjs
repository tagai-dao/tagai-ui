import {test,beforeEach,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-lifecycle-'))
await build({entryPoints:['src/utils/v13/lifecycle.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'life.cjs'),logLevel:'silent',plugins:[{name:'wallet-fixture',setup(b){
 b.onResolve({filter:/^@\/(utils\/wallets|stores\/(web3|chain)|config\/chains)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
 export const getReadOnlyClient=()=>globalThis.__life.client;
 export const getWalletClient=()=>globalThis.__life.wallet;
 export const setup=async()=>{};
 export const useAccountStore=()=>globalThis.__life.account;
 export const useChainStore=()=>globalThis.__life.chain;
 export const getChainDeployment=()=>({contracts:{pump13:'0x2222222222222222222222222222222222222222'}});`,loader:'js'}))
}}]})
const life=createRequire(import.meta.url)(join(dir,'life.cjs'))
const token='0x1111111111111111111111111111111111111111',user='0x3333333333333333333333333333333333333333'
let calls,submitted,receiptStatus
beforeEach(()=>{
 calls=[];submitted=[];receiptStatus='success'
 globalThis.__life={account:{ethConnectAddress:user,getWalletType:'privy'},chain:{activeChainId:56},wallet:{writeContract:async r=>{submitted.push(r);return '0x'+'ab'.repeat(32)}},client:{
  getBlockNumber:async()=>100n,
  multicall:async p=>{calls.push(p);return [false,false,100n,0n,[100n,8000n],user,token,token]},
  readContract:async p=>{calls.push(p);return 50n},
  simulateContract:async p=>({request:p}),
  waitForTransactionReceipt:async()=>({status:receiptStatus}),
 }}
})
after(async()=>{delete globalThis.__life;await rm(dir,{recursive:true,force:true})})
test('curve quote pins dynamic anti-snipe fees and supply to one block',async()=>{
 const q=await life.quoteCurve(token,true,10000n)
 assert.equal(q.amountOut,50n)
 assert.deepEqual(calls[1].args,[100n,1900n]);assert.equal(calls[1].blockNumber,100n)
})
test('sell reads after-fee price and refuses more than curve supply',async()=>{
 await life.quoteCurve(token,false,50n);assert.equal(calls[1].functionName,'getSellPriceAfterFee')
 await assert.rejects(life.quoteCurve(token,false,101n),/INVALID_AMOUNT/)
})
test('pending listing prevents a tradable quote',async()=>{
 globalThis.__life.client.multicall=async()=>[false,true,100n,0n,[100n,100n],user,token,token]
 await assert.rejects(life.quoteCurve(token,true,1000n),/LISTING_PENDING/)
})
test('reverted trade never returns a success hash',async()=>{
 const q=await life.quoteCurve(token,true,10000n);receiptStatus='reverted'
 await assert.rejects(life.executeCurve(q,user,100),/TRANSACTION_FAILED/)
})
test('expired quote and chain changes cannot submit a transaction',async()=>{
 const q=await life.quoteCurve(token,true,10000n)
 await assert.rejects(life.executeCurve({...q,quotedAt:Date.now()-31000},user,100),/QUOTE_EXPIRED/)
 globalThis.__life.chain.activeChainId=4663
 await assert.rejects(life.executeCurve(q,user,100),/QUOTE_EXPIRED/)
 assert.equal(submitted.length,0)
})
test('account change during simulation cannot submit with another wallet',async()=>{
 const q=await life.quoteCurve(token,true,10000n)
 globalThis.__life.client.simulateContract=async p=>{globalThis.__life.account.ethConnectAddress=token;return{request:p}}
 await assert.rejects(life.executeCurve(q,user,100),/QUOTE_EXPIRED/);assert.equal(submitted.length,0)
})
test('zero slippage still enforces a minimum in Token13 and passes subject',async()=>{
 const q=await life.quoteCurve(token,true,10000n)
 await life.executeCurve(q,user,0)
 const [expected,subject,bps]=submitted[0].args
 assert.equal(subject,user);assert.equal(bps,1);assert.ok(expected*9999n/10000n>=q.amountOut)
})
