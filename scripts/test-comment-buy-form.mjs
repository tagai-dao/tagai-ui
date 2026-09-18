import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const built = await build({ entryPoints: ['src/utils/commentBuyForm.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { commentBuyAmount, commentBuyBps, commentBuyLimitIssue } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
test('BNB amounts are exact, including one wei', () => {
  assert.equal(commentBuyAmount('0.0011'), 1100000000000000n)
  assert.equal(commentBuyAmount('0.000000000000000001'), 1n)
  assert.equal(commentBuyAmount('0'), 0n)
})
test('reject invalid amounts and excess precision instead of rounding', () => {
  for (const input of ['', '-1', 'NaN', '1e-3', '0.0000000000000000001', '1.2.3', '1,000', '9'.repeat(90)]) assert.equal(commentBuyAmount(input), null, input)
})
test('percentages convert exactly to integer bps; existing 3% remains 300', () => {
  for (const [input, expected] of [['3', 300], ['1.01', 101], ['0.29', 29], ['0.01', 1], ['10', 1000], ['0', 0]]) assert.equal(commentBuyBps(input), expected)
})
test('reject unsafe percentages rather than silently clamp the cap', () => {
  for (const input of ['10.01', '-1', '1.001', '', 'NaN', 'Infinity', '1e1']) assert.equal(commentBuyBps(input), null, input)
})
test('all-in limits honor contract constraints', () => {
  assert.equal(commentBuyLimitIssue('0.0011', '0.0011', '0.0011'), null)
  assert.equal(commentBuyLimitIssue('0.01', '0.02', '0.02'), 'total')
  assert.equal(commentBuyLimitIssue('0.02', '0.02', '0.01'), 'daily')
  assert.equal(commentBuyLimitIssue('0', '0.001', '0.002'), 'amount')
})
