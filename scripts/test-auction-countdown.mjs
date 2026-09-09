import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'auction-countdown-'))
const filename='src/views/baskets/components/AuctionCountdown.vue',{descriptor}=parse(await readFile(filename,'utf8'),{filename})
await build({stdin:{contents:compileScript(descriptor,{id:'countdown-test'}).content,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'component.cjs'),plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},()=>({path:require.resolve('vue'),external:true}))
 b.onResolve({filter:/^vue-i18n$/},()=>({path:'i18n',namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const useI18n=()=>({t:k=>k,locale:{value:'en'}})"}))
}}]})
const Component=require(join(dir,'component.cjs')).default;Component.render=()=>null
const renderer=createRenderer({createComment:()=>({}),createElement:()=>({}),createText:()=>({}),insert:()=>{},remove:()=>{},setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}})
after(()=>rm(dir,{recursive:true,force:true}))
function mount(now){const app=renderer.createApp(Component,{endTime:10000,now}),vm=app.mount({});return {app,s:vm.$.setupState,props:vm.$.props}}
test('last-minute urgency starts exactly at 60 seconds and stops when ended',()=>{
 const {app,s,props}=mount(9939000)
 try{
  assert.equal(s.remaining,61);assert.equal(s.urgent,false)
  props.now=9940000;assert.equal(s.remaining,60);assert.equal(s.urgent,true);assert.deepEqual(s.digits.map(p=>p.value),['00','01','00'])
  props.now=9941000;assert.equal(s.remaining,59);assert.deepEqual(s.digits.map(p=>p.value),['00','00','59'])
  props.now=9999500;assert.equal(s.remaining,1);assert.equal(s.ended,false)
  props.now=10000000;assert.equal(s.remaining,0);assert.equal(s.ended,true);assert.equal(s.urgent,false)
  props.now=10050000;assert.equal(s.remaining,0)
 }finally{app.unmount()}
})
test('clock synchronization and an updated end time immediately update the countdown',()=>{
 const {app,s,props}=mount(0)
 try{
  assert.deepEqual(s.digits.map(p=>p.value),['02','46','40'])
  props.now=9945000;assert.equal(s.remaining,55);assert.equal(s.urgent,true)
  props.endTime=11000;assert.equal(s.remaining,1055);assert.equal(s.urgent,false)
 }finally{app.unmount()}
})
test('unknown chain time does not display a misleading zero or ended state',()=>{
 const {app,s}=mount(undefined)
 try{assert.equal(s.remaining,undefined);assert.equal(s.ended,false);assert.equal(s.urgent,false);assert.ok(s.digits.every(p=>p.value==='—'))}finally{app.unmount()}
})
