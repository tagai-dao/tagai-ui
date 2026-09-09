import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-claim-all-'))
const addr=n=>`0x${n.toString(16).padStart(40,'0')}`
const token=addr(1),community=addr(2),committee=addr(3),user=addr(4)
const components=[0,1,2,3].map(i=>({asset:addr(10+i),pair:addr(20+i),staking_pool:addr(30+i),position:i}))
await build({entryPoints:['src/utils/v13/pools.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'pools.cjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^@\//},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export const getChainDeployment=()=>({contracts:{}});
 export const getReadOnlyClient=()=>globalThis.__claimAll.client;
 export const getWalletClient=()=>globalThis.__claimAll.wallet;
 export const useAccountStore=()=>({ethConnectAddress:globalThis.__claimAll.account,getWalletType:'privy'});
 export const useChainStore=()=>({activeChainId:56});
 export const setup=async()=>{};export const get=async()=>{};export const API_BASE_URL='';
 `}))
}}]})
const {claimAllPoolRewards}=createRequire(import.meta.url)(join(dir,'pools.cjs'))
function fixture(pending=[1n,0n,2n,3n]){
 const f={account:user,calls:[],writes:0,mismatch:false,changeWallet:false,fail:false}
 f.client={multicall:async({allowFailure,contracts})=>{
  assert.equal(allowFailure,false);if(f.fail)throw Error('RPC failed');if(f.changeWallet)f.account=addr(999)
  return contracts.map(({functionName,args,address})=>{
   const i=functionName==='componentAt'?Number(args[0]):components.findIndex(c=>c.staking_pool===(functionName==='getPoolPendingRewards'?args[0]:address))
   const c=components[i]
   if(functionName==='componentAt')return [c.asset,2500n,c.pair]
   if(functionName==='stakeToken')return f.mismatch?addr(999):c.pair
   if(functionName==='community')return community
   assert.equal(args[1],user);return pending[i]
  })
 },readContract:async({functionName})=>functionName==='getCommittee'?committee:500000000000000n,
 simulateContract:async request=>{f.calls.push(request);return {request}},
 waitForTransactionReceipt:async()=>({status:'success'})}
 f.wallet={writeContract:async()=>{f.writes++;return '0xhash'}}
 globalThis.__claimAll=f;return f
}
after(async()=>{delete globalThis.__claimAll;await rm(dir,{recursive:true,force:true})})
test('claims eligible pools once with a single fee; skips empty rewards and duplicate pools',async()=>{
 const f=fixture();assert.equal(await claimAllPoolRewards(token,community,[...components,components[0]]),'0xhash')
 assert.equal(f.writes,1);assert.equal(f.calls.length,1)
 assert.deepEqual(f.calls[0].args,[[components[0].staking_pool,components[2].staking_pool,components[3].staking_pool]])
 assert.equal(f.calls[0].value,500000000000000n);assert.equal(f.calls[0].address,community);assert.equal(f.calls[0].functionName,'withdrawPoolsRewards');assert.equal(f.calls[0].account,user)
})
test('no rewards means no wallet transaction or fee',async()=>{
 const f=fixture([0n,0n,0n,0n]);assert.equal(await claimAllPoolRewards(token,community,components),null);assert.equal(f.writes,0)
})
for(const [flag,message] of [['mismatch',/V13_POOL_MISMATCH/],['changeWallet',/Wallet or chain changed/],['fail',/RPC failed/]])test(`${flag} stops submission`,async()=>{
 const f=fixture();f[flag]=true;await assert.rejects(()=>claimAllPoolRewards(token,community,components),message);assert.equal(f.writes,0)
})
