import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import { parseEther, isAddress, zeroAddress, formatUnits } from 'viem'
const dir=await mkdtemp(join(tmpdir(),'agent-form-'))
await build({entryPoints:['src/utils/agentTradePrompt.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'prompt.cjs'),logLevel:'silent'})
const prompt=createRequire(import.meta.url)(join(dir,'prompt.cjs'))
const source=readFileSync('src/components/common/AgentTradeGuide.vue','utf8')
const {descriptor}=parse(source),compiled=compileScript(descriptor,{id:'agent-form'})
const code=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const token='0x1111111111111111111111111111111111111111',subject='0x3333333333333333333333333333333333333333'
function fixture(){
 const pending=[],copied=[],chain=Vue.reactive({activeChainId:56});let dispose
 const exports={}
 new Function('require','exports',code)(id=>{
  if(id==='vue')return {...Vue,onBeforeUnmount:fn=>{dispose=fn}}
  if(id==='viem')return {parseEther,isAddress,zeroAddress,formatUnits}
  if(id==='vue-i18n')return {useI18n:()=>({locale:Vue.ref('zh')})}
  if(id==='@vueuse/core')return {useClipboard:()=>({isSupported:Vue.ref(true),copied:Vue.ref(false),copy:async text=>copied.push(text)})}
  if(id==='@/stores/chain')return {useChainStore:()=>chain}
  if(id==='@/utils/agentTradePrompt')return prompt
  if(id==='@/utils/agentCurveQuote')return {quoteAgentCurveBuy:(token,version,amountIn)=>new Promise(resolve=>pending.push({resolve,token,version,amountIn}))}
  throw Error('Unexpected import '+id)
 },exports)
 const props=Vue.reactive({token,tick:'TEST',name:'Test',version:18,referralAddress:subject})
 const state=exports.default.setup(props,{expose(){}})
 const result=(i,extra={})=>pending[i].resolve({chainId:56,token:pending[i].token,version:pending[i].version,amountIn:pending[i].amountIn,amountOut:parseEther('1234'),blockNumber:123n,quotedAt:Date.now(),...extra})
 return {state,props,pending,copied,chain,result,stop:()=>dispose()}
}

after(async()=>{await rm(dir,{recursive:true,force:true})})
test('late quotes cannot overwrite the amount currently in the form; copy includes chosen optional data',async()=>{
 const f=fixture();try{
  f.state.amount.value='0.01';const first=f.state.refreshEstimate()
  f.state.amount.value='0.02';const second=f.state.refreshEstimate()
  f.result(1,{amountOut:parseEther('414160.137937445499869349')});await second;f.result(0);await first
  assert.equal(f.state.estimate.value.amountIn,parseEther('0.02'))
  assert.equal(f.state.estimatedAmount.value,'414,160.14 TEST')
  f.state.confidence.value='0';f.state.callout.value='reason\nsecond line'
  await f.state.copyPrompt()
  assert.equal(f.copied.length,1);assert.ok(f.copied[0].startsWith('请先阅读并遵循以下 Skill 的说明：'))
  assert.ok(f.copied[0].includes('0.02 BNB'));assert.ok(f.copied[0].includes('置信度：0%'));assert.ok(f.copied[0].includes(subject))
  assert.ok(f.copied[0].includes('414160.137937445499869349'))
  f.state.estimate.value={...f.state.estimate.value,amountOut:1n}
  assert.equal(f.state.estimatedAmount.value,'<0.01 TEST')
  f.state.estimate.value={...f.state.estimate.value,amountOut:parseEther('12')}
  assert.equal(f.state.estimatedAmount.value,'12 TEST')
 }finally{f.stop()}
})
test('expired estimates refresh on copy and source changes cancel the in-flight copy and clear the draft',async()=>{
 const f=fixture();try{
  f.state.amount.value='0.01';const quote=f.state.refreshEstimate();f.result(0,{quotedAt:Date.now()-31000});await quote
  const copy=f.state.copyPrompt();assert.equal(f.pending.length,2);assert.equal(f.copied.length,0)
  f.props.referralAddress='0x4444444444444444444444444444444444444444'
  f.result(1);await copy
  assert.equal(f.state.amount.value,'');assert.equal(f.state.estimate.value,null);assert.equal(f.copied.length,0)
 }finally{f.stop()}
})
test('invalid confidence blocks copying, and chain changes clear all draft fields',async()=>{
 const f=fixture();try{
  f.state.amount.value='0.01';const quote=f.state.refreshEstimate();f.result(0);await quote
  f.state.confidence.value='101';assert.equal(f.state.ready.value,false);await f.state.copyPrompt();assert.equal(f.copied.length,0)
  f.state.callout.value='old draft';f.chain.activeChainId=4663
  assert.equal(f.state.amount.value,'');assert.equal(f.state.callout.value,'');assert.equal(f.state.confidence.value,'')
 }finally{f.stop()}
})
