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
    export const getPreparedWalletClient=async()=>globalThis.__liquidityDeadline.wallet;
    export const useAccountStore=()=>({ethConnectAddress:globalThis.__liquidityDeadline.account,getWalletType:'privy'});
    export const useChainStore=()=>({activeChainId:globalThis.__liquidityDeadline.chainId});
    export const setup=async()=>{};
    export const get=async()=>{}; export const API_BASE_URL='';
  `}))
}}]})
const {liquidity,send} = createRequire(import.meta.url)(join(dir,'pools.cjs'))
const component={asset,pair,staking_pool:staking,position:1}
function fixture(offset){
  const f={timestamp:BigInt(Math.floor(Date.now()/1000))+offset,events:[],calls:[],estimates:[],writes:[],failBlock:false,account,chainId:56,gas:1809599n}
  f.client={
    chain:{id:56},
    readContract:async({functionName})=>({pump,tradeRouter:trade,componentAt:[asset,2500n,pair],stakeToken:pair,community,
      getUserStakedAmount:0n,getTotalStakedAmount:1000n,getPoolPendingRewards:0n,balanceOf:10n**24n,
      symbol:'STOCK',decimals:18,getReserves:[10n**21n,10n**21n,0],token0:token,totalSupply:10n**21n,
      poolActived:true,getCommittee:committee,getPoolOperationFee:0n,allowance:0n})[functionName],
    getBalance:async()=>10n**18n,
    getBlock:async args=>{f.events.push('block');assert.equal(args.blockTag,'latest');if(f.failBlock)throw new Error('RPC unavailable');return {timestamp:f.timestamp}},
    simulateContract:async request=>{f.events.push(request.functionName);f.calls.push(request);return {request}},
    estimateContractGas:async request=>{f.estimates.push(request);return f.gas},
    waitForTransactionReceipt:async()=>{f.timestamp+=300n;f.events.push('receipt');return {status:'success'}},
  }
  f.wallet={writeContract:async request=>{f.writes.push(request);return '0xhash'}}
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
for(const gas of [1809599n,2500000n]) test(`LP send estimates ${gas} gas and rounds up 30% headroom`,async()=>{
  const f=fixture(0n);f.gas=gas
  const args=[{token,componentIndex:0n}],value=50000000000000000n
  assert.equal(await send(router,[],'addWithBNB',args,value),'0xhash')
  assert.deepEqual(f.estimates,[{address:router,abi:[],functionName:'addWithBNB',args,value,account}])
  assert.deepEqual(f.estimates[0],f.calls[0])
  assert.deepEqual(f.writes,[{...f.calls[0],chain:f.client.chain,gas:(gas*130n+99n)/100n}])
  assert.equal('gasPrice' in f.writes[0],false)
})
test('gas estimation failure never opens a wallet transaction or uses a fixed fallback',async()=>{
  const f=fixture(0n)
  f.client.estimateContractGas=async()=>{throw new Error('Estimate failed')}
  await assert.rejects(()=>send(router,[],'addWithBNB',[],1n),/Estimate failed/)
  assert.equal(f.writes.length,0)
})
for(const gas of [0n,-1n]) test(`invalid gas estimate ${gas} prevents submission`,async()=>{
  const f=fixture(0n);f.gas=gas
  await assert.rejects(()=>send(router,[],'addWithBNB',[],1n),/Invalid gas estimate/)
  assert.equal(f.writes.length,0)
})
for(const phase of ['simulateContract','estimateContractGas']) for(const change of ['account','chainId']) test(`${change} change during ${phase} prevents submission`,async()=>{
  const f=fixture(0n),original=f.client[phase]
  f.client[phase]=async request=>{const result=await original(request);f[change]=change==='account'?addr(999):1;return result}
  await assert.rejects(()=>send(router,[],'addWithBNB',[],1n),/Wallet or chain changed/)
  assert.equal(f.writes.length,0)
  if(phase==='simulateContract')assert.equal(f.estimates.length,0)
})
test('simulation failure stops before gas estimation and wallet submission',async()=>{
  const f=fixture(0n)
  f.client.simulateContract=async()=>{throw new Error('Simulation failed')}
  await assert.rejects(()=>send(router,[],'addWithBNB',[],1n),/Simulation failed/)
  assert.equal(f.estimates.length,0);assert.equal(f.writes.length,0)
})
test('reverted receipt still reports failure after a buffered submission',async()=>{
  const f=fixture(0n);f.client.waitForTransactionReceipt=async()=>({status:'reverted'})
  await assert.rejects(()=>send(router,[],'addWithBNB',[],1n),/Transaction reverted/)
  assert.equal(f.writes.length,1)
})
