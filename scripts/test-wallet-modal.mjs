import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import {createRenderer,defineComponent,h,ref,watch,nextTick,onMounted,onUnmounted} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'wallet-modal-'))
const {createPinia,setActivePinia}=require('pinia')
const plugin={name:'fixtures',setup(b){
  b.onResolve({filter:/^(vue|pinia)$/},a=>({path:require.resolve(a.path),external:true}))
  b.onResolve({filter:/^@\/types$/},()=>({path:join(process.cwd(),'src/types/index.ts')}))
  b.onResolve({filter:/^@\/stores\/common$/},()=>({path:join(process.cwd(),'src/stores/common.ts')}))
  b.onResolve({filter:/^@\/components\//},a=>({path:a.path,namespace:'modal'}))
  b.onLoad({filter:/.*/,namespace:'modal'},a=>({loader:'js',contents:`
    import {defineComponent,onMounted,onUnmounted,h} from 'vue';
    export default defineComponent({setup(_, {expose,emit}){
      const f=globalThis.__modalFixture,name=${JSON.stringify(a.path.split('/').at(-1))};
      onMounted(()=>{f.mounts.push(name)});onUnmounted(()=>{f.unmounts.push(name)});
      if(name==='ChoseWallet.vue')f.connected=()=>emit('chosedWallet');
      return ()=>h('div',name);
    }});`}))
}}
async function bundle(name,contents){
 await build({stdin:{contents,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,name+'.cjs'),logLevel:'silent',plugins:[plugin]})
 return require(join(dir,name+'.cjs'))
}
const modalSource=await readFile('src/layout/GlobalModal.vue','utf8')
const {descriptor}=parse(modalSource)
const script=compileScript(descriptor,{id:'modal-test',inlineTemplate:true})
// Export the real store from the same bundle so component and tests share it.
const {default:GlobalModal,useModalStore,GlobalModalType}=await bundle('modal',script.content+"\nexport {useModalStore,GlobalModalType};")
const layoutSource=await readFile('src/layout/Layout.vue','utf8')
const layoutTemplate=parse(layoutSource).descriptor.template.content
const {render}=await bundle('layout',compileTemplate({source:layoutTemplate,filename:'Layout.vue',id:'layout-test'}).code)
const node=()=>({children:[],parent:null})
function remove(child){const siblings=child.parent?.children;if(siblings){const i=siblings.indexOf(child);if(i>=0)siblings.splice(i,1)}child.parent=null}
const renderer=createRenderer({
 createComment:node,createElement:node,createText:node,
 insert(child,parent,anchor){remove(child);child.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,child)},remove,
 setText:()=>{},setElementText:()=>{},parentNode:n=>n.parent,nextSibling:n=>{const siblings=n.parent?.children;return siblings?.[siblings.indexOf(n)+1]??null},patchProp:()=>{},
})
const Blank=defineComponent({render:()=>null})
function mount(){
 const pinia=createPinia();setActivePinia(pinia)
 const store=useModalStore()
 const f={mounts:[],unmounts:[],bridgeRenders:0,pageMounts:0,pageUnmounts:0}
 globalThis.__modalFixture=f
 const page=defineComponent({setup(){
  const amount=ref('0.01');f.amount=amount
  onMounted(()=>f.pageMounts++);onUnmounted(()=>f.pageUnmounts++)
  return ()=>h('input',{value:amount.value})
 }})
 const Bridge=defineComponent({setup(_,ctx){return ()=>{f.bridgeRenders++;return ctx.slots.default()}}})
 const Dialog=defineComponent({inheritAttrs:false,props:['modelValue'],setup(props,ctx){
  const contentMounted=ref(false)
  watch(()=>props.modelValue,value=>{if(value)contentMounted.value=true},{immediate:true,flush:'sync'})
  f.finishClose=()=>{contentMounted.value=false}
  // Model Element Plus keeping the closing content mounted for its transition.
  return ()=>contentMounted.value?ctx.slots.default():null
 }})
 const app=renderer.createApp({render,setup:()=>({cachedComponents:[],modalStore:store,GlobalModalType})})
 app.use(pinia)
 app.config.globalProperties.$route={name:'tag-detail',meta:{tabBar:false,topBar:false}}
 for(const name of ['LeftSidebar','TopBar','SearchBar','ChainSwitcher','LanguageSwitcher','TabBar'])app.component(name,Blank)
 app.component('WrappedReactComponent',Bridge)
 app.component('GlobalModal',GlobalModal)
 app.component('RouterView',defineComponent({setup:(_,ctx)=>()=>ctx.slots.default({Component:page})}))
 app.component('ElDialog',Dialog)
 app.mount(node())
 return {app,store,f}
}
test('closing wallet selection keeps its content during leave; never mounts creation',async()=>{
 const {app,store,f}=mount()
 try{
  store.setModalVisible(true,GlobalModalType.ChoseWallet,{origin:'lp'});await nextTick()
  assert.deepEqual(f.mounts,['ChoseWallet.vue'])
  f.connected();await nextTick()
  assert.equal(store.modalVisible,false);assert.equal(store.modalType,GlobalModalType.ChoseWallet)
  assert.deepEqual(store.modalParams,{origin:'lp'});assert.deepEqual(f.mounts,['ChoseWallet.vue'])
  f.finishClose();await nextTick();assert.deepEqual(f.unmounts,['ChoseWallet.vue'])
 }finally{app.unmount()}
})
test('open, connect, close and reopen never invalidate the outer bridge or remount the page',async()=>{
 const {app,store,f}=mount()
 try{
  await nextTick();const initialRenders=f.bridgeRenders,amount=f.amount
  for(let i=0;i<3;i++){
   store.setModalVisible(true,GlobalModalType.ChoseWallet);await nextTick()
   f.connected();await nextTick();f.finishClose();await nextTick()
  }
  assert.equal(f.bridgeRenders,initialRenders)
  assert.equal(f.pageMounts,1);assert.equal(f.pageUnmounts,0)
  assert.equal(f.amount,amount);assert.equal(f.amount.value,'0.01')
  assert.equal(f.mounts.includes('CreateCoinModal.vue'),false)
 }finally{app.unmount()}
})
test('creation still opens explicitly and close locking still protects transactions',async()=>{
 const {app,store,f}=mount()
 try{
  store.setModalVisible(true,GlobalModalType.CreateCoin);await nextTick()
  assert.deepEqual(f.mounts,['CreateCoinModal.vue'])
  store.setModalCloseEnable(false);store.setModalVisible(false)
  assert.equal(store.modalVisible,true)
  store.setModalVisible(true,GlobalModalType.ChoseWallet)
  assert.equal(store.modalType,GlobalModalType.CreateCoin)
  store.setModalCloseEnable(true);store.setModalVisible(false);await nextTick()
  assert.equal(store.modalVisible,false)
 }finally{app.unmount()}
})
test('opening publishes the intended type and parameters before becoming visible',()=>{
 const {app,store}=mount(),seen=[]
 const stop=watch(()=>store.modalVisible,visible=>{if(visible)seen.push([store.modalType,store.modalParams])},{flush:'sync'})
 try{
  store.setModalVisible(true,GlobalModalType.ChoseWallet,{origin:'lp'})
  assert.deepEqual(seen,[[GlobalModalType.ChoseWallet,{origin:'lp'}]])
 }finally{stop();app.unmount()}
})
after(async()=>{delete globalThis.__modalFixture;await rm(dir,{recursive:true,force:true})})
