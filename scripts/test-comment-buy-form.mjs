import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const built = await build({ entryPoints: ['src/utils/commentBuyForm.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { commentBuyAmount, commentBuyExecutionFee, commentBuyFeeReserve, commentBuyLimitIssue, COMMENT_BUY_SLIPPAGE_BPS, COMMENT_BUY_PROTOCOL_CAP_BPS } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
test('BNB amounts are exact, including one wei', () => {
  assert.equal(commentBuyAmount('0.0011'), 1100000000000000n)
  assert.equal(commentBuyAmount('0.000000000000000001'), 1n)
  assert.equal(commentBuyAmount('0'), 0n)
})
test('reject invalid amounts and excess precision instead of rounding', () => {
  for (const input of ['', '-1', 'NaN', '1e-3', '0.0000000000000000001', '1.2.3', '1,000', '9'.repeat(90)]) assert.equal(commentBuyAmount(input), null, input)
})
test('execution fee is read exactly from API wei; invalid config never falls back to zero', () => {
  assert.equal(commentBuyExecutionFee('500000000000000'), 500000000000000n)
  assert.equal(commentBuyExecutionFee('0'), 0n)
  for (const input of [undefined, null, 500000000000000, '', '-1', '5e14', '0.0005', '9'.repeat(31)]) assert.equal(commentBuyExecutionFee(input), null)
})
test('system protection is 5% with protocol cap retained; suggested reserve covers fixed execution fee', () => {
  assert.equal(COMMENT_BUY_SLIPPAGE_BPS, 500)
  assert.equal(COMMENT_BUY_PROTOCOL_CAP_BPS, 300)
  assert.equal(commentBuyFeeReserve(1000000000000000n, 500000000000000n), 530000000000000n)
  assert.equal(commentBuyFeeReserve(1n, 500000000000000n), 500000000000001n)
})
test('all-in limits honor contract constraints', () => {
  assert.equal(commentBuyLimitIssue('0.0011', '0.0011', '0.0011'), null)
  assert.equal(commentBuyLimitIssue('0.01', '0.02', '0.02'), 'total')
  assert.equal(commentBuyLimitIssue('0.02', '0.02', '0.01'), 'daily')
  assert.equal(commentBuyLimitIssue('0', '0.001', '0.002'), 'amount')
})
