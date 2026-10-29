import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const messages = JSON.parse(read('src/lang/locales/en.json'))
const { descriptor, errors } = parse(read('src/components/common/TradeNote.vue'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, { id: 'trade-note-test', inlineTemplate: true })
const code = ts.transpileModule(compiled.content, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const exports = {}
new Function('require', 'exports', code)(name => {
  if (name === 'vue') return Vue
  if (name === 'vue-i18n') return { useI18n: () => ({ t: key => messages.tradeNote[key.split('.')[1]] }) }
  throw Error('Unexpected import: ' + name)
}, exports)
const render = props => renderToString(Vue.createSSRApp({ render: () => Vue.h(exports.default, props) }))

test('renders verified text with line breaks and an explicit 0% confidence', async () => {
  const html = await render({ text: '第一行\nSecond line', confidence: 0 })
  assert.ok(html.includes('第一行\nSecond line'))
  assert.match(html, /Confidence/)
  assert.match(html, /0%/)
})
test('unknown confidence stays absent instead of being shown as zero', async () => {
  for (const confidence of [null, undefined, '', ' ', -1, 101, 2.5, NaN]) {
    const html = await render({ text: 'reason', confidence })
    assert.ok(html.includes('reason'))
    assert.ok(!html.includes('Confidence'))
  }
})
test('accepts the percentage boundaries and serialized numeric confidence', async () => {
  for (const confidence of [0, 100, '0', '75']) assert.ok((await render({ text: 'reason', confidence })).includes(`${confidence}%`))
})
test('does not create an empty note box on ordinary trades', async () => {
  for (const text of [undefined, null, '', '\n  ']) {
    const html = await render({ text, confidence: null })
    assert.ok(!html.includes('<section'))
    assert.ok(!html.includes('Confidence'))
  }
})
test('escapes uploaded HTML, scripts, links and images as plain text', async () => {
  const html = await render({ text: '<script>alert(1)</script>\n<img src=x onerror=alert(1)> https://example.org', confidence: 90 })
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img '))
  assert.ok(!html.includes('<a '))
})
test('trade history and community/home trade cards compile with the same note component', () => {
  for (const file of ['src/views/buy-sell/RecordList.vue', 'src/components/feed/FeedTradeActivity.vue']) {
    const { descriptor } = parse(read(file), { filename: file })
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ source: descriptor.template.content, filename: file, id: file,
      compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
    assert.match(descriptor.template.content, /<TradeNote\b[^>]*:text="\w+\.noteText"[^>]*:confidence="\w+\.noteConfidence"/)
  }
  for (const locale of ['en','zh']) {
    const labels = JSON.parse(read(`src/lang/locales/${locale}.json`)).tradeNote
    assert.ok(labels.title && labels.confidence)
  }
})

test('confidence-only published trades display the supplied percentage without a fabricated message', async () => {
  const html = await render({ text: '', confidence: 0 })
  assert.ok(html.includes('Confidence'))
  assert.ok(html.includes('0%'))
  assert.ok(!html.includes('<p'))
})
