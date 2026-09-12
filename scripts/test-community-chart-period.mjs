import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
const exports = {}
new Function('exports', ts.transpileModule(readFileSync('src/utils/communityChartPeriod.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports)
const { periodChange } = exports
assert.ok(Math.abs(periodChange([{timestamp:100,close:10},{timestamp:400,close:12}],300,400)-20)<1e-10)
assert.equal(periodChange([{timestamp:200,close:10},{timestamp:400,close:12}],300,400),null)
assert.equal(periodChange([],300,400),null)
assert.equal(periodChange([{timestamp:100,close:10},{timestamp:400,close:10}],300,400),0)
for (const file of ['src/views/tag-detail/CommunityChart.vue','src/views/buy-sell/Kline.vue','src/layout/TopBar.vue']) {
 const {descriptor,errors}=parse(readFileSync(file,'utf8'),{filename:file});assert.deepEqual(errors,[])
 const script=compileScript(descriptor,{id:file})
 assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:file,compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
}
console.log('Period calculation and three Vue templates passed')
