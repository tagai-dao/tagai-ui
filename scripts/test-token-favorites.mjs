import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { reactive } from 'vue'
import * as pinia from 'pinia'
const { createPinia, setActivePinia } = pinia
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const require = createRequire(import.meta.url)
function loadTs(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('require', 'exports', js)(id => mocks[id] || require(id), exports)
  return exports
}
function fixture(fetcher) {
  setActivePinia(createPinia())
  const account = reactive({ getAccountInfo: { twitterId: 'alice' } })
  const chain = reactive({ activeChainId: 56 })
  const calls = []
  const { useTokenFavoritesStore } = loadTs('../src/stores/tokenFavorites.ts', {
    pinia,
    './web3': { useAccountStore: () => account },
    './chain': { useChainStore: () => chain },
    '@/apis/tokenFavorites': { favoriteRequest: async (...args) => { calls.push(args); return fetcher(...args) } },
  })
  return { store: useTokenFavoritesStore(), account, chain, calls }
}
const token = { address: `0x${'ab'.repeat(20)}`, chainId: 56, kind: 'community', name: 'Imported', symbol: 'TEST', logo: '' }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('Coin is the default for every login state and explicit selections survive navigation', () => {
  const { resolveCoinTab } = loadTs('../src/utils/coinTabs.ts')
  assert.equal(resolveCoinTab(undefined, false), 'tagCoin')
  assert.equal(resolveCoinTab(undefined, true), 'tagCoin')
  for (const loggedIn of [true, false]) {
    assert.equal(resolveCoinTab('unknown', loggedIn), 'tagCoin')
    assert.equal(resolveCoinTab('tagcoin', loggedIn), 'tagCoin')
    assert.equal(resolveCoinTab('watchlist', loggedIn), 'watchlist')
    assert.equal(resolveCoinTab('baskets', loggedIn), 'baskets')
    assert.equal(resolveCoinTab('bstocks', loggedIn), 'bStocks')
  }
})

test('all token kinds can be saved and removed, without duplicate rapid-click mutations', async () => {
  const mutation = deferred()
  const { store, calls } = fixture(action => action === 'list' ? [] : mutation.promise)
  await store.load()
  const first = store.toggle(token)
  const second = store.toggle(token)
  await Promise.resolve()
  mutation.resolve({ favorite: true })
  await Promise.all([first, second])
  assert.equal(calls.filter(row => row[0] === 'set').length, 1)
  assert.equal(store.entries.length, 1)
  assert.equal(store.contains(token.address.toUpperCase()), true)
  await store.toggle(token)
  assert.equal(store.entries.length, 0)
  await store.toggle({ ...token, kind: 'basket' })
  assert.equal(store.entries[0].kind, 'basket')
})

test('failed writes keep existing membership and allow retry', async () => {
  let fail = true
  const { store } = fixture(action => {
    if (action === 'list') return [token]
    if (fail) throw Error('offline')
    return {}
  })
  await assert.rejects(store.toggle(token), /offline/)
  assert.equal(store.contains(token.address), true)
  assert.equal(store.isPending(token.address), false)
  fail = false
  await store.toggle(token)
  assert.equal(store.entries.length, 0)
})

test('late list responses cannot leak across account or chain switches', async () => {
  for (const change of ['account', 'chain']) {
    const read = deferred()
    const { store, account, chain } = fixture(() => read.promise)
    const loading = store.load()
    if (change === 'account') account.getAccountInfo = { twitterId: 'bob' }
    else chain.activeChainId = 4663
    read.resolve([token])
    await loading
    assert.deepEqual(store.entries, [])
    assert.equal(store.loaded, false)
    assert.equal(store.loading, false)
  }
})

test('late writes cannot restore a logged-out account or contaminate a new chain', async () => {
  const write = deferred()
  const { store, account } = fixture(action => action === 'list' ? [] : write.promise)
  await store.load()
  const saving = store.toggle(token)
  await Promise.resolve()
  account.getAccountInfo = { twitterId: '' }
  write.resolve({})
  await saving
  assert.deepEqual(store.entries, [])
  assert.equal(store.isPending(token.address), false)
})

test('unauthenticated and wrong-chain mutations do not send requests', async () => {
  const { store, account, calls } = fixture(() => [])
  await store.toggle({ ...token, chainId: 4663 })
  account.getAccountInfo = { twitterId: '' }
  await store.toggle(token)
  assert.equal(calls.length, 0)
})

test('session restoration cannot redirect Coin to Watchlist', () => {
  const source = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /switchCoinTab\(accountId\s*\?/)
  assert.match(source, /token-navigation-tab/)
  assert.doesNotMatch(source, /\$t\('tagCoin'\)/)
})

for (const file of ['views/HomeView.vue', 'layout/TopBar.vue', 'components/common/TokenFavoriteButton.vue', 'views/home/TokenWatchlist.vue', 'views/tag-detail/HomeTagDetail.vue', 'views/baskets/BasketDetailView.vue', 'components/feed/FeedTokenDetailSheet.vue']) {
  test(`${file} compiles`, () => {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    const { descriptor, errors } = parse(source, { filename: file })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file })
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file,
      compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  })
}
