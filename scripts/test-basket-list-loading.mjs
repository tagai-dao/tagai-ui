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
    getBasketDeployment: () => ({}), listCache: new Map(), isFresh: at => at > 0, isAddress: () => true,
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
  assert.equal(absent.reads(), 1)
const legacy = fixture([basket], [quote])
assert.equal((await legacy.run(56))[0].navPerToken, 1.25)
assert.equal(legacy.reads(), 1)
for (const chainId of [56, 4663]) {
  const missing = fixture([{ ...basket, performance: null }], [quote])
  assert.equal((await missing.run(chainId))[0].navPerToken, 1.25, 'Null embedded quotes must recover')
  const emptyRows = [{ ...basket, performance: { ...quote, currentNav: null, aumUsd: null } }]
  const recovery = fixture(emptyRows)
  assert.equal((await recovery.run(chainId))[0].navPerToken, 0)
  emptyRows[0].performance = quote
  assert.equal((await recovery.run(chainId))[0].navPerToken, 1.25, 'Unavailable quotes must not be cached fresh')
  const good = await recovery.run(chainId)
  emptyRows[0].performance = { ...quote, currentNav: null, aumUsd: null }
  const preserved = await recovery.run(chainId, { force: true, previous: good })
  assert.equal(preserved[0].navPerToken, 1.25)
  assert.equal(preserved[0].dataQuality, 'stale')
  assert.equal(preserved[0].currentNavAsOf, 123)
  const mixed = fixture([{ ...basket, performance: quote }, {
    ...basket, address: '0x2222222222222222222222222222222222222222', performance: null,
  }])
  assert.equal((await mixed.run(chainId))[0].navPerToken, 1.25, 'A failed supplement must not discard embedded valid quotes')
}
console.log('Basket list snapshot, stale/unavailable and legacy API checks passed for BSC/RH')
