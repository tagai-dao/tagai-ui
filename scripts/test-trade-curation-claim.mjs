import {test,after,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'tc-claim-'))
await build({entryPoints:['src/utils/tradeCurationClaim.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'claim.cjs'),logLevel:'silent',plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/(utils\/wallets|config\/chains|stores\/chain|stores\/web3|utils\/contract)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const useChainStore=()=>globalThis.__claim.chain;export const useAccountStore=()=>globalThis.__claim.account;export const getChainDeployment=()=>globalThis.__claim.deployment;export const getReadOnlyClient=()=>globalThis.__claim.client;export const writeContract=(...a)=>globalThis.__claim.write(...a);`,loader:'js'}))
}}]})
const {claimTradeReward}=createRequire(import.meta.url)(join(dir,'claim.cjs'))
const addr=n=>'0x'+n.repeat(40),pool=addr('1'),token=addr('2'),recipient=addr('3'),factory=addr('4'),community=addr('5'),committee=addr('6'),multicall='0xcA11bde05977b3631167028862bE2a173976CA11'
const order={pool,token,recipient,orderId:'123',amountRaw:'999999999999999999999999',deadline:1234567890,signature:'0x'+'a'.repeat(130),chainId:4663}
let reads,writes
beforeEach(()=>{
 reads=[];writes=[]
 globalThis.__claim={chain:{activeChainId:4663},account:{ethConnectAddress:recipient},deployment:{contracts:{tradeCurationFactory:factory},multiConfig:{multicallAddress:multicall}},client:{getBlockNumber:async()=>85000000,multicall:async r=>{
  reads.push(r);assert.equal(r.multicallAddress,multicall);assert.equal(r.blockNumber,85000000);assert.equal(r.batchSize,0);assert.equal(r.allowFailure,false)
  return r.contracts.map(c=>({factory,community,getCommunityToken:token,getCommittee:committee,getPoolOperationFee:77n}[c.functionName]))
 }},write:async r=>{r.beforeWrite();writes.push(r);return '0xhash'}}
})
after(async()=>{delete globalThis.__claim;await rm(dir,{recursive:true,force:true})})
test('RH claim batches three dependency stages at a fixed block and pays the exact on-chain operation fee',async()=>{
 assert.equal(await claimTradeReward(order,4663),'0xhash')
 assert.deepEqual(reads.map(r=>r.contracts.map(c=>[c.address,c.functionName])),[[[pool,'factory'],[pool,'community']],[[community,'getCommunityToken'],[community,'getCommittee']],[[committee,'getPoolOperationFee']]])
 assert.equal(writes[0].value,77n);assert.equal(writes[0].address,pool);assert.equal(writes[0].args[1],BigInt(order.amountRaw))
})
test('foreign factory, failed read, wallet or chain switch before submission cannot write',async()=>{
 globalThis.__claim.deployment.contracts.tradeCurationFactory=token
 await assert.rejects(claimTradeReward(order,4663),/POOL_CONFIGURATION/);assert.equal(writes.length,0)
 globalThis.__claim.deployment.contracts.tradeCurationFactory=factory
 globalThis.__claim.client.multicall=async()=>{throw Error('RPC_DOWN')}
 await assert.rejects(claimTradeReward(order,4663),/RPC_DOWN/);assert.equal(writes.length,0)
 globalThis.__claim.chain.activeChainId=56
 await assert.rejects(claimTradeReward(order,4663),/WALLET_CHANGED/)
})
test('wallet prompt guard rechecks captured context even after fee reads succeed',async()=>{
 globalThis.__claim.write=async r=>{globalThis.__claim.chain.activeChainId=56;r.beforeWrite();assert.fail('write forbidden')}
 await assert.rejects(claimTradeReward(order,4663),/WALLET_CHANGED/);assert.equal(writes.length,0)
})
