import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-liquidity-preview-'))
await build({entryPoints:['src/utils/v13/liquidity-preview.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'preview.cjs'),logLevel:'silent'})
const {previewLiquidityAdd,previewLiquidityAddFromAsset,afterPairTax}=createRequire(import.meta.url)(join(dir,'preview.cjs'))
after(()=>rm(dir,{recursive:true,force:true}))
test('LP estimate includes pair transfer tax and supports a six-decimal asset',()=>{
 const e18=10n**18n
 const q=previewLiquidityAdd(1000n*e18,{reserveToken:1000000n*e18,reserveAsset:2000n*10n**6n,supply:10000n*e18})
 assert.deepEqual(q,{netToken:999n*e18,assetAmount:1998000n,assetUsed:1998000n,lp:999n*e18/100n})
})
test('LP mint is limited by the stock side after the router rounds down; maximum stock input rounds up',()=>{
 const q=previewLiquidityAdd(2n,{reserveToken:3n,reserveAsset:5n,supply:100n})
 assert.deepEqual(q,{netToken:2n,assetAmount:4n,assetUsed:3n,lp:60n})
})
test('dust cannot promise LP when stock contribution rounds to zero',()=>{
 assert.equal(previewLiquidityAdd(1n,{reserveToken:10000n,reserveAsset:1n,supply:10000n}).lp,0n)
})
test('empty reserves and nonpositive inputs do not show an estimate',()=>{
 const s={reserveToken:100n,reserveAsset:50n,supply:100n}
 for(const key of Object.keys(s))assert.equal(previewLiquidityAdd(1n,{...s,[key]:0n}),undefined)
 for(const amount of [0n,-1n])assert.equal(previewLiquidityAdd(amount,s),undefined)
})
test('six-decimal stock input derives the gross T amount including pair tax',()=>{
 const e18=10n**18n,s={reserveToken:1000000n*e18,reserveAsset:2000n*10n**6n,supply:10000n*e18}
 const q=previewLiquidityAddFromAsset(1998000n,s)
 assert.equal(q.netToken,999n*e18);assert.equal(q.assetAmount,1998000n)
 assert.equal(q.lp,999n*e18/100n)
 assert.equal(afterPairTax(q.tokenAmount),q.netToken)
 assert.ok(afterPairTax(q.tokenAmount-1n)<q.netToken)
})
test('reverse quotes never exceed stock budget and use the least gross T for the chosen net amount',()=>{
 for(let a=1n;a<=300n;a++)for(const rt of [3n,999n,1000n,234567890123456789n]){
  const s={reserveToken:rt,reserveAsset:37n,supply:1000000n},q=previewLiquidityAddFromAsset(a,s)
  if(!q){assert.equal(a*rt/37n,0n);continue}
  assert.ok(q.assetAmount<=a);assert.ok(q.assetUsed<=a)
  assert.equal(afterPairTax(q.tokenAmount),q.netToken)
  assert.ok(afterPairTax(q.tokenAmount-1n)<q.netToken)
  assert.deepEqual(previewLiquidityAdd(q.tokenAmount,s),{netToken:q.netToken,assetAmount:q.assetAmount,assetUsed:q.assetUsed,lp:q.lp})
 }
})
test('reverse quotes reject unavailable reserves and sub-unit stock budgets',()=>{
 const s={reserveToken:3n,reserveAsset:10000n,supply:100n}
 for(const amount of [0n,-1n,1n])assert.equal(previewLiquidityAddFromAsset(amount,s),undefined)
 for(const key of Object.keys(s))assert.equal(previewLiquidityAddFromAsset(10000n,{...s,[key]:0n}),undefined)
})
