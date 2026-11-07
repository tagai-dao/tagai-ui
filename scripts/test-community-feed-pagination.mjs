import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const { descriptor } = parse(read('src/views/tag-detail/TagContent.vue'))
const compiled = compileScript(descriptor, { id: 'community-feed-test' })
const helpers = { exports: {} }
new Function('exports', transpile(read('src/utils/communityFeed.ts')))(helpers.exports)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); await Vue.nextTick() } }
const post = (id, time) => ({ tweetId: id, tweetTime: time, tick: 'AIPRO' })
const trade = (id, time, platform = true) => ({ transHash: id, timestamp: time, token: '0x123', isPlatformAccount: platform })
const tradePage = (start, platform = true) => Array.from({ length: 30 }, (_, i) => trade(`tx-${start - i}`, start - i, platform))
const itemId = item => item.type === 'post' ? `post:${item.tweet.tweetId}` : `trade:${item.trade.transHash}`

// Execute the real component setup with controllable HTTP and enrichment delays.
function setup(chainId = 56, tick = 'AIPRO', isImport = 0) {
  const calls = [], hooks = {}, snapshots = new Map(), errors = []
  const scope = Vue.effectScope()
  const chain = Vue.reactive({ activeChainId: chainId })
  const community = Vue.reactive({ currentSelectedCommunity: { tick, token: '0x123', isImport } })
  const tweets = Vue.reactive({})
  const fixture = { enrich: async rows => rows }
  const request = kind => (...args) => {
    const pending = deferred()
    calls.push({ kind, args, ...pending })
    return pending.promise
  }
  const modules = {
    vue: { ...Vue, onMounted: fn => { hooks.mounted = fn }, onBeforeUnmount: fn => { hooks.unmount = fn } },
    '@/utils/communityFeed': helpers.exports,
    '@/stores/tweets': { useTweetsStore: () => tweets },
    '@/stores/web3': { useAccountStore: () => ({}) },
    '@/stores/community': { useCommunityStore: () => community },
    '@/stores/chain': { useChainStore: () => chain },
    '@/stores/curation': { useCurationStore: () => ({}) },
    '@/apis/api': Object.fromEntries([
      ['getCommunityNewTweets', 'posts'], ['getTokenTradeList', 'trades'],
      ['getCommunityTrendingTweets', 'trending'], ['getCommunitySpaceTweets', 'space'],
      ['getCommunityTippedTweets', 'tipped'], ['getCommunityCallouts', 'callouts'],
    ].map(([name, kind]) => [name, request(kind)])),
    '@/utils/pump': { getTokenInfoOfTweets: rows => fixture.enrich(rows) },
    '@/utils/eventMarketMetrics': { attachEventMarketMetrics: async rows => rows },
    '@/utils/notify': { handleErrorTip: error => errors.push(error) },
    '@/utils/emitter': { on() {}, off() {} },
    '@/assets/externalSourceLogos': { externalSourceLogos: {} },
    '@/utils/publicSnapshot': {
      readPublicSnapshot: key => snapshots.get(key),
      writePublicSnapshot: (key, rows) => snapshots.set(key, JSON.parse(JSON.stringify(rows))),
    },
  }
  const module = { exports: {} }
  new Function('require', 'exports', transpile(compiled.content))(name => {
    if (modules[name]) return modules[name]
    if (name.endsWith('.vue')) return {}
    throw Error(`Missing mock ${name}`)
  }, module.exports)
  const model = scope.run(() => module.exports.default.setup({}, { expose() {} }))
  return {
    model, calls, chain, community, tweets, fixture, snapshots, errors,
    rows: () => model.feedItems.value.map(itemId),
    dispose() { hooks.unmount?.(); scope.stop() },
  }
}

for (const [chainId, tick, imported] of [[56, 'AIPRO', 0], [56, 'TTAI', 0], [56, 'IMPORTED', 1], [4663, 'RH-COMMUNITY', 0]]) {
  test(`${chainId}/${tick}: first paint waits for both sources; old post appears once at its chronological position`, async t => {
    const f = setup(chainId, tick, imported); t.after(f.dispose)
    assert.equal(f.calls[1].args[2], !imported)
    f.calls[0].resolve([post('old-post', 50)])
    await flush()
    assert.deepEqual(f.rows(), [], 'fast posts must not flash before newer trades arrive')
    f.calls[1].resolve(tradePage(200)); await flush()
    assert.equal(f.rows().length, 30)
    assert.ok(!f.rows().includes('post:old-post'))
    for (const start of [170, 140, 110, 80, 50]) {
      const visible = f.rows()
      const pending = f.model.onLoad()
      const call = f.calls.at(-1)
      assert.equal(call.kind, 'trades', 'do not refetch the exhausted post stream')
      call.resolve(tradePage(start)); await pending; await flush()
      assert.deepEqual(f.rows().slice(0, visible.length), visible, 'pagination must append without moving visible posts down')
      assert.equal(new Set(f.rows()).size, f.rows().length)
    }
    assert.equal(f.rows().filter(id => id === 'post:old-post').length, 1)
    assert.ok(f.rows().indexOf('post:old-post') < f.rows().indexOf('trade:tx-49'))
    const end = f.model.onLoad(); f.calls.at(-1).resolve([]); await end
    assert.equal(f.model.finished.value.all, true)
    const count = f.calls.length; await f.model.onLoad()
    assert.equal(f.calls.length, count, 'EOF must stop loading')
  })
}

test('post-heavy community buffers an older trade until the post stream reaches it', async t => {
  const f = setup(); t.after(f.dispose)
  f.calls[0].resolve(Array.from({ length: 30 }, (_, i) => post(`p-${200 - i}`, 200 - i)))
  f.calls[1].resolve([trade('old-trade', 50)]); await flush()
  assert.equal(f.rows().length, 30)
  assert.ok(!f.rows().includes('trade:old-trade'))
  const pending = f.model.onLoad()
  assert.equal(f.calls.at(-1).kind, 'posts')
  f.calls.at(-1).resolve([post('older-post', 40)])
  await pending; await flush()
  assert.deepEqual(f.rows().slice(-2), ['trade:old-trade', 'post:older-post'])
  assert.equal(f.model.finished.value.all, true)
})

test('filtered trade page does not falsely finish or prevent loading an empty visible window', async t => {
  const f = setup(56, 'IMPORTED', 1); t.after(f.dispose)
  f.calls[0].resolve([post('old-post', 50)])
  f.calls[1].resolve(tradePage(200, false)); await flush()
  assert.deepEqual(f.rows(), [])
  assert.equal(f.model.finished.value.all, false)
  const pending = f.model.onLoad()
  assert.equal(f.calls.at(-1).args[1], 1)
  f.calls.at(-1).resolve([trade('platform-trade', 100)])
  await pending; await flush()
  assert.deepEqual(f.rows(), ['trade:platform-trade', 'post:old-post'])
})

test('overlapping pages are deduplicated in All, FOMO, GMGN, Pump, Tipped, Space, New and Trending', async t => {
  for (const type of ['all', 'fomo', 'gmgn', 'pump', 'tipped', 'space', 'new', 'trending']) {
    const f = setup(); t.after(f.dispose)
    if (type !== 'all') {
      f.model.listType.value = type
      void f.model.onRefresh()
      f.calls[0].resolve([]); f.calls[1].resolve([])
    }
    f.calls.findLast(call => call.kind !== 'trades').resolve(Array.from({ length: 30 }, (_, i) => post(`p-${i}`, 200 - i)))
    if (type === 'all') f.calls[1].resolve([])
    await flush()
    const pending = f.model.onLoad()
    f.calls.at(-1).resolve([post('p-29', 171), post('p-30', 170)])
    await pending; await flush()
    assert.equal(f.rows().length, 31, type)
    assert.equal(new Set(f.rows()).size, 31, type)
  }
})

test('late pagination cannot overwrite a refreshed community or reset its loading state', async t => {
  const f = setup(); t.after(f.dispose)
  f.calls[0].resolve([post('old-post', 50)]); f.calls[1].resolve(tradePage(200)); await flush()
  const oldPage = f.model.onLoad(); const oldCall = f.calls.at(-1)
  const refresh = f.model.onRefresh()
  oldCall.resolve(tradePage(170)); await oldPage
  assert.equal(f.model.refreshing.value, true)
  f.calls.at(-2).resolve([post('fresh-post', 300)])
  f.calls.at(-1).resolve([]); await refresh; await flush()
  assert.deepEqual(f.rows(), ['post:fresh-post'])
})

test('concurrent scroll triggers cannot clear the in-flight page lock or request it twice', async t => {
  const f = setup(); t.after(f.dispose)
  f.calls[0].resolve([]); f.calls[1].resolve(tradePage(200)); await flush()
  const pending = f.model.onLoad()
  const count = f.calls.length
  await f.model.onLoad()
  assert.equal(f.model.loading.value, true)
  await f.model.onLoad()
  assert.equal(f.calls.length, count)
  f.calls.at(-1).resolve([]); await pending
  assert.equal(f.model.loading.value, false)
})

test('a delayed background first-page update cannot reset a feed after pagination', async t => {
  const f = setup(); t.after(f.dispose)
  f.calls[0].resolve([post('p', 50)]); f.calls[1].resolve(tradePage(200)); await flush()
  const pending = f.model.onLoad()
  f.calls.at(-1).resolve(tradePage(170)); await pending; await flush()
  const count = f.calls.length
  f.model.onBackgroundUpdated()
  assert.equal(f.calls.length, count)
  assert.equal(f.rows().length, 60)
})

test('switching community or chain rejects stale HTTP responses even when tick is unchanged', async t => {
  for (const change of ['community', 'chain']) {
    const f = setup(); t.after(f.dispose)
    if (change === 'community') f.community.currentSelectedCommunity = { tick: 'TTAI', token: '0x456', isImport: 0 }
    else f.chain.activeChainId = 4663
    await flush()
    f.calls[2].resolve([post('current', 300)]); f.calls[3].resolve([]); await flush()
    f.calls[0].resolve([post('stale', 500)]); f.calls[1].resolve([trade('stale-trade', 600)]); await flush()
    assert.deepEqual(f.rows(), ['post:current'], change)
  }
})

test('failed page pauses loading and retry fetches only the failed source at the same cursor', async t => {
  for (const failed of ['posts', 'trades']) {
    const f = setup(); t.after(f.dispose)
    f.calls[0][failed === 'posts' ? 'reject' : 'resolve'](failed === 'posts' ? Error('offline') : [post('p', 50)])
    f.calls[1][failed === 'trades' ? 'reject' : 'resolve'](failed === 'trades' ? Error('offline') : tradePage(200))
    await flush()
    assert.equal(f.model.loadFailed.value, true)
    const count = f.calls.length; await f.model.onLoad()
    assert.equal(f.calls.length, count)
    f.model.retryLoadMore()
    assert.equal(f.calls.at(-1).kind, failed)
    assert.equal(f.calls.at(-1).args[failed === 'posts' ? 2 : 1], 0)
    f.calls.at(-1).resolve([]); await flush()
    assert.equal(f.model.loadFailed.value, false)
  }
})

test('component compiles and connects automatic pagination and explicit error retry', () => {
  const template = compileTemplate({ source: descriptor.template.content, filename: 'TagContent.vue', id: 'community-feed-test', compilerOptions: { bindingMetadata: compiled.bindings } })
  assert.deepEqual(template.errors, [])
  assert.match(descriptor.template.content, /@load="onLoad"/)
  assert.match(descriptor.template.content, /@update:error="retryLoadMore"/)
})
