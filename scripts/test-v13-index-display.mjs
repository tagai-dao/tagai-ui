import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import {createRenderer} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'v13-index-display-'))
const filename='src/views/tag-detail/V13IndexRewards.vue',source=await readFile(filename,'utf8')
const {descriptor}=parse(source,{filename}),script=compileScript(descriptor,{id:'index-display-test'})
await build({stdin:{contents:script.content,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'panel.cjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},()=>({path:require.resolve('vue'),external:true}))
 b.onResolve({filter:/^@\/utils\/v13\/operation-error$/},()=>({path:join(process.cwd(),'src/utils/v13/operation-error.ts')}))
 b.onResolve({filter:/^(@\/|vue-i18n$)/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export default {};export const useI18n=()=>({t:k=>k,locale:{value:'en'}});
 export const useCommunityStore=()=>({currentSelectedCommunity:{token:'0x'+'11'.repeat(20),tick:'CyberCab'}});
 export const useAccountStore=()=>({ethConnectAddress:''});export const useChainStore=()=>({activeChainId:56});
 export const useModalStore=()=>({setModalVisible:()=>{globalThis.__indexDisplay.actions++}});export const GlobalModalType={ChoseWallet:1};
 export const buybackAbi=[];
 export const getReadOnlyClient=()=>({readContract:async()=>{if(globalThis.__indexDisplay.fail)throw Error('RPC');return globalThis.__indexDisplay.listed}});
 export const getV13Detail=async()=>{globalThis.__indexDisplay.details++;throw Error('503')};
 export const readBuybackState=async()=>{globalThis.__indexDisplay.rewards++;return {listed:true,index:'0x'+'22'.repeat(20),symbol:'IDX',reserve:1n}};
 export const quoteBuyback=async()=>{globalThis.__indexDisplay.actions++;if(globalThis.__indexDisplay.quoteError)throw globalThis.__indexDisplay.quoteError};
 export const executeBuyback=async()=>{globalThis.__indexDisplay.actions++};
 export const claimIndexReward=async()=>{globalThis.__indexDisplay.actions++};
 `}))
}}]})
const Panel=require(join(dir,'panel.cjs')).default;Panel.render=()=>null
const renderer=createRenderer({createComment:()=>({}),createElement:()=>({}),createText:()=>({}),insert:()=>{},remove:()=>{},setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}})
function mount(overrides={}){
 globalThis.__indexDisplay={listed:false,fail:false,details:0,rewards:0,actions:0,...overrides}
 const app=renderer.createApp(Panel),vm=app.mount({});return {app,s:vm.$.setupState}
}
test('inner / pending-list shows creation notice without loading unavailable index data',async()=>{
 const {app,s}=mount()
 try{await s.load();assert.equal(s.listed,false);assert.equal(s.indexReady,false);assert.equal(s.name,'CyberCab');assert.equal(s.loadError,'');assert.equal(globalThis.__indexDisplay.details,0);assert.equal(globalThis.__indexDisplay.rewards,0);await s.preview();await s.operate('claim');assert.equal(globalThis.__indexDisplay.actions,0)}finally{app.unmount()}
})
test('subsequent refresh after listing reveals index actions even if optional metadata fails',async()=>{
 const {app,s}=mount()
 try{await s.load();globalThis.__indexDisplay.listed=true;await s.load();assert.equal(s.listed,true);assert.equal(s.indexReady,true);assert.equal(s.name,'IDX');assert.equal(globalThis.__indexDisplay.rewards,1)}finally{app.unmount()}
})
test('unknown lifecycle reports failure instead of incorrectly claiming inner curve',async()=>{
 const {app,s}=mount({fail:true})
 try{await s.load();assert.equal(s.listed,undefined);assert.equal(s.indexReady,false);assert.equal(s.loadError,'v13Page.loadError');assert.equal(globalThis.__indexDisplay.rewards,0)}finally{app.unmount()}
})
test('quote failures stop the spinner, clear executable quotes and display safe error messages',async(t)=>{
 t.mock.method(console,'warn',()=>{})
 for(const [quoteError,key] of [[Error('HTTP request failed'),'network'],[{cause:{data:'0x90bfb86500008199f5f30000'}},'slippage']]){
  const {app,s}=mount({listed:true,quoteError})
  try{await s.load();await s.preview();assert.equal(s.quoting,false);assert.equal(s.quote,undefined);assert.equal(s.error,'v13Operation.'+key)}finally{app.unmount()}
 }
})
test('template hides stats and actions until index is ready and uses the listing notice',()=>{
 assert.match(source,/v-if="listed === false"[^>]*>[\s\S]*?v13Index.createdOnList/)
 assert.match(source,/<template v-if="indexReady">[\s\S]*class="index-stats"[\s\S]*class="index-actions"/)
 const result=compileTemplate({source:descriptor.template.content,filename,id:'index-display-test'})
 assert.deepEqual(result.errors,[])
})
after(async()=>{delete globalThis.__indexDisplay;await rm(dir,{recursive:true,force:true})})
