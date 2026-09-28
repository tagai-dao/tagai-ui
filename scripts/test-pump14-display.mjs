import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computed } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

for (const [file, name] of [['HomeTagDetail.vue','isV13Token'], ['TagToken.vue','isV13']]) {
  const source = readFileSync(new URL(`../src/views/tag-detail/${file}`, import.meta.url), 'utf8')
  const line = source.split('\n').find(line => line.startsWith(`const ${name} = computed(`))
  test(`${file}: shared index panels include Pump14 without enabling legacy/RH tokens`, () => {
    const evaluate = new Function('computed', 'chainStore', 'comStore', `${line}; return ${name}.value`)
    for (const version of [13, '13', 14, '14']) assert.equal(evaluate(computed, { activeChainId:56 }, {currentSelectedCommunity:{version}}), true)
    for (const version of [undefined, 9, 10, 11, 12, 15]) assert.equal(evaluate(computed, { activeChainId:56 }, {currentSelectedCommunity:{version}}), false)
    assert.equal(evaluate(computed, { activeChainId:4663 }, {currentSelectedCommunity:{version:14}}), false)
  })
  test(`${file}: template compiles with the updated display gate`, () => {
    const {descriptor,errors} = parse(source,{filename:file})
    assert.deepEqual(errors,[])
    const script=compileScript(descriptor,{id:'pump14-display'})
    assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:file,id:'pump14-display',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
  })
}
