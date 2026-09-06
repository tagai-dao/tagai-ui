import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/tradeSellsman.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace(/from 'viem'/g, `from '${import.meta.resolve('viem')}'`)
const { resolveTradeSellsman: resolve, DEFAULT_TRADE_SELLSMAN: defaults } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const creator = '0x1111111111111111111111111111111111111111'

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
})
