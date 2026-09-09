import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'v13-mining-'))
const token='0x'+'11'.repeat(20),community='0x'+'22'.repeat(20),asset='0x'+'33'.repeat(20),pair='0x'+'44'.repeat(20),pool='0x'+'55'.repeat(20)
await build({entryPoints:['src/utils/v13/mining.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'mining.cjs'),logLevel:'silent'})
const {readMiningPools}=require(join(dir,'mining.cjs'))
function client(overrides={}){
 const calls=[]
 return {calls,getBlockNumber:async()=>123n,readContract:async args=>{
  calls.push(args);assert.equal(args.blockNumber,123n)
  const values={nutboxCommunity:community,componentCount:1n,getCommunityToken:token,componentAt:[asset,10000,pair],createdPools:pool,stakeToken:pair,community,...overrides}
  if(!(args.functionName in values))throw Error('Unexpected call')
  return values[args.functionName]
 }}
}
test('chain fallback verifies associations at one block and does not invent API metadata',async()=>{
 const c=client(),result=await readMiningPools(c,token)
 assert.deepEqual(result,{community,components:[{asset,pair,staking_pool:pool,position:0,target_weight:10000,asset_decimals:null,pool_status:null}]})
 assert.ok(c.calls.some(c=>c.functionName==='createdPools'))
 assert.ok(!c.calls.some(c=>c.functionName==='activedPools'))
})
for(const [name,value] of [['stakeToken',asset],['community',asset],['getCommunityToken',asset],['componentCount',5n],['nutboxCommunity','0x'+'00'.repeat(20)]]){
 test(`chain fallback rejects invalid ${name}`,async()=>assert.rejects(readMiningPools(client({[name]:value}),token),/V13_POOL_MISMATCH/))
}

const filename='src/views/tag-detail/V13TokenPanel.vue',source=await readFile(filename,'utf8')
const {descriptor}=parse(source,{filename}),script=compileScript(descriptor,{id:'mining-test'})
await build({stdin:{contents:script.content,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'panel.cjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},()=>({path:require.resolve('vue'),external:true}))
 b.onResolve({filter:/^(@\/|vue-i18n$|\.\/V13PoolCard.vue$)/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export default {};export const useI18n=()=>({t:k=>k,locale:{value:'en'}});
 export const getChainDeployment=()=>({contracts:{liquidityRouter13:null}});
 export const useAccountStore=()=>({ethConnectAddress:''});export const useChainStore=()=>({activeChainId:56});
 export const useCommunityStore=()=>({currentSelectedCommunity:{token:${JSON.stringify(token)},tick:'T'}});
 export const getV13Detail=()=>globalThis.__miningFixture.detail();
 export const readLifecycle=()=>globalThis.__miningFixture.lifecycle();
 export const readMiningPools=()=>globalThis.__miningFixture.pools();
 export const getReadOnlyClient=()=>({readContract:async args=>{globalThis.__miningFixture.reads.push(args.functionName);return 7n}});
 export const CURVE_CAP=650000000n*10n**18n;
 export const formatPrice=String,formatAmount=String,notify=()=>{},poolOperationErrorKey=()=>'';
 export const claimAllPoolRewards=async()=>{},send=async()=>{},walletGuard=()=>({});`}))
}}]})
const Panel=require(join(dir,'panel.cjs')).default;Panel.render=()=>null
const renderer=createRenderer({createComment:()=>({}),createElement:()=>({}),createText:()=>({}),insert:()=>{},remove:()=>{},setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}})
function mount(overrides={}){
 globalThis.__miningFixture={detail:async()=>{throw Error('503')},lifecycle:async()=>({listed:false,pending:false,supply:325000000n*10n**18n}),pools:async()=>({community,components:[{asset,pair,staking_pool:pool}]}),reads:[],...overrides}
 const app=renderer.createApp(Panel,{mining:true}),vm=app.mount({});return {app,s:vm.$.setupState}
}
test('API 503 cannot erase inner-curve progress; verified chain pools remain visible',async()=>{
 const {app,s}=mount()
 try{await s.refresh();assert.equal(s.progress,50);assert.equal(s.state.listed,false);assert.equal(s.pools.components.length,1);assert.equal(s.error,'');assert.ok(s.chainPools);assert.equal(s.burned,undefined);assert.deepEqual(globalThis.__miningFixture.reads,[])}finally{app.unmount()}
})
test('when both pool sources fail, lifecycle still updates and no fabricated pools appear',async()=>{
 const {app,s}=mount({pools:async()=>{throw Error('RPC failed')}})
 try{await s.refresh();assert.equal(s.progress,50);assert.equal(s.pools,undefined);assert.equal(s.error,'v13Page.loadError')}finally{app.unmount()}
})
test('pending-list keeps the progress section and does not query burn balance',async()=>{
 const {app,s}=mount({lifecycle:async()=>({listed:false,pending:true,supply:650000000n*10n**18n})})
 try{await s.refresh();assert.equal(s.progress,100);assert.equal(s.stage,'v13Page.pending');assert.deepEqual(globalThis.__miningFixture.reads,[])}finally{app.unmount()}
})
test('burn balance is queried only after the listed lifecycle is confirmed',async()=>{
 const {app,s}=mount({lifecycle:async()=>({listed:true,pending:false,supply:650000000n*10n**18n})})
 try{await s.refresh();assert.equal(s.state.listed,true);assert.equal(s.burned,7n);assert.ok(globalThis.__miningFixture.reads.includes('balanceOf'))}finally{app.unmount()}
})
test('API recovery replaces the fallback without dropping successful lifecycle data',async()=>{
 const {app,s}=mount()
 try{await s.refresh();globalThis.__miningFixture.detail=async()=>({config:{community},components:[],buyback:null});await s.refresh();assert.equal(s.chainPools,undefined);assert.ok(s.data);assert.equal(s.progress,50)}finally{app.unmount()}
})
test('template gates burn by listed state, not just the mining tab',()=>{
 assert.match(source,/v-if="mining && state\?\.listed" class="burn-summary"/)
 assert.match(source,/v-if="state && \(!mining \|\| !state.listed\)" class="summary"/)
 assert.match(source,/v-if="mining && pools"/)
})
after(async()=>{delete globalThis.__miningFixture;await rm(dir,{recursive:true,force:true})})
