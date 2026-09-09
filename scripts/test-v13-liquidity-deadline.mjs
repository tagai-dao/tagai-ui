import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const dir = await mkdtemp(join(tmpdir(), 'v13-liquidity-deadline-'))
const addr = n => `0x${n.toString(16).padStart(40, '0')}`
const [token, asset, pair, staking, community, committee, router, pump, trade, account] = Array.from({length:10}, (_,i)=>addr(i+1))
await build({entryPoints:['src/utils/v13/pools.ts'], bundle:true, platform:'node', format:'cjs', outfile:join(dir,'pools.cjs'), logLevel:'silent', plugins:[{name:'fixtures',setup(b){
  b.onResolve({filter:/^@\//}, a=>({path:a.path,namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'}, ()=>({loader:'js',contents:`
    export const getChainDeployment=()=>({contracts:{liquidityRouter13:'${router}',pump13:'${pump}',tradeRouter13:'${trade}'}});
    export const getReadOnlyClient=()=>globalThis.__liquidityDeadline.client;
    export const getWalletClient=()=>globalThis.__liquidityDeadline.wallet;
    export const useAccountStore=()=>({ethConnectAddress:'${account}',getWalletType:'privy'});
    export const useChainStore=()=>({activeChainId:56});
    export const setup=async()=>{};
    export const get=async()=>{}; export const API_BASE_URL='';
  `}))
}}]})
const {liquidity} = createRequire(import.meta.url)(join(dir,'pools.cjs'))
const component={asset,pair,staking_pool:staking,position:1}
function fixture(offset){
  const f={timestamp:BigInt(Math.floor(Date.now()/1000))+offset,events:[],calls:[],failBlock:false}
  f.client={
    readContract:async({functionName})=>({pump,tradeRouter:trade,componentAt:[asset,2500n,pair],stakeToken:pair,community,
      getUserStakedAmount:0n,getTotalStakedAmount:1000n,getPoolPendingRewards:0n,balanceOf:10n**24n,
      symbol:'STOCK',decimals:18,getReserves:[10n**21n,10n**21n,0],token0:token,totalSupply:10n**21n,
      poolActived:true,getCommittee:committee,getPoolOperationFee:0n,allowance:0n})[functionName],
    getBalance:async()=>10n**18n,
    getBlock:async args=>{f.events.push('block');assert.equal(args.blockTag,'latest');if(f.failBlock)throw new Error('RPC unavailable');return {timestamp:f.timestamp}},
    simulateContract:async request=>{f.events.push(request.functionName);f.calls.push(request);return {request}},
    waitForTransactionReceipt:async()=>{f.timestamp+=300n;f.events.push('receipt');return {status:'success'}},
  }
  f.wallet={writeContract:async()=> '0xhash'}
  globalThis.__liquidityDeadline=f;return f
}
after(async()=>{delete globalThis.__liquidityDeadline;await rm(dir,{recursive:true,force:true})})
for(const action of ['add','remove']) for(const offset of [3600n,-3600n]){
  test(`${action} uses fresh chain time after approvals when chain clock offset is ${offset}s`,async()=>{
    const f=fixture(offset),initial=f.timestamp
    await liquidity(token,community,component,action,10n**18n,100,router)
    const approvals=action==='add'?2:1
    assert.deepEqual(f.events,[...Array.from({length:approvals},()=>['approve','receipt']).flat(),'block',action,'receipt'])
    assert.equal(f.calls.at(-1).args.at(-1),initial+BigInt(approvals)*300n+120n)
  })
}
test('failed chain time read never falls back to browser time or submits liquidity',async()=>{
  const f=fixture(3600n);f.failBlock=true
  await assert.rejects(()=>liquidity(token,community,component,'add',10n**18n,100,router),/RPC unavailable/)
  assert.equal(f.calls.some(c=>c.functionName==='add'),false)
})
