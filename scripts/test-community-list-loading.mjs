import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const source = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'home-test' }).content
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const ListType = { MarketCap: 0, Trending: 1, New: 2 }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const flush = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
const token = (id, isImport = 0) => ({ token: `0x${id}`, tick: id, isImport, marketCap: '1' })

// Run the actual SFC setup with Vue reactivity and controlled network/lifecycle
// boundaries so old responses can be delivered in a deterministic order.
function setup() {
  const calls = [], hooks = {}, snapshots = new Map(), errors = []
  const scope = Vue.effectScope()
  const shared = Vue.reactive({ newCommunities: [], trendingCommunities: [], marketCapCommunities: [] })
  const chain = Vue.reactive({ activeChainId: 4663, deployment: { key: 'bsc' } })
  const state = Vue.reactive({ activeMainMenu: 'coin', coinSubMenu: 'tagCoin', ethPrice: 1 })
  const fixture = { hydrate: async rows => rows }
  const request = (kind, catalog = false) => (page, source) => {
    const pending = deferred()
    calls.push({ kind, page, source, chain: chain.activeChainId, ...pending })
    return catalog ? pending.promise.then(rows => ({ rows, hasMore: rows.length >= 30, nextPage: page + 1, catalogId: 'test-catalog' })) : pending.promise
  }
  const modules = {
    vue: { ...Vue, ...Object.fromEntries(['onMounted', 'onActivated', 'onDeactivated', 'onUnmounted'].map(name => [name, fn => { hooks[name] = fn }])) },
    '@/types': { ListType, MindShareType: { Project: 1 }, GlobalModalType: {} },
    '@/apis/api': { getCommunitiesByNew: request('ticker'), getTokenCatalogPage: (sort, source, page = 0) => request(sort, true)(page, source) },
    '@/stores/community': { useCommunityStore: () => shared },
    '@/stores/chain': { useChainStore: () => chain },
    '@/stores/common': { useStateStore: () => state, useModalStore: () => ({}) },
    '@/stores/curation': { useCurationStore: () => ({ allSpaces: [] }) },
    '@/stores/tweets': { useTweetsStore: () => ({}) },
    '@/stores/web3': { useAccountStore: () => ({}) },
    'vue-router': { useRouter: () => ({}), useRoute: () => ({ name: 'home' }) },
    '@/utils/pump': { getTokenInfo: (...args) => fixture.hydrate(...args) },
    '@/utils/notify': { handleErrorTip: error => errors.push(error) },
    '@/utils/publicSnapshot': { readPublicSnapshot: key => snapshots.get(key), writePublicSnapshot: (key, rows) => snapshots.set(key, JSON.parse(JSON.stringify(rows))) },
    '@/composables/useTools': { usePageScroll: () => ({}) },
    '@/config/bstocks': { isBStockCommunity: () => false },
  }
  const module = { exports: {} }
  new Function('require', 'exports', 'localStorage', transpile(compiled))(
    name => {
      if (modules[name]) return modules[name]
      if (name.endsWith('.vue') || ['@/utils/emitter', '../utils/helper', '@/utils/format', '@/utils/chainFilter', '@/assets/externalSourceLogos'].includes(name)) return {}
      throw Error(`Missing mock ${name}`)
    }, module.exports, { getItem: () => 'false', setItem() {} },
  )
  const model = scope.run(() => module.exports.default.setup({}, { expose() {} }))
  return { model, calls, hooks, shared, chain, state, fixture, snapshots, errors, dispose: () => scope.stop() }
}

test('category switches filter cached rows and request the selected source', async t => {
  const f = setup(); t.after(f.dispose)
  const rows = [
    { ...token('legacy'), version: 12 },
    { ...token('etf'), version: 13 },
    { ...token('etf-string'), version: '13' },
    { ...token('import', 1), version: 10 },
  ]
  assert.deepEqual(f.model.filterTagCoins(rows).map(row => row.tick), ['legacy', 'etf', 'etf-string', 'import'])
  for (const [source, expected] of [
    ['memeetf', ['etf', 'etf-string']],
    ['launch', ['legacy']],
    ['import', ['import']],
  ]) {
    f.model.switchTagCoinSource(source)
    const call = f.calls.at(-1)
    assert.equal(call.source, source)
    call.resolve(rows); await flush()
    assert.deepEqual(f.model.filterTagCoins(f.model.currentCoinList.value).map(row => row.tick), expected)
  }
})

test('other route/store refreshes cannot erase Launch communities', async t => {
  const f = setup(); t.after(f.dispose)
  f.model.switchTagCoinSource('launch')
  f.calls[0].resolve([token('launch')]); await flush()
  f.shared.trendingCommunities = [token('import', 1)]
  assert.deepEqual(f.model.filterTagCoins(f.model.currentCoinList.value).map(x => x.tick), ['launch'])
})

test('slow All refresh and metrics cannot overwrite the selected Launch source', async t => {
  const f = setup(); t.after(f.dispose)
  const first = f.model.refresh()
  f.model.switchTagCoinSource('launch')
  f.calls[1].resolve([token('launch')]); await flush()
  f.calls[0].resolve([token('import', 1)]); await first
  assert.equal(f.model.currentCoinList.value[0].tick, 'launch')
  const metrics = deferred(); f.fixture.hydrate = () => metrics.promise
  const refresh = f.model.refresh(); f.calls[2].resolve([token('old-launch')]); await refresh
  f.model.switchTagCoinSource('import')
  f.fixture.hydrate = async rows => rows
  f.calls[3].resolve([token('import', 1)]); await flush()
  metrics.resolve([token('old-launch')]); await flush()
  assert.equal(f.model.currentCoinList.value[0].tick, 'import')
})

test('New ticker refresh does not replace or append to a filtered New ranking', async t => {
  const f = setup(); t.after(f.dispose)
  f.model.listType.value = ListType.New; await Vue.nextTick()
  f.calls[0].resolve([]); await flush()
  f.model.switchTagCoinSource('launch'); f.calls[1].resolve([token('launch')]); await flush()
  const ticker = f.model.getNewCommunities()
  assert.equal(f.calls[2].source, 'all')
  f.calls[2].resolve([token('import', 1)]); await ticker; await flush()
  assert.deepEqual(f.model.currentCoinList.value.map(x => x.tick), ['launch'])
  assert.equal(f.model.scrollNewCommunities.value[0].tick, 'import')
})

test('source/chain changes discard stale pagination and errors', async t => {
  for (const change of ['source', 'chain']) {
    const f = setup(); t.after(f.dispose)
    const initial = f.model.refresh()
    f.calls[0].resolve(Array.from({ length: 30 }, (_, i) => token(`old${i}`))); await initial
    const page = f.model.loadMore()
    if (change === 'source') f.model.switchTagCoinSource('launch')
    else { f.chain.activeChainId = 56; await Vue.nextTick() }
    f.calls.find((call, i) => i >= 2 && call.kind === 'trending').resolve([token('current')]); await flush()
    f.calls[1].resolve([token('obsolete')]); await page
    assert.deepEqual(f.model.currentCoinList.value.map(x => x.tick), ['current'])
    assert.equal(f.model.loading.value, false)
    assert.equal(f.model.loadFailed.value, false)
  }
})

test('cached/deactivated page ignores responses and refresh events', async t => {
  const f = setup(); t.after(f.dispose)
  const request = f.model.refresh()
  f.hooks.onDeactivated()
  f.calls[0].resolve([token('obsolete')]); await request
  await f.model.refresh(); f.model.retryVisibleList()
  assert.equal(f.calls.length, 1)
  assert.equal(f.model.currentCoinList.value.length, 0)
})

test('endpoint failure keeps selected ranking instead of silently changing sort', async t => {
  const f = setup(); t.after(f.dispose)
  f.snapshots.set('4663:token-list:0:all', [token('other-sort')])
  const request = f.model.refresh()
  f.calls[0].reject(Error('offline')); await request
  assert.equal(f.model.listType.value, ListType.Trending)
  assert.equal(f.model.loadFailed.value, true)
  const retry = f.model.refresh(); f.calls[1].resolve([]); await retry
  assert.equal(f.model.loadFailed.value, false)
  assert.equal(f.model.listLoaded.value, true)
  assert.equal(f.model.currentCoinList.value.length, 0)
})

test('Layout mounts only one route even when CSS-hidden elements mount', () => {
  const { descriptor } = parse(readFileSync(new URL('../src/layout/Layout.vue', import.meta.url), 'utf8'))
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'Layout.vue', id: 'layout-test' })
  assert.deepEqual(compiled.errors, [])
  const module = { exports: {} }
  new Function('require', 'exports', transpile(compiled.code))(() => Vue, module.exports)
  let mounts = 0
  const page = { name: 'HomeView', setup() { mounts++; return () => Vue.h('article') } }
  const passthrough = { setup: (_, { slots }) => () => slots.default?.() }
  const node = () => ({ children: [], style: {} })
  const renderer = Vue.createRenderer({
    createElement: node, createText: node, createComment: node, patchProp() {},
    insert(child, parent, anchor) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1) },
    setText() {}, setElementText() {}, parentNode: child => child.parent,
    nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  })
  {
    mounts = 0
    const app = renderer.createApp({
      render: module.exports.render,
      setup: () => ({ cachedComponents: ['HomeView'], modalStore: {}, GlobalModalType: {} }),
    })
    app.config.globalProperties.$route = { name: 'home', meta: { tabBar: true, topBar: true } }
    app.config.warnHandler = () => {}
    app.component('WrappedReactComponent', passthrough)
    app.component('RouterView', { setup: (_, { slots }) => () => slots.default({ Component: page }) })
    app.component('ElDialog', { render: () => null })
    app.mount(node())
    assert.equal(mounts, 1, 'CSS-hidden outlets still mount their children')
    app.unmount()
  }
})
