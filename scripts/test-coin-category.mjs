import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const source = readFileSync(new URL('../src/utils/coinCategory.ts', import.meta.url), 'utf8')
const context = { exports: {} }
runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context)
const { isMemeEtf } = context.exports
for (const [chain, version, expected] of [[4663, 11, true], [4663, '14', true], [4663, 9, false], [4663, 13, false], [56, 11, false], [56, 13, true], [56, 14, true]]) {
  assert.equal(isMemeEtf({ version, isImport: 0 }, chain), expected)
  assert.equal(isMemeEtf({ version, isImport: 1 }, chain), false)
}
console.log('Coin category chain, version and imported-token checks passed')
