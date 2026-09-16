import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync('src/utils/ensureWalletChain.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const { ensureWalletChain } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('Privy/external providers switch RH to BNB and BNB to RH', async () => {
  for (const [initial, target] of [[4663, 56], [56, 4663]]) {
    let current = initial; const calls = []
    await ensureWalletChain({ request: async ({ method, params }) => {
      calls.push(method)
      if (method === 'eth_chainId') return `0x${current.toString(16)}`
      current = Number(params[0].chainId)
    } }, target, {})
    assert.equal(current, target)
    assert.deepEqual(calls, ['eth_chainId', 'wallet_switchEthereumChain', 'eth_chainId'])
  }
})
test('correct chain needs no wallet prompt', async () => {
  await ensureWalletChain({ request: async ({ method }) => {
    assert.equal(method, 'eth_chainId'); return '0x38'
  } }, 56, {})
})
test('unknown chain is added, then explicitly switched and verified', async () => {
  let current = 56, added = false
  await ensureWalletChain({ request: async ({ method }) => {
    if (method === 'eth_chainId') return current
    if (method === 'wallet_addEthereumChain') { added = true; return }
    if (!added) throw { code: -1, cause: { code: 4902 } }
    current = 4663
  } }, 4663, { chainId: '0x1237' })
  assert.equal(current, 4663)
})
test('rejection, pending request and RPC errors are propagated without adding a chain', async () => {
  for (const code of [4001, -32002, -32603]) {
    const error = { code }
    await assert.rejects(ensureWalletChain({ request: async ({ method }) => {
      if (method === 'eth_chainId') return 4663
      assert.equal(method, 'wallet_switchEthereumChain')
      throw error
    } }, 56, {}), e => e === error)
  }
})
test('resolved switch that leaves wallet on wrong chain fails closed', async () => {
  await assert.rejects(ensureWalletChain({ request: async () => '0x1237' }, 56, {}), /did not switch/)
})
test('all shared and direct token trade paths prepare the wallet', () => {
  for (const file of ['contract.ts', 'pcsV4Swap.ts', 'rhV4Swap.ts', 'v13/client.ts', 'v13/lifecycle.ts', 'v13/pools.ts']) {
    const code = readFileSync(`src/utils/${file}`, 'utf8')
    assert.match(code, /await getPreparedWalletClient\(/, file)
    assert.doesNotMatch(code, /getWalletType\s*!==?\s*'privy'/, file)
  }
})
