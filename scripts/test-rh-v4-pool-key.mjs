import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
const source = readFileSync('src/utils/rhV4PoolKey.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace(/from 'viem'/g, `from '${import.meta.resolve('viem')}'`)
const { createRhV4PoolKeyReader, verifyRhV4PoolKey } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const poolId = '0x5874cbfe0230f02d5bdbfc63879f56d8c8d8854c60f8653a16761a55e2841fce'
const poolKey = { currency0: '0x0000000000000000000000000000000000000000', currency1: '0x6419cE35e915Fd62199C472a41e34dB55b56b89d', fee: 0, tickSpacing: 60, hooks: '0x5e8e2D77ce0d2e04BA058bbcECC13C7C8aDB20Cc' }
const metadata = { chainId: 4663, poolId, poolKey }

test('TagAgent API metadata matches the complete pool ID and target token', () => {
  assert.deepEqual(verifyRhV4PoolKey(poolId, poolKey, poolKey.currency1), poolKey)
  for (const wrong of [{ ...poolKey, fee: 3000 }, { ...poolKey, tickSpacing: 0 }, null, {}, { ...poolKey, hooks: 'bad' }]) {
    assert.throws(() => verifyRhV4PoolKey(poolId, wrong), /RH_V4_POOL_KEY_UNAVAILABLE/)
  }
  assert.throws(() => verifyRhV4PoolKey(poolId, poolKey, poolKey.hooks), /RH_V4_POOL_KEY_UNAVAILABLE/)
})

test('one API lookup is shared and successful immutable metadata is cached', async () => {
  let calls = 0
  const read = createRhV4PoolKeyReader(async (chain, id) => {
    calls++; assert.equal(chain, 4663); assert.equal(id, poolId); return metadata
  })
  const first = read(4663, poolId)
  assert.equal(first, read(4663, poolId))
  assert.deepEqual(await first, poolKey)
  assert.deepEqual(await read(4663, poolId), poolKey)
  assert.equal(calls, 1)
})

test('API failure retries on the next request without any on-chain fallback', async () => {
  let calls = 0
  const read = createRhV4PoolKeyReader(async () => { if (++calls === 1) throw Error('503'); return metadata })
  await assert.rejects(read(4663, poolId), /RH_V4_POOL_KEY_UNAVAILABLE/)
  assert.deepEqual(await read(4663, poolId), poolKey)
  assert.equal(calls, 2)
})

test('rejects metadata from a different chain, pool, or key', async () => {
  for (const wrong of [{ ...metadata, chainId: 56 }, { ...metadata, poolId: `0x${'a'.repeat(64)}` }, { ...metadata, poolKey: { ...poolKey, fee: 3000 } }, {}]) {
    await assert.rejects(createRhV4PoolKeyReader(async () => wrong)(4663, poolId), /RH_V4_POOL_KEY_UNAVAILABLE/)
  }
})

test('chain changes do not reuse an earlier cached response', async () => {
  let calls = 0
  const read = createRhV4PoolKeyReader(async chainId => { calls++; return { ...metadata, chainId } })
  await read(4663, poolId); await read(46630, poolId)
  assert.equal(calls, 2)
})

test('invalid IDs fail before API lookup', async () => {
  await assert.rejects(createRhV4PoolKeyReader(async () => assert.fail('unexpected API'))(4663, '0x1234'), /UNAVAILABLE/)
})

test('frontend has no history RPC calls or RH pool discovery via contract/templates', () => {
  const scan = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) scan(path)
      else if (/\.(ts|js|vue)$/.test(entry.name)) assert.doesNotMatch(readFileSync(path, 'utf8'), /\b(?:getLogs|eth_getLogs|queryFilter)\b/, path)
    }
  }
  scan('src')
  assert.doesNotMatch(source, /readContract|tipTagSwapHook|resolveRhV4LaunchPoolKey/)
  const swap = readFileSync('src/utils/rhV4Swap.ts', 'utf8')
  assert.match(swap, /community\?\.poolKey.*verifyRhV4PoolKey/)
  assert.match(swap, /community\/v4PoolKey/)
})

test('trade view compiles, surfaces missing metadata as unavailable, and gates submission', () => {
  const s = readFileSync('src/views/buy-sell/BuyAndSellView.vue', 'utf8')
  compileScript(parse(s).descriptor, { id: 'rh-metadata' })
  assert.match(s, /poolMetadataError \? '—'/)
  assert.match(s, /:disabled="!tradeReady \|\| poolMetadataError/)
  assert.match(s, /buyAndSell.poolMetadataUnavailable/)
})
