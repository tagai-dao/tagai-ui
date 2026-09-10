import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/utils/pumpVersion.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
new Function('exports', compiled)(exports)
const path = exports.getDexScreenerEmbedPath
const token = '0xbc59192dfad0ef94db82b6dd1a2dd97e040d3333'
test('v13 CyberCab uses token discovery instead of the stale bytes32 pool ID', () => {
  assert.equal(path({version:13, token, pair:'0x1cd9558f31e61dbb984e5242f787196b5919b83a9b2e180480797a9bfdf3bf87'}), token)
})
test('V4 JSON and missing pairs use token; valid legacy pairs remain unchanged', () => {
  for (const pair of ['', '{}', undefined]) assert.equal(path({version:13,token,pair}),token)
  const pair = '0x'+'1'.repeat(40)
  assert.equal(path({version:1,token,pair}),pair)
  assert.equal(path({version:11,token,pair}),token)
  assert.equal(path({isImport:1,token,pair}),token)
})
test('community issued-token Feed requests account-filtered history, full market lists remain default', () => {
  const feed = readFileSync(new URL('../src/views/tag-detail/TagContent.vue', import.meta.url),'utf8')
  const api = readFileSync(new URL('../src/apis/api.ts', import.meta.url),'utf8')
  assert.match(feed,/getTokenTradeList\(community.token, page, !community.isImport\)/)
  assert.match(api,/platformOnly = false/)
  assert.match(api,/platformOnly: '1'/)
  assert.match(feed,/row.isPlatformAccount === true/)
})
