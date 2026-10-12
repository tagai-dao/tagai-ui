import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/utils/baskets/data.ts', import.meta.url), 'utf8')
const start = source.indexOf('export const listBaskets =')
const end = source.indexOf('export const getErc20Balance', start)
const code = ts.transpile(source.slice(start, end).replace('export const', 'const') + '\nglobalThis.run = listBaskets', { target: ts.ScriptTarget.ES2022 })
const address = '0x1111111111111111111111111111111111111111'
const quote = { address, currentNav: '1.25', aumUsd: '125', asOf: 123, toDatePct: 25, dataQuality: 'stale', launchTimeQuality: 'complete' }
const basket = { address, name: 'Example', symbol: 'EX', version: 3, basketLength: 1, createdAt: 1, creator: address, assets: [{ address, symbol: 'ASSET', targetWeightBps: 10000 }] }

function fixture(registered, performance = []) {
  let reads = 0
  const context = vm.createContext({
    getBasketDeployment: () => ({}), listCache: new Map(), isFresh: () => true, isAddress: () => true,
    listRegisteredBaskets: async () => registered,
    getBasketPerformances: async () => { reads++; return performance },
    getReadOnlyClient: () => { throw new Error('List must not block on RPC') },
  })
  vm.runInContext(code, context)
  return { run: context.run, reads: () => reads }
}

for (const chainId of [56, 4663]) {
  const f = fixture([{ ...basket, performance: quote }])
  const result = await f.run(chainId)
  assert.equal(result[0].chainId, chainId)
  assert.equal(result[0].navPerToken, 1.25)
  assert.equal(result[0].aumUsd, 125)
  assert.equal(result[0].dataQuality, 'stale')
  assert.equal(result[0].currentNavAsOf, 123)
  assert.equal(f.reads(), 0, 'New API must not trigger another performance request')
  await f.run(chainId)
  assert.equal(f.reads(), 0)
}
const absent = fixture([{ ...basket, performance: null }])
const unavailable = await absent.run(56)
assert.equal(unavailable[0].navPerToken, 0)
assert.equal(unavailable[0].toDatePct, null)
assert.equal(unavailable[0].dataQuality, 'unavailable')
assert.equal(absent.reads(), 0)
const legacy = fixture([basket], [quote])
assert.equal((await legacy.run(56))[0].navPerToken, 1.25)
assert.equal(legacy.reads(), 1)
console.log('Basket list snapshot, stale/unavailable and legacy API checks passed for BSC/RH')
