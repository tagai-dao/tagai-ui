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
 export const getPreparedWalletClient=async()=>globalThis.__life.wallet;
 export const setup=async()=>{};
 export const useAccountStore=()=>globalThis.__life.account;
 export const useChainStore=()=>globalThis.__life.chain;
 export const getChainDeployment=()=>({contracts:{pump13:'0x2222222222222222222222222222222222222222',pump14:'0xcd4e721Fc418f4D723C04c71e8d8EcCb75C3CD34',pump15:'0x97f35B4631F4FFBF8050B17fAd6579D6F60A289D',handleRegistry15:'0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F'}});`,loader:'js'}))
}}]})
const life=createRequire(import.meta.url)(join(dir,'life.cjs'))
const token='0x1111111111111111111111111111111111111111',user='0x3333333333333333333333333333333333333333'
let calls,submitted,receiptStatus
beforeEach(()=>{
 calls=[];submitted=[];receiptStatus='success'
 globalThis.__life={account:{ethConnectAddress:user,getWalletType:'privy'},chain:{activeChainId:56},wallet:{writeContract:async r=>{submitted.push(r);return '0x'+'ab'.repeat(32)}},client:{
  getBlockNumber:async()=>100n,
  multicall:async p=>{calls.push(p);return p.contracts[0].functionName==='listed' ? [false,false,100n,0n,[100n,8000n],user,token,token] : p.contracts.map(c=>c.functionName==='handleOf' ? (globalThis.__life.handle ?? 'registered') : 50n)},
  readContract:async p=>{calls.push(p);return 50n},
  simulateContract:async p=>({request:p}),
  waitForTransactionReceipt:async()=>({status:receiptStatus}),
 }}
})
after(async()=>{delete globalThis.__life;await rm(dir,{recursive:true,force:true})})
test('curve quote pins dynamic anti-snipe fees and supply to one block',async()=>{
 const q=await life.quoteCurve(token,true,10000n)
 assert.equal(q.amountOut,50n)
 assert.deepEqual(calls[1].contracts[0].args,[100n,1900n]);assert.equal(calls[1].blockNumber,100n)
})
test('sell reads after-fee price and refuses more than curve supply',async()=>{
 await life.quoteCurve(token,false,50n);assert.equal(calls[1].contracts[0].functionName,'getSellPriceAfterFee')
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
test('V14 reuses token lifecycle but quotes its own Pump and preserves the post attribution in the buy',async()=>{
 const q=await life.quoteCurve(token,true,10000n,14)
 assert.equal(calls[1].contracts[0].address.toLowerCase(),'0xcd4e721fc418f4d723c04c71e8d8eccb75c3cd34')
 const dataSuffix='0x7461676169746331'+'ab'.repeat(32)
 await life.executeCurve(q,user,100,dataSuffix)
 assert.equal(submitted[0].dataSuffix,dataSuffix)
})

test('V15 quotes its own Pump and the actual buyer handle at the same fixed block',async()=>{
 const q=await life.quoteCurve(token,true,10000n,15)
 assert.equal(q.version,15);assert.equal(q.buyer,user)
 assert.equal(calls.length,2)
 assert.equal(calls[0].blockNumber,100n);assert.equal(calls[1].blockNumber,100n)
 assert.equal(calls[1].allowFailure,false)
 assert.equal(calls[1].contracts[0].address,'0x97f35B4631F4FFBF8050B17fAd6579D6F60A289D')
 assert.equal(calls[1].contracts[1].address,'0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F')
 assert.equal(calls[1].contracts[1].functionName,'handleOf');assert.deepEqual(calls[1].contracts[1].args,[user])
 await life.executeCurve(q,user,100);assert.equal(submitted[0].abi.some(x=>x.type==='error'&&x.name==='HandleNotRegistered'),true)
})
test('V15 unregistered creators have no exemption on a later curve buy; sell stays available',async()=>{
 globalThis.__life.handle=''
 await assert.rejects(life.quoteCurve(token,true,10000n,15),/V15_HANDLE_NOT_REGISTERED/)
 assert.equal(submitted.length,0)
 const q=await life.quoteCurve(token,false,50n,15);assert.equal(q.amountOut,50n)
 await life.executeCurve(q,user,100);assert.equal(submitted[0].functionName,'sellToken')
})
test('V15 accepts any nonempty handle without format validation',async()=>{
 for(const handle of [' ', 'x','not a formatted handle!']){globalThis.__life.handle=handle;assert.equal((await life.quoteCurve(token,true,10000n,15)).amountOut,50n)}
})
test('V15 cannot execute another wallet eligibility quote after an account switch',async()=>{
 const q=await life.quoteCurve(token,true,10000n,15);globalThis.__life.account.ethConnectAddress=token
 await assert.rejects(life.executeCurve(q,user,100),/QUOTE_EXPIRED/);assert.equal(submitted.length,0)
})
