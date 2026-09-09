import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,nextTick} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'rebalance-test-')),require=createRequire(import.meta.url)
const address='0x'+'11'.repeat(20)
const plugin={name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},()=>({path:require.resolve('vue'),external:true}))
 b.onResolve({filter:/^(@\/|vue-i18n$|\.\/)/},a=>a.path.startsWith('./')&&!a.importer.endsWith('/baskets/rebalance.ts')?undefined:({path:'stub',namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
 export const BASKET_MAX_SLIPPAGE_BPS=500;
 export const getBasketDeployment=()=>({});export const getBasketProtocol=()=>({rebalanceExecutor:'${address}'});
 export const getReadOnlyClient=()=>globalThis.__rebalance.client;export const getWalletClient=()=>null;export const waitForTx=()=>{};
 export const getBasketTokenAbi=()=>[];export const getRebalanceExecutorAbi=()=>[];export const pancakePoolManagerStateAbi=[];
 export const applySlippage=(n,b)=>n*BigInt(10000-b)/10000n;
 export const getBasketV4PoolId=()=>'';
 export const quoteAssetToWethForSwap=()=>{};export const quoteBasketHubExactInput=()=>{};export const quoteWethToAssetForSwap=()=>{};
 export const quoteBscV3AssetToSettlement=async()=>{globalThis.__rebalance.timestamp+=300n;return 1000n};
 export const quoteBscV3SettlementToAsset=async()=>{globalThis.__rebalance.timestamp+=300n;return 100n};
 export const isBscBasketV3=()=>true;export const toContractLegRoute=x=>x;
 export const useI18n=()=>({t:k=>k});export const useAccountStore=()=>({ethConnectAddress:'${address}'});export const useChainStore=()=>({activeChainId:56});
 export const basketTradeErrorKey=()=> 'v13Operation.failed';export const buildRebalanceLimits=()=>{};
 `}))
}}
await build({entryPoints:['src/utils/baskets/rebalance.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'limits.cjs'),plugins:[plugin]})
const {buildRebalanceLimits}=require(join(dir,'limits.cjs'))
const filename='src/views/baskets/components/BasketRebalanceAction.vue',{descriptor}=parse(await readFile(filename,'utf8'),{filename})
await build({stdin:{contents:compileScript(descriptor,{id:'test'}).content,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'component.cjs'),plugins:[plugin]})
const Component=require(join(dir,'component.cjs')).default;Component.render=()=>null
const renderer=createRenderer({createComment:()=>({}),createElement:()=>({}),createText:()=>({}),insert:()=>{},remove:()=>{},setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}})
const detail={address,chainId:56,version:4,deployer:address,fullyPriced:true,effectiveSupply:10,aumUsd:100,lastRebalanceAt:0,holdings:[{asset:address,route:{},valueUsd:70,targetWeightPct:50},{asset:address,route:{},valueUsd:30,targetWeightPct:50}]}
function fixture(){const f={timestamp:BigInt(Math.floor(Date.now()/1000))+3600n,events:[]};f.client={readContract:async p=>{f.events.push(p.functionName);return p.functionName==='CALLER_CONTROLLED_SLIPPAGE'?true:{needed:true,sellMask:1,buyMask:2,assetIn:[100n,0n],expectedSettlementOut:[1000n,0n],settlementIn:[0n,1000n]}},getBlock:async args=>{assert.equal(args.blockTag,'latest');f.events.push('latest');return {timestamp:f.timestamp}}};globalThis.__rebalance=f;return f}
after(async()=>{delete globalThis.__rebalance;delete globalThis.window;await rm(dir,{recursive:true,force:true})})
test('deadline uses current chain time after slow leg quotes, not computer time',async()=>{
 const f=fixture(),start=f.timestamp,{v3Limits}=await buildRebalanceLimits(detail,100)
 assert.equal(f.timestamp,start+600n);assert.equal(v3Limits.deadline,f.timestamp+600n);assert.equal(f.events.at(-1),'latest')
 assert.equal(v3Limits.maxAssetIn[0],101n);assert.equal(v3Limits.minSettlementOut[0],990n);assert.equal(v3Limits.minAssetOut[1],99n)
})
test('invalid slippage and unavailable chain time fail closed',async()=>{
 for(const bps of [0,501,10000,NaN,1.5]){const f=fixture();await assert.rejects(()=>buildRebalanceLimits(detail,bps),/slippage/);assert.equal(f.events.length,0)}
 const f=fixture();f.client.getBlock=async()=>{throw Error('RPC unavailable')};await assert.rejects(()=>buildRebalanceLimits(detail,100),/RPC unavailable/)
})
test('expired deadlines are not labeled as slippage; oversized input disables execution',async()=>{
 fixture();globalThis.window=globalThis
 const app=renderer.createApp(Component,{detail}),vm=app.mount({}),s=vm.$.setupState
 try{
  await nextTick();await s.refreshChainClock()
  assert.equal(s.rebalanceError(Error('RebalanceDeadlineExpired()')),'v13Operation.expired')
  assert.equal(s.rebalanceError(Error('execution reverted: custom error 0xd4539258')),'v13Operation.expired')
  assert.equal(s.rebalanceError(Error('SlippageExceeded()')),'baskets.rebalanceSlippageError')
  assert.equal(s.rebalanceError(Error('RebalancePlanMismatch()')),'baskets.rebalancePlanChanged')
  assert.equal(s.canRebalance,true);s.slippagePct='10000.0';assert.equal(s.validSlippage,false);assert.equal(s.canRebalance,false)
  s.slippagePct='1.00';assert.equal(s.canRebalance,true)
  s.chainClock={timestamp:5000,fetchedAt:Date.now()};vm.$.props.detail={...detail,lastRebalanceAt:4500};await nextTick();assert.ok(s.cooldownRemaining>=3099&&s.cooldownRemaining<=3100)
 }finally{app.unmount()}
})
