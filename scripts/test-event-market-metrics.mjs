import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const exports = {}
new Function('exports', ts.transpileModule(readFileSync(new URL('../src/utils/eventMarketMetrics.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports)
const { attachEventMarketMetrics, eventTimestamp } = exports
const token = `0x${'ab'.repeat(20)}`

test('same token at different event times keeps different historical USD metrics without touching live quotes', async () => {
  const rows = [100000, 200000].map(tweetTime => ({ token, tweetTime, price: 999, marketCap: 888, priceChange24h: 777 }))
  const result = await attachEventMarketMetrics(rows, 4663, async (events, chain) => {
    assert.equal(chain, 4663)
    return events.map((event, i) => ({ ...event, eventPriceUsd: i + 1, eventMarketCapUsd: (i + 1) * 100,
      eventPriceChange24h: i ? -10 : 0 }))
  })
  assert.deepEqual(result.map(row => row.eventPriceUsd), [1, 2])
  assert.deepEqual(result.map(row => row.eventMarketCapUsd), [100, 200])
  assert.deepEqual(result.map(row => row.eventPriceChange24h), [0, -10])
  assert.ok(result.every(row => row.price === 999 && row.marketCap === 888 && row.priceChange24h === 777))
  assert.equal(rows[0].eventPriceUsd, undefined)
})

test('missing history or a failed request never falls back to current metrics or stale snapshots', async () => {
  const rows = [{ token, timestamp: 100000, price: 999, eventPriceUsd: 123 }]
  for (const read of [async () => [], async () => { throw Error('offline') }]) {
    const [row] = await attachEventMarketMetrics(rows, 56, read)
    assert.equal(row.eventPriceUsd, null)
    assert.equal(row.eventMarketCapUsd, null)
    assert.equal(row.eventPriceChange24h, null)
  }
})

test('bounded chunks, deduplication and exact transaction/log identity', async () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({ token, timestamp: 100000 + i }))
  rows.push(rows[0])
  const calls = []
  await attachEventMarketMetrics(rows, 56, async events => { calls.push(events); return [] })
  assert.deepEqual(calls.map(events => events.length), [30, 1])
  const transHash = `0x${'cd'.repeat(32)}`
  const sameSecond = [1, 2].map(logIndex => ({ token, timestamp: 100000, transHash, logIndex }))
  const result = await attachEventMarketMetrics(sameSecond, 56, async events =>
    events.map(event => ({ ...event, eventPriceUsd: event.logIndex })))
  assert.deepEqual(result.map(row => row.eventPriceUsd), [1, 2])
})

test('seconds, milliseconds and ISO dates normalize to the same event time', () => {
  assert.equal(eventTimestamp(1728000000), 1728000000)
  assert.equal(eventTimestamp(1728000000000), 1728000000)
  assert.equal(eventTimestamp('2024-10-04T00:00:00Z'), 1728000000)
})

test('Home and community use shared enrichment and cards keep live data only for trade sheets', () => {
  for (const file of ['views/home/HomePost.vue', 'views/tag-detail/TagContent.vue']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(source, /attachEventMarketMetrics\(/)
    assert.match(source, /getTokenInfoOfTweets/)
    assert.match(source, /historical-metrics/)
  }
  const card = readFileSync(new URL('../src/components/feed/CommunityTradeCard.vue', import.meta.url), 'utf8')
  assert.match(card, /props.historical \? props.tweet.eventPriceUsd/)
  assert.match(card, /props.historical \? props.tweet.eventMarketCapUsd/)
  assert.match(card, /price: props.tweet.price/)
  const community = readFileSync(new URL('../src/views/tag-detail/TagContent.vue', import.meta.url), 'utf8')
  assert.match(community, /enrichTweetTokens\(rows, true\)/)
  for (const file of ['components/tweets/TweetItem.vue', 'components/tweets/SpaceItem.vue']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    assert.match(source, /historicalMetrics: \{type: Boolean, default: false\}/)
    assert.match(source, /:historical="historicalMetrics"/)
  }
})
