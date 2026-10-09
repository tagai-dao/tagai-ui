import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import * as vue from 'vue'
import ts from 'typescript'

const source = readFileSync('src/composables/useDexScreenerPair.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const market = (chain = 'robinhood', token = '0xToken', pair = '0xPair', liquidity = 1) => ({ chainId: chain, baseToken: { address: token }, pairAddress: pair, liquidity: { usd: liquidity } })
function setup(fetcher, initial = {}) {
  const timers = new Map(), intervals = new Map()
  const exports = {}
  new Function('require', 'exports', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', js)(
    () => vue, exports, fetcher,
    (fn, ms) => { timers.set(fn, ms); return fn }, fn => timers.delete(fn),
    fn => { intervals.set(fn, true); return fn }, fn => intervals.delete(fn))
  const input = vue.ref({ chain: 'robinhood', token: '0xToken', preferred: '0xPreferred', enabled: true, ...initial })
  const scope = vue.effectScope()
  const state = scope.run(() => exports.useDexScreenerPair(() => ({ ...input.value })))
  return { ...state, get input() { return input.value }, replaceInput: value => { input.value = value }, scope, timers, intervals, poll: () => [...intervals.keys()][0]?.() }
}
const ok = rows => ({ ok: true, json: async () => rows })

test('unknown, malformed and mismatched markets retain the native chart', async () => {
  for (const rows of [[], null, { error: 'unavailable' }, [null], [market('bsc')], [market('robinhood', '0xOther')], [market('robinhood', '0xToken', '')]]) {
    const s = setup(async () => ok(rows))
    await flush()
    assert.equal(s.useDexScreener.value, false)
    s.scope.stop()
  }
})
test('selects the preferred pool, otherwise the most liquid matching pool, on both chains', async () => {
  for (const chain of ['bsc', 'robinhood']) {
    const rows = [market(chain, '0xToken', '0xSmall', 1), market(chain, '0xToken', '0xLarge', 20), market(chain, '0xToken', '0xPreferred', 2)]
    const s = setup(async () => ok(rows), { chain })
    await flush()
    assert.equal(s.pair.value.pairAddress, '0xPreferred')
    assert.equal(s.useDexScreener.value, true)
    s.input.preferred = '0xUnknown'
    await flush()
    assert.equal(s.pair.value.pairAddress, '0xLarge')
    s.scope.stop()
  }
})
test('initial HTTP and network failures fall back, but later metadata failures preserve the loaded chart', async () => {
  for (const failure of [async () => ({ ok: false }), async () => { throw new Error('offline') }]) {
    let response = failure
    const s = setup(() => response())
    await flush()
    assert.equal(s.useDexScreener.value, false)
    response = async () => ok([market()])
    s.poll(); await flush()
    assert.equal(s.useDexScreener.value, true)
    response = failure
    s.poll(); await flush()
    assert.equal(s.useDexScreener.value, true)
    s.scope.stop()
  }
})
test('10-second timeout aborts the lookup and retains native candles', async () => {
  let signal
  const s = setup((_, options) => new Promise((resolve, reject) => {
    signal = options.signal
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  }))
  assert.deepEqual([...s.timers.values()], [10000])
  ;[...s.timers.keys()][0]()
  await flush()
  assert.equal(signal.aborted, true)
  assert.equal(s.useDexScreener.value, false)
  assert.equal(s.timers.size, 0)
  s.scope.stop()
})
test('late responses cannot restore a previous token or chain, and cleanup stops polling', async () => {
  const requests = []
  const s = setup((url, options) => new Promise(resolve => requests.push({ url, signal: options.signal, resolve })))
  s.input.token = '0xNew'
  s.input.chain = 'bsc'
  assert.equal(requests[0].signal.aborted, true)
  requests.at(-1).resolve(ok([market('bsc', '0xNew', '0xNewPair')]))
  await flush()
  requests[0].resolve(ok([market()]))
  await flush()
  assert.equal(s.pair.value.pairAddress, '0xNewPair')
  s.scope.stop()
  assert.equal(s.intervals.size, 0)
})
test('iframe errors retain the native chart until the market changes; unlisted charts skip lookup', async () => {
  let calls = 0
  const s = setup(async () => { calls++; return ok([market()]) }, { enabled: false })
  assert.equal(calls, 0)
  s.input.enabled = true
  await flush()
  s.onEmbedError()
  assert.equal(s.useDexScreener.value, false)
  s.poll(); await flush()
  assert.equal(s.useDexScreener.value, false)
  s.scope.stop()
})

test('15-second community object replacements retain the chart and do not restart discovery', async () => {
  let calls = 0
  const s = setup(async () => { calls++; return ok([market()]) })
  await flush()
  const confirmed = s.pair.value
  const interval = [...s.intervals.keys()][0]
  const chartTransitions = []
  const stop = vue.watch(s.useDexScreener, value => chartTransitions.push(value), { flush: 'sync' })
  for (let i = 0; i < 5; i++) {
    s.replaceInput({ ...s.input, price: i, progress: i })
    await flush()
    assert.equal(s.pair.value, confirmed)
  }
  assert.equal(calls, 1)
  assert.equal([...s.intervals.keys()][0], interval)
  assert.deepEqual(chartTransitions, [])
  stop()
  s.scope.stop()
})
test('polling updates market metrics without switching pools or clearing a confirmed chart', async () => {
  let rows = [market('robinhood', '0xToken', '0xFirst', 20)]
  const s = setup(async () => ok(rows))
  await flush()
  rows = [{ ...market('robinhood', '0xToken', '0xFirst', 1), priceChange: { h24: 5 } }, market('robinhood', '0xToken', '0xSecond', 50)]
  s.poll(); await flush()
  assert.equal(s.pair.value.pairAddress, '0xFirst')
  assert.equal(s.pair.value.priceChange.h24, 5)
  for (const missing of [[], [market('robinhood', '0xToken', '0xSecond', 50)]]) {
    rows = missing
    s.poll(); await flush()
    assert.equal(s.pair.value.pairAddress, '0xFirst')
    assert.equal(s.useDexScreener.value, true)
  }
  s.scope.stop()
})
