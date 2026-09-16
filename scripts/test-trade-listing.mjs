import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
const source = readFileSync('src/utils/tradeListing.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { resolveTradeListing } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
test('raw post metadata cannot send listed BUIDL to the curve', async () => {
  assert.equal(await resolveTradeListing({ version: 4 }, async () => true), true)
})
test('BNB and RH launch versions use authoritative state in both directions', async () => {
  for (const version of [1, 4, 5, 7, 8, 9, 11, 13]) {
    for (const listed of [true, false]) {
      assert.equal(await resolveTradeListing({ version, listed: !listed }, async () => listed), listed)
    }
  }
})
test('missing state and RPC failures never default to the bonding curve', async () => {
  for (const value of [undefined, null, 0, 'false']) {
    await assert.rejects(resolveTradeListing({ version: 4 }, async () => value))
  }
  await assert.rejects(resolveTradeListing({ version: 4 }, async () => { throw Error('offline') }), /offline/)
})
test('imported tokens do not require a launch-token listed method', async () => {
  for (const metadata of [{ version: 10 }, { isImport: 1 }, { isImport: true }]) {
    assert.equal(await resolveTradeListing(metadata, async () => { throw Error('must not read') }), true)
  }
})
test('shared view gates quotes and revalidates before submitting', () => {
  const view = readFileSync('src/views/buy-sell/BuyAndSellView.vue', 'utf8')
  assert.equal((view.match(/!tradeReady.value \|\| !comStore.currentSelectedCommunity/g) || []).length, 2)
  assert.match(view, /:disabled="!tradeReady/)
  assert.match(view, /verifiedListed !== listed.value/)
  assert.doesNotMatch(view, /currentSelectedCommunity\?\.tick !== tick/)
})
