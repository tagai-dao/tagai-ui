import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'trade-curation-ui-'))
await build({entryPoints:['src/utils/tradeCuration.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'module.cjs'),logLevel:'silent',plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/(apis\/axios|config|stores\/chain)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const BACKEND_API_URL='https://api.example';export const useChainStore=()=>globalThis.__tc.chain;export const post=(...a)=>globalThis.__tc.post(...a);export const get=(...a)=>globalThis.__tc.get(...a);`,loader:'js'}))
}}]})
const api=createRequire(import.meta.url)(join(dir,'module.cjs'))
const input={token:'0x'+'11'.repeat(20),wallet:'0x'+'22'.repeat(20),tweetId:'post'}
const suffix='0x7461676169746331'+'ab'.repeat(32)
let calls
beforeEach(()=>{calls=[];globalThis.__tc={chain:{activeChainId:56},post:async(...args)=>{calls.push(args);return {c:0,d:{...input,dataSuffix:suffix}}},get:async()=>({c:0,d:[]})}})
after(async()=>{delete globalThis.__tc;await rm(dir,{recursive:true,force:true})})
test('anonymous buy requests a transaction attribution without a login id or extra wallet signature',async()=>{
 const p=await api.prepareTradeAttribution(input)
 assert.equal(p.dataSuffix,suffix);assert.equal(calls[0][1].twitterId,undefined)
 assert.equal(calls[0][2].headers['X-Chain-Id'],'56')
})
test('other chains and buys outside posts do not register an intent',async()=>{
 globalThis.__tc.chain.activeChainId=4663
 assert.equal(await api.prepareTradeAttribution(input),null)
 globalThis.__tc.chain.activeChainId=56
 assert.equal(await api.prepareTradeAttribution({...input,tweetId:undefined}),null)
 assert.equal(calls.length,0)
})
test('disabled feature and absent pools preserve ordinary buying',async()=>{
 for(const code of ['TRADE_CURATION_DISABLED','NO_TRADE_CURATION_POOL','CURATION_WINDOW_CLOSED']){
  globalThis.__tc.post=async()=>{throw {data:{error:code}}}
  assert.equal(await api.prepareTradeAttribution(input),null)
 }
})
test('network errors and wrong token/wallet proof are not silently dropped',async()=>{
 globalThis.__tc.post=async()=>{throw Error('offline')}
 await assert.rejects(api.prepareTradeAttribution(input),/offline/)
 globalThis.__tc.post=async()=>({c:0,d:{...input,wallet:input.token,dataSuffix:suffix}})
 await assert.rejects(api.prepareTradeAttribution(input),/INVALID_TRADE/)
 globalThis.__tc.post=async()=>({c:0,d:{...input,dataSuffix:'0x1234'}})
 await assert.rejects(api.prepareTradeAttribution(input),/INVALID_TRADE/)
})
test('claim amounts stay integer strings through the API boundary',async()=>{
 const max=(2n**256n-1n).toString()
 globalThis.__tc.post=async()=>({c:0,d:{amountRaw:max,orderId:max}})
 const o=await api.getTradeClaim('user',input.token)
 assert.equal(BigInt(o.amountRaw),2n**256n-1n);assert.equal(o.orderId,max)
})
test('trade-card attribution survives unchanged and cannot silently move to the parent post',async()=>{
 const source='tr_'+'0'.repeat(50)+'_00000000'
 globalThis.__tc.post=async(...args)=>{calls.push(args);return {c:0,d:{...input,tweetId:source,dataSuffix:suffix}}}
 assert.equal((await api.prepareTradeAttribution({...input,tweetId:source})).tweetId,source)
 assert.equal(calls[0][1].tweetId,source)
 globalThis.__tc.post=async()=>({c:0,d:{...input,dataSuffix:suffix}})
 await assert.rejects(api.prepareTradeAttribution({...input,tweetId:source}),/INVALID_TRADE_ATTRIBUTION/)
})
