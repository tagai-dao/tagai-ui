import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { effectScope, nextTick, reactive } from 'vue'

const require = createRequire(import.meta.url)
const address = n => `0x${n.repeat(40)}`
const community = { chainId: 56, address: address('1'), kind: 'community', symbol: 'COIN' }
const basket = { chainId: 56, address: address('2'), kind: 'basket', symbol: 'INDEX' }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

function fixture(overrides = {}, entries = [community, basket]) {
  const favorites = reactive({ accountId: 'alice', entries })
  const chain = reactive({ activeChainId: 56 })
  const calls = []
  const api = {
    getEthPrice: async chainId => { calls.push(['native', chainId]); return 700 },
    getCommunityDetail: async (symbol, chainId) => {
      calls.push(['community', symbol, chainId])
      return { token: community.address, chainId, marketCap: 33 }
    },
    getBasketPerformances: async (addresses, chainId) => {
      calls.push(['nav', addresses, chainId])
      return [{ address: basket.address, currentNav: '1.2345', dataQuality: 'complete' }]
    },
    getBasketDetail: async () => { throw Error('Unexpected NAV fallback') },
    ...overrides,
  }
  const mocks = {
    '@/apis/api': api,
    '@/utils/baskets/api': api,
    '@/utils/baskets/data': api,
    '@/stores/tokenFavorites': { useTokenFavoritesStore: () => favorites },
    '@/stores/chain': { useChainStore: () => chain },
  }
  const source = readFileSync(new URL('../src/composables/useWatchlistMetrics.ts', import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('require', 'exports', js)(id => mocks[id] || require(id), exports)
  const scope = effectScope()
  const metrics = scope.run(() => exports.useWatchlistMetrics())
  return { metrics, favorites, chain, calls, stop: () => scope.stop() }
}

test('converts native market cap to USD but leaves basket NAV in USD', async () => {
  const f = fixture()
  try {
    await f.metrics.refresh()
    assert.equal(f.metrics.values.value[community.address], 23100)
    assert.equal(f.metrics.values.value[basket.address], 1.2345)
    assert.equal(f.calls.filter(call => call[0] === 'nav').length, 1)
    assert.ok(f.calls.every(call => call.at(-1) === 56))
  } finally { f.stop() }
})

test('incomplete NAV snapshots use the fully priced index detail fallback', async () => {
  const f = fixture({
    getBasketPerformances: async () => [{ address: basket.address, currentNav: '900', dataQuality: 'partial' }],
    getBasketDetail: async (requested, chainId) => ({ address: requested, chainId, navPerToken: 0.9876, fullyPriced: true }),
  }, [basket])
  try {
    await f.metrics.refresh()
    assert.equal(f.metrics.values.value[basket.address], 0.9876)
    assert.ok(f.calls.every(call => call[0] !== 'native'))
  } finally { f.stop() }
})

test('mismatched contracts and unpriced indices remain unavailable', async () => {
  const f = fixture({
    getCommunityDetail: async () => ({ token: address('3'), marketCap: 9999 }),
    getBasketPerformances: async () => [],
    getBasketDetail: async () => ({ address: basket.address, chainId: 56, navPerToken: 0.25, fullyPriced: false }),
  })
  try {
    await f.metrics.refresh()
    assert.deepEqual(f.metrics.values.value, {})
  } finally { f.stop() }
})

test('a failed refresh preserves the last valid values', async () => {
  let fail = false
  const f = fixture({ getCommunityDetail: async () => {
    if (fail) throw Error('offline')
    return { token: community.address, chainId: 56, marketCap: 33 }
  } }, [community])
  try {
    await f.metrics.refresh()
    fail = true
    await f.metrics.refresh(true)
    assert.equal(f.metrics.values.value[community.address], 23100)
  } finally { f.stop() }
})

test('late reads cannot restore metrics after logout or a network switch', async () => {
  for (const change of ['account', 'chain']) {
    const read = deferred()
    const f = fixture({ getCommunityDetail: () => read.promise }, [community])
    try {
      const loading = f.metrics.refresh()
      await nextTick()
      if (change === 'account') f.favorites.accountId = ''
      else f.chain.activeChainId = 4663
      await nextTick()
      read.resolve({ token: community.address, chainId: 56, marketCap: 33 })
      await loading
      assert.deepEqual(f.metrics.values.value, {})
    } finally { f.stop() }
  }
})
