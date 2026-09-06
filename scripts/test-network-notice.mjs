import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
const source = await readFile(new URL('../src/utils/networkNotice.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { createNetworkNoticeGate, isNetworkFailure } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('eight simultaneous errors display one notice', () => {
  const gate = createNetworkNoticeGate(() => 0)
  assert.equal(Array.from({ length: 8 }, () => gate.acquire()).filter(Boolean).length, 1)
})
test('visible notices and cooldown prevent repeated stacks; later outages are reported', () => {
  let now = 0
  const gate = createNetworkNoticeGate(() => now)
  assert.equal(gate.acquire(), true)
  now = 20000
  assert.equal(gate.acquire(), false)
  gate.release()
  assert.equal(gate.acquire(), true)
  gate.release()
  now += 1000
  assert.equal(gate.acquire(), false)
  now += 15000
  assert.equal(gate.acquire(), true)
})
test('only transport messages are grouped; business and transaction failures remain distinct', () => {
  for (const text of ['Network Error', 'timeout of 30000ms exceeded', 'Failed to fetch', 'Load failed']) assert.equal(isNetworkFailure(text), true)
  for (const text of ['Not a valid sellsman', 'User rejected transaction', 'HTTP request failed.', 'Request failed with status code 403', undefined]) assert.equal(isNetworkFailure(text), false)
})
for (const file of ['views/HomeView.vue', 'views/home/HomePost.vue']) {
  test(`${file} compiles and pauses pagination with an explicit retry`, async () => {
    const text = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
    const { descriptor } = parse(text)
    compileScript(descriptor, { id: file })
    const result = compileTemplate({ source: descriptor.template.content, filename: file, id: file })
    assert.deepEqual(result.errors, [])
    assert.match(text, /:error="loadFailed"/)
    assert.match(text, /<template #error>/)
    assert.match(text, /loadFailed\.value = true/)
    assert.match(text, /loadFailed\.value = false/)
  })
}
