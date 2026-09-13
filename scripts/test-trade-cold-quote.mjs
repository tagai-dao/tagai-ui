import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
const source = readFileSync('src/utils/v13/metadataRequest.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { requestMetadata } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const signal = () => new AbortController().signal
test('cold timeout then warm cache succeeds without reopening', async () => {
  let n = 0
  assert.deepEqual(await requestMetadata(async () => { if (++n === 1) throw { status: 500 }; return { c: 0, d: {} } }, signal(), async () => {}), { c: 0, d: {} })
  assert.equal(n, 2)
})
test('permanent transport failure is bounded to three attempts', async () => {
  let n = 0
  await assert.rejects(requestMetadata(async () => { n++; throw new Error('failed') }, signal(), async () => {}))
  assert.equal(n, 1)
  n = 0
  await assert.rejects(requestMetadata(async () => { n++; throw { status: 503 } }, signal(), async () => {}))
  assert.equal(n, 3)
})
test('reset/unmount during backoff prevents another request', async () => {
  const c = new AbortController(); let n = 0
  await assert.rejects(requestMetadata(async () => { n++; throw { status: 503 } }, c.signal, async () => c.abort()), /CANCELLED/)
  assert.equal(n, 1)
})
test('auth and invalid metadata are not blindly retried', async () => {
  let n = 0
  await assert.rejects(requestMetadata(async () => { n++; throw { status: 403 } }, signal(), async () => {}))
  assert.equal(n, 1)
  assert.deepEqual(await requestMetadata(async () => ({ c: 1, m: 'V13_UNKNOWN_TOKEN' }), signal()), { c: 1, m: 'V13_UNKNOWN_TOKEN' })
})
test('background route preparation is surfaced immediately instead of rapid transport retries', async () => {
  let n = 0
  await assert.rejects(requestMetadata(async () => {
    n++; throw { status: 503, data: { error: 'V13_METADATA_PREPARING' } }
  }, signal(), async () => {}))
  assert.equal(n, 1)
})
test('metadata busy retries but successful zero values remain intact', async () => {
  let n = 0
  assert.deepEqual(await requestMetadata(async () => ++n === 1 ? { c: 1, m: 'V13_BUSY' } : { c: 0, d: 0 }, signal(), async () => {}), { c: 0, d: 0 })
})
test('both-chain trade view compiles and cancels delayed callbacks on close', () => {
  const s = readFileSync('src/views/buy-sell/BuyAndSellView.vue', 'utf8')
  compileScript(parse(s).descriptor, { id: 'cold-quote' })
  assert.match(s, /disposed = true; communityLoad\+\+; buyQuoteSeq\+\+; sellQuoteSeq\+\+/)
  assert.match(s, /getCommunityDetail\(tick, chainId\)/)
  assert.match(s, /void updateUserTokenInfo\(\)\s+refreshV13Quote\(\)/)
})
