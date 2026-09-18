import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const built = await build({ entryPoints: ['src/utils/commentBuyForm.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { commentBuyAmount, commentBuyExecutionFee, commentBuyGrantChanged, commentBuyFundingPlan, commentBuyLimitIssue, COMMENT_BUY_SLIPPAGE_BPS, normalizeLegacyCommentBuyGrant } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
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
test('system slippage protection is 5%', () => {
  assert.equal(COMMENT_BUY_SLIPPAGE_BPS, 500)
})
test('legacy grant reads preserve slippage, enabled status and all spending fields', () => {
  const legacy = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 300, 100, true]
  assert.deepEqual(normalizeLegacyCommentBuyGrant(legacy), [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 100, true])
  assert.equal(normalizeLegacyCommentBuyGrant([...legacy.slice(0, 11), false])[10], false)
})
test('unchanged grant uses pure deposit, preserving remaining budget and exact expiry', () => {
  const grant = [10000000000000000n, 1530000000000000n, 5000000000000000n, 500000000000000n, 2000000000n, 3n, 0n, 1000000000000000n, 1n, 500, true]
  const form = { budget: '0.01', perTrade: '0.00153', perDay: '0.005', days: 'keep' }
  assert.equal(commentBuyGrantChanged(form, grant), false)
  assert.equal(commentBuyGrantChanged({ ...form, budget: '0.0100' }, grant), false)
  assert.deepEqual(commentBuyFundingPlan('0.02', commentBuyGrantChanged(form, grant)), { functionName: 'deposit', value: 20000000000000000n })
  for (const change of [{ budget: '0.02' }, { perTrade: '0.002' }, { perDay: '0.006' }, { days: '7' }]) {
    assert.equal(commentBuyGrantChanged({ ...form, ...change }, grant), true)
  }
})
test('new or changed grant and deposit produce one payable authorize call', () => {
  assert.equal(commentBuyGrantChanged({ budget: '0.01', perTrade: '0.002', perDay: '0.005', days: '7' }), true)
  assert.deepEqual(commentBuyFundingPlan('0.01', true), { functionName: 'authorize', value: 10000000000000000n })
  for (const amount of ['0', '-1', '1e-3', '', '0.0000000000000000001']) assert.throws(() => commentBuyFundingPlan(amount, true), /INVALID_DEPOSIT/)
})
test('all-in limits honor contract constraints', () => {
  assert.equal(commentBuyLimitIssue('0.0011', '0.0011', '0.0011'), null)
  assert.equal(commentBuyLimitIssue('0.01', '0.02', '0.02'), 'total')
  assert.equal(commentBuyLimitIssue('0.02', '0.02', '0.01'), 'daily')
  assert.equal(commentBuyLimitIssue('0', '0.001', '0.002'), 'amount')
})
