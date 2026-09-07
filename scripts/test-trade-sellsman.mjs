import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/tradeSellsman.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace(/from 'viem'/g, `from '${import.meta.resolve('viem')}'`)
const {
  resolveListedTradeSellsman: resolveListed,
  resolveTradeSellsman: resolve,
  DEFAULT_TRADE_SELLSMAN: defaults,
  requiresIPShareSellsman: requiresIPShare,
} =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const creator = '0x1111111111111111111111111111111111111111'

test('legacy listed issued tokens require IPShare, including BUIDL v4', () => {
  for (const version of [1, 2, 3, 4, 5, 6, '4', undefined]) {
    assert.equal(requiresIPShare({ listed: true, isImport: 0, version }), true)
  }
})
test('modern listed routing retains contract referral policy; bonding curves validate', () => {
  for (const version of [7, 8, 9, 11, '11']) {
    assert.equal(requiresIPShare({ listed: true, isImport: 0, version }), false)
    assert.equal(requiresIPShare({ listed: false, isImport: 0, version }), true)
  }
  for (const version of [4, 10, 11]) {
    assert.equal(requiresIPShare({ listed: true, isImport: 1, version }), false)
  }
})
test('legacy post/trade author without IPShare resolves to default on both chains', async () => {
  for (const chain of [56, 4663]) {
    assert.equal(requiresIPShare({ listed: true, version: 4 }), true)
    assert.equal(await resolve(chain, creator, async address => address === defaults[chain]), defaults[chain])
  }
})

test('listed trades preserve a valid address without requiring IPShare', () => {
  assert.equal(resolveListed(creator), creator)
})
test('listed trades normalize only missing or malformed addresses', () => {
  for (const candidate of [null, undefined, '', 'bad']) {
    assert.equal(resolveListed(candidate), `0x${'0'.repeat(40)}`)
  }
})

test('retain a creator with IPShare on either chain', async () => {
  for (const chain of [56, 4663]) assert.equal(await resolve(chain, creator, async () => true), creator)
})
test('missing, malformed, zero and uncreated creators use the chain-specific subject', async () => {
  for (const chain of [56, 4663]) for (const candidate of [null, undefined, '', 'bad', `0x${'0'.repeat(40)}`, creator]) {
    assert.equal(await resolve(chain, candidate, async address => address === defaults[chain]), defaults[chain])
  }
})
test('RPC failures must not redirect creator rewards', async () => {
  let calls = 0
  await assert.rejects(resolve(56, creator, async () => { calls++; throw new Error('RPC unavailable') }), /RPC unavailable/)
  assert.equal(calls, 1)
})
test('invalid default and unsupported chain fail before sending a transaction', async () => {
  await assert.rejects(resolve(56, creator, async () => false), /Default trade IPShare/)
  await assert.rejects(resolve(1, creator, async () => true), /Unsupported chain/)
})
test('trade component uses the same resolver in quotes and all Buy/Sell branches', async () => {
  const view = await readFile(new URL('../src/views/buy-sell/BuyAndSellView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(view, /stateStore\.sellsman\s*\?\?/)
  assert.match(view, /const resolvedSellsman = await getTradeSellsman\(\)/)
  assert.match(view, /props\.sellsman \|\| routeSellsman/)
  assert.match(view, /!requiresIPShareSellsman\(comStore.currentSelectedCommunity \?\? \{\}\)/)
})
