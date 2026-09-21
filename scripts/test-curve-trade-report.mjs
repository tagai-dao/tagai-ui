import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { encodeEventTopics, encodeAbiParameters } from 'viem'

async function load(path) {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from 'viem'/g, `from '${import.meta.resolve('viem')}'`)
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}
const { curveTradeReports, curveTradeEvent } = await load('src/utils/curveTradeReport.ts')
const { curveRefreshFrom, replaceCandleTail } = await load('src/utils/curveCandleTail.ts')
const token = '0x' + 'a'.repeat(40)
const buyer = '0x' + 'b'.repeat(40)
const sellsman = '0x' + 'c'.repeat(40)
const hash = '0x' + 'd'.repeat(64)
function log(logIndex, address = token, isBuy = true) {
  return { address, logIndex, topics: encodeEventTopics({ abi: [curveTradeEvent], eventName: 'Trade', args: { buyer, sellsman } }),
    data: encodeAbiParameters([{ type: 'bool' }, ...Array(4).fill({ type: 'uint256' })],
      [isBuy, 2n * 10n ** 18n, 10n ** 18n, 100n, 200n]) }
}
const receipt = { status: 'success', transactionHash: hash, blockNumber: 100n, transactionIndex: 3,
  logs: [log(4), log(5, token, false), log(6, buyer)] }

test('reports actual receipt values and keeps multiple logs in one transaction', () => {
  const rows = curveTradeReports(receipt, token, 12345)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.logIndex), [4, 5])
  assert.deepEqual(rows.map(row => row.isBuy), [true, false])
  assert.equal(rows[0].tokenAmount, '2000000000000000000')
  assert.equal(rows[0].ethAmount, '1000000000000000000')
  assert.equal(rows[0].blockNumber, 100)
  assert.equal(rows[0].timestamp, 12345)
  assert.equal(rows[0].transHash, hash)
})
test('reverted receipts and unrelated token logs are never reported', () => {
  assert.deepEqual(curveTradeReports({ ...receipt, status: 'reverted' }, token, 12345), [])
  assert.deepEqual(curveTradeReports(receipt, sellsman, 12345), [])
})
test('chart refresh stays behind unresolved data and replaces corrected minutes', () => {
  const current = [{ timestamp: 60 }, { timestamp: 120, pending: true }, { timestamp: 2400 }]
  assert.equal(curveRefreshFrom(current), 120)
  assert.deepEqual(replaceCandleTail(current, [{ timestamp: 180 }, { timestamp: 2400 }], 120),
    [{ timestamp: 60 }, { timestamp: 180 }, { timestamp: 2400 }])
  assert.deepEqual(replaceCandleTail(current, [], 120), [{ timestamp: 60 }])
  assert.equal(curveRefreshFrom([{ timestamp: 2400 }]), 1800)
})
