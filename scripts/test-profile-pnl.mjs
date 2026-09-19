import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'

// Render the actual SFC with a tiny host, so async state and button behavior are
// exercised without booting wallet providers or reaching production services.
const filename = 'ProfilePnlCard.vue'
const { descriptor } = parse(readFileSync(new URL('../src/components/profile/ProfilePnlCard.vue', import.meta.url), 'utf8'), { filename })
const script = compileScript(descriptor, { id: 'pnl-test', inlineTemplate: true })
const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const settle = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
const node = (type, text = '') => ({ type, text, children: [], props: {}, parent: null })
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1],
  patchProp: (n, key, previous, next) => { n.props[key] = next },
  remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1) },
  insert(n, parent, anchor) {
    if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1)
    n.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(n); else parent.children.splice(index, 0, n)
  },
})
const text = n => (n.type === 'comment' ? '' : n.text) + n.children.map(text).join(' ')
const find = (n, match) => match(n) ? n : n.children.map(child => find(child, match)).find(Boolean)
function mount(fetcher) {
  const chain = Vue.reactive({ activeChainId: 56 })
  const props = Vue.reactive({ username: 'trader' })
  const exports = {}
  const dependencies = {
    vue: Vue, 'vue-i18n': { useI18n: () => ({ locale: Vue.ref('en') }) },
    '@/apis/api': { getAccountPnl: fetcher }, '@/stores/chain': { useChainStore: () => chain },
    '@/utils/format': { formatUsd: n => `$${n}`, formatUsdCompact: n => `$${n}` },
  }
  new Function('require', 'exports', code)(name => dependencies[name], exports)
  const root = node('root')
  const app = renderer.createApp({ render: () => Vue.h(exports.default, props) })
  app.config.warnHandler = () => {}
  app.mount(root)
  return { root, chain, props, app }
}
const base = { chainId: 56, chain: 'bsc', period: '7d', hasData: false, points: [] }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('missing data and failed requests never display a fabricated $0', async () => {
  for (const fetcher of [async () => base, async () => { throw Error('offline') }]) {
    const view = mount(fetcher)
    await settle()
    assert.ok(!text(view.root).includes('$0'))
    assert.ok(text(view.root).includes('—'))
    view.app.unmount()
  }
})
test('real native zero is displayed, with coverage and a real supplied curve', async () => {
  const view = mount(async () => ({ ...base, source: 'tagai', calculation: 'indexed-realized-v1', hasData: true,
    pnlNative: 0, nativeSymbol: 'BNB', points: [{ timestamp: '2026-09-18', pnlNative: 0 }, { timestamp: '2026-09-19', pnlNative: 0 }] }))
  await settle()
  assert.ok(text(view.root).includes('0 BNB'))
  assert.ok(text(view.root).includes('Partial coverage'))
  assert.ok(find(view.root, n => n.type === 'polyline'))
  view.app.unmount()
})
test('an external total without history does not fabricate a chart', async () => {
  const view = mount(async () => ({ ...base, hasData: true, source: 'fomo', pnlUsd: 42 }))
  await settle()
  assert.ok(text(view.root).includes('$42'))
  assert.ok(!find(view.root, n => n.type === 'polyline'))
  view.app.unmount()
})
test('late responses cannot replace data after switching chain', async () => {
  const old = deferred()
  let calls = 0
  const view = mount(() => ++calls === 1 ? old.promise : Promise.resolve({ ...base, chainId: 4663, chain: 'rh', hasData: true, pnlUsd: 9 }))
  view.chain.activeChainId = 4663
  await settle()
  old.resolve({ ...base, hasData: true, pnlUsd: 999 })
  await settle()
  assert.equal(calls, 2)
  assert.ok(text(view.root).includes('$9'))
  assert.ok(!text(view.root).includes('$999'))
  view.app.unmount()
})
test('clearing identity invalidates outstanding requests', async () => {
  const pending = deferred()
  const view = mount(() => pending.promise)
  view.props.username = ''
  await settle()
  pending.resolve({ ...base, hasData: true, pnlUsd: 999 })
  await settle()
  assert.ok(!text(view.root).includes('$999'))
  assert.ok(!find(view.root, n => n.props['aria-busy']))
  view.app.unmount()
})
test('retry button recovers a failed request', async () => {
  let calls = 0
  const view = mount(async () => { if (++calls === 1) throw Error('offline'); return { ...base, hasData: true, pnlUsd: -3 } })
  await settle()
  const retry = find(view.root, n => n.type === 'button' && text(n) === 'Retry')
  assert.ok(retry)
  await retry.props.onClick()
  await settle()
  assert.ok(text(view.root).includes('$-3'))
  view.app.unmount()
})
