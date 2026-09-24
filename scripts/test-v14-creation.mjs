import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { encodeFunctionData, decodeFunctionData } from 'viem'
const dir = await mkdtemp(join(tmpdir(), 'v14-creation-'))
await build({ stdin: { contents: "export * from './src/utils/v14/creation-config.ts';export * from './src/utils/v13/registration-queue.ts';export * from './src/config/chains.ts';", resolveDir: process.cwd() }, alias: { '@': join(process.cwd(), 'src') }, bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs'), logLevel: 'silent' })
const { tradePoolConfig, stakingRewardRatios, getChainDeployment, createRegistrationQueue } = createRequire(import.meta.url)(join(dir, 'test.cjs'))
await rm(dir, { recursive: true, force: true })
const deployment = getChainDeployment(56)
const options = { tradePool: { factory: deployment.contracts.tradeCurationFactory, enabled: true, maxRewardRatio: 8000 } }
const abi = JSON.parse(await readFile('src/utils/v14/Pump14.json', 'utf8'))
const index = { name: 'TEST', symbol: 'TEST', constituentAssets: ['0x' + '11'.repeat(20)], targetWeights: [10000], basketFeeBps: 100, creatorShareBps: 0, retainCommunityOwnership: false }
const salt = '0x' + '00'.repeat(32)
test('disabled trade mining adds no factory config even if the factory is unavailable', () => {
  assert.deepEqual(tradePoolConfig(0), [])
  assert.deepEqual(tradePoolConfig(0, { tradePool: { ...options.tradePool, enabled: false } }), [])
})
test('0.01% and 80% boundaries encode with the deployed Pump14 overload and empty meta', () => {
  for (const ratio of [1, 8000]) {
    const pools = tradePoolConfig(ratio, options)
    assert.deepEqual(pools, [{ factory: options.tradePool.factory, rewardRatio: ratio, meta: '0x' }])
    const data = encodeFunctionData({ abi, functionName: 'createToken', args: ['TEST', salt, index, pools] })
    const decoded = decodeFunctionData({ abi, data })
    assert.equal(decoded.args.length, 4)
    assert.equal(decoded.args[3][0].rewardRatio, ratio)
  }
  const data = encodeFunctionData({ abi, functionName: 'createToken', args: ['TEST', salt, index] })
  assert.equal(decodeFunctionData({ abi, data }).args.length, 3)
})
test('negative, non-integer, empty, infinite and over-limit ratios are rejected', () => {
  for (const ratio of [-1, 0.5, 8001, NaN, Infinity, null, '2000']) assert.throws(() => tradePoolConfig(ratio, options), /share/)
})
test('factory approval, address and reduced owner limits are enforced', () => {
  assert.throws(() => tradePoolConfig(1), /unavailable/)
  assert.throws(() => tradePoolConfig(1, { tradePool: { ...options.tradePool, enabled: false } }), /unavailable/)
  assert.throws(() => tradePoolConfig(1, { tradePool: { ...options.tradePool, factory: index.constituentAssets[0] } }), /unavailable/)
  assert.throws(() => tradePoolConfig(2001, { tradePool: { ...options.tradePool, maxRewardRatio: 2000 } }), /limit/)
})
test('every trade ratio preserves 100% allocation including tiny weights and integer remainders', () => {
  for (const weights of [[10000], [3333, 6667], [1, 3332, 3333, 3334]]) {
    for (let ratio = 0; ratio <= 8000; ratio++) {
      const result = stakingRewardRatios(weights, ratio)
      assert.ok(result.every(n => Number.isInteger(n) && n >= 0))
      assert.equal(result.reduce((a, b) => a + b, ratio), 10000)
    }
    assert.deepEqual(stakingRewardRatios(weights, 0), weights)
  }
  assert.deepEqual(stakingRewardRatios([1, 3332, 3333, 3334], 8000), [0, 666, 667, 667])
})
test('V14 pending registration survives reload alongside V13 historical recovery', async () => {
  const storage = { getItem(k) { return this[k] ?? null }, setItem(k, v) { this[k] = v }, removeItem(k) { delete this[k] } }
  let fail = true, time = 0
  const registered = []
  const deps = { storage, scope: 'https://example.invalid:56', now: () => time, receipt: async () => ({ status: 'success' }), register: async f => { if (fail) throw Error('offline'); registered.push(f) }, synced() {} }
  const q = createRegistrationQueue(deps)
  for (const version of [13, 14]) q.enqueue({ version, chainId: 56, createHash: '0x' + String(version).repeat(32), tick: 'TEST', logoUrl: 'logo', tradeRewardRatioBps: version === 14 ? 8000 : undefined })
  await q.flush(); assert.equal(registered.length, 0)
  fail = false; time = 5001
  await createRegistrationQueue(deps).flush()
  assert.deepEqual(registered.map(f => f.version), [13, 14])
  assert.equal(registered[1].tradeRewardRatioBps, 8000)
  await createRegistrationQueue(deps).flush(); assert.equal(registered.length, 2)
})
