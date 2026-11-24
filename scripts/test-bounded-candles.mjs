import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const exports = {}
const source = readFileSync('src/utils/boundedCandles.ts', 'utf8')
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports)
const { boundedCandles } = exports
test('overlapping incremental responses replace candles instead of growing forever', () => {
  let rows = []
  for (let i = 0; i < 20000; i++) rows = boundedCandles([...rows, { timestamp: i % 100, close: i }])
  assert.equal(rows.length, 100)
  assert.equal(rows[99].close, 19999)
})
test('retains the newest bounded chronological history and rejects invalid timestamps', () => {
  const rows = Array.from({ length: 12000 }, (_, timestamp) => ({ timestamp })).reverse()
  const result = boundedCandles([...rows, { timestamp: NaN }])
  assert.equal(result.length, 10000)
  assert.equal(result[0].timestamp, 2000)
  assert.equal(result.at(-1).timestamp, 11999)
})
