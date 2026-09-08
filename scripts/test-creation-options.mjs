import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const dir = await mkdtemp(join(tmpdir(), 'creation-options-'))
const outfile = join(dir, 'test.cjs')
await build({ stdin: { contents: "export * from './src/utils/v13/creation-chain.ts';export * from './src/utils/v13/creation-fees.ts';", resolveDir: process.cwd() }, alias: { '@': join(process.cwd(), 'src') }, bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'silent' })
const { readCreationOptions, creationFeeExample, creationFeeAllocation, creatorPercentToBps } = createRequire(import.meta.url)(outfile)
const apiOutfile = join(dir, 'api.cjs')
await build({ entryPoints: ['src/utils/v13/creation.ts'], alias: { '@': join(process.cwd(), 'src') }, bundle: true, platform: 'node', format: 'cjs', outfile: apiOutfile, logLevel: 'silent', plugins: [{ name: 'creation-dependencies', setup(build) {
  build.onResolve({ filter: /^@\/(apis\/axios|config\/api|utils\/wallets)$/ }, args => ({ path: args.path, namespace: 'creation-test' }))
  build.onLoad({ filter: /.*/, namespace: 'creation-test' }, args => ({ contents: args.path.endsWith('axios')
    ? 'export const get=(...args)=>globalThis.creationTest.get(...args);export const post=()=>{}'
    : args.path.endsWith('wallets') ? 'export const getReadOnlyClient=()=>globalThis.creationTest.client'
    : 'export const API_BASE_URL="https://example.invalid"' }))
} }] })
const { creationOptions } = createRequire(import.meta.url)(apiOutfile)
await rm(dir, { recursive: true, force: true })
const creator = '0x' + '11'.repeat(20)
const committee = '0x' + '22'.repeat(20)
const implementation = '0x' + '33'.repeat(20)
const assets = JSON.parse(await readFile('src/utils/v13/creation-assets.json', 'utf8'))
function client(hasShare = false, noAssets = false) {
  const calls = []
  return { calls, chain: { id: 56 }, getBlockNumber: async () => 123456n, async multicall(request) {
    calls.push(request)
    if (calls.length === 1) return [creator, committee, 123n, implementation, ...assets.map((_, i) => !noAssets && i % 2 === 0)]
    return [hasShare, 200n, 300n, 400n]
  } }
}
test('fallback returns only approved candidates and snapshots all reads at one block', async () => {
  const c = client(); const result = await readCreationOptions(c, creator)
  assert.deepEqual(result.assets, assets.filter((_, i) => i % 2 === 0))
  assert.equal(result.ipshareFee, '200'); assert.equal(result.pumpFee, '123')
  assert.equal(result.communityFee, '300'); assert.equal(result.settingsFee, '400')
  assert.equal(result.tokenImplementation, implementation); assert.equal(result.sourceBlock, 123456)
  assert.equal(c.calls.length, 2)
  for (const call of c.calls) { assert.equal(call.blockNumber, 123456n); assert.equal(call.allowFailure, false) }
  assert.deepEqual(c.calls[1].contracts[0].args, [creator])
})
test('existing IP share incurs no additional creation fee', async () => assert.equal((await readCreationOptions(client(true), creator)).ipshareFee, '0'))
test('an empty whitelist is not replaced by hard-coded selectable assets', async () => assert.deepEqual((await readCreationOptions(client(false, true), creator)).assets, []))
test('rejects wrong chain and incomplete deployment', async () => {
  await assert.rejects(readCreationOptions({ ...client(), chain: { id: 4663 } }, creator))
  await assert.rejects(readCreationOptions({ ...client(), multicall: async () => ['0x' + '00'.repeat(20), committee, 1n, implementation] }, creator))
})
test('failed chain reads fail closed instead of returning guessed fees', async () => {
  await assert.rejects(readCreationOptions({ ...client(), multicall: async () => { throw new Error('RPC unavailable') } }, creator), /RPC unavailable/)
})
test('creator example uses the distributable balance, not the full trading fee', () => {
  const r = creationFeeExample(100, 1000)
  assert.equal(r.fee, 1)
  assert.ok(Math.abs(r.distributable - 0.8001) < 1e-10)
  assert.ok(Math.abs(r.creator - 0.08001) < 1e-10)
  assert.equal(creationFeeExample(100, 0).creator, 0)
  assert.ok(Math.abs(creationFeeExample(300, 3000).creator - 0.72009) < 1e-10)
})

test('creation configuration uses the API first without reading RPC', async () => {
  const data = await readCreationOptions(client(), creator)
  globalThis.creationTest = { get: async () => ({ c: 0, d: data }) }
  assert.deepEqual(await creationOptions(creator), data)
})
test('missing API route falls back to the chain with one bounded API attempt', async () => {
  let attempts = 0
  const c = client()
  globalThis.creationTest = { client: c, get: async (_url, _params, config) => {
    attempts++; assert.equal(config.timeout, 8000); assert.equal(config['axios-retry'].retries, 0)
    assert.equal(config.headers['X-Chain-Id'], '56'); throw { status: 404 }
  } }
  assert.equal((await creationOptions(creator)).assets.length, 8)
  assert.equal(attempts, 1); assert.equal(c.calls.length, 2)
})
test('malformed API asset data falls back instead of crashing the selector', async () => {
  const data = await readCreationOptions(client(), creator)
  data.assets = [{ address: null, decimals: 18, symbol: 'BAD' }]
  const c = client()
  globalThis.creationTest = { client: c, get: async () => ({ c: 0, d: data }) }
  assert.equal((await creationOptions(creator)).assets.length, 8)
})

test('segmented fee bar totals 100% for every supported creator setting', () => {
  for (let bps = 0; bps <= 3000; bps++) {
    const parts = creationFeeAllocation(bps)
    assert.ok(Math.abs(Object.values(parts).reduce((a,b) => a+b,0) - 100) < 1e-10)
    assert.equal(parts.platform,10)
    assert.equal(parts.frontend,4.995)
    assert.equal(parts.launcher,4.995)
    assert.ok(parts.holders >= 0)
  }
  assert.equal(creationFeeAllocation(0).creator,0)
  assert.ok(Math.abs(creationFeeAllocation(3000).creator - 24.003) < 1e-10)
  assert.ok(Math.abs(creationFeeAllocation(3000).holders - 56.007) < 1e-10)
})

test('every 0.1% creator slider stop round-trips through integer contract bps', () => {
  for (let tenth = 0; tenth <= 240; tenth++) {
    const percent = tenth / 10
    const bps = creatorPercentToBps(percent)
    assert.ok(Number.isInteger(bps) && bps >= 0 && bps <= 3000)
    assert.equal(Math.round(creationFeeAllocation(bps).creator * 10) / 10, percent)
  }
  assert.equal(Math.round(creationFeeAllocation(creatorPercentToBps(1)).creator * 10) / 10, 1)
  assert.equal(creatorPercentToBps(24), 3000)
})
