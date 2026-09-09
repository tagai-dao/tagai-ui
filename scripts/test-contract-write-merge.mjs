import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual merged write flow without connecting a wallet or RPC.
const source = readFileSync(new URL('../src/utils/contract.ts', import.meta.url), 'utf8')
const file = ts.createSourceFile('contract.ts', source, ts.ScriptTarget.Latest, true)
const declarations = file.statements.filter(statement => ts.isVariableStatement(statement)
  && statement.declarationList.declarations.some(d => ['writeContract', 'withTimeout'].includes(d.name.getText(file))))
assert.equal(declarations.length, 2)
const js = ts.transpileModule(declarations.map(s => s.getText(file).replace(/^export /, '')).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const hash = '0x' + 'ab'.repeat(32), address = '0x' + '12'.repeat(20)
class SubmittedTransactionError extends Error {
  constructor(transactionHash, cause) { super('submitted', { cause }); this.transactionHash = transactionHash }
}
function fixture(overrides = {}) {
  const events = [], receiptTimeouts = []
  const publicClient = {
    simulateContract: async request => { events.push('simulate'); return { request } },
    estimateContractGas: async () => { events.push('gas'); return 100n },
    ...overrides.publicClient,
  }
  const context = vm.createContext({
    setTimeout, clearTimeout, console: { log() {} }, SubmittedTransactionError,
    zeroAddress: '0x' + '00'.repeat(20),
    getWalletClient: () => ({ writeContract: async request => {
      events.push('write'); assert.equal(request.gas, 120n); return hash
    } }),
    getReadOnlyClient: () => publicClient,
    useAccountStore: () => ({ getWalletType: 'privy', ethConnectAddress: address }),
    useChainStore: () => ({ activeChainId: 56 }), getChainById: id => ({ id }),
    waitForTx: async (tx, timeout) => {
      events.push('receipt'); receiptTimeouts.push(timeout)
      if (overrides.receiptError) throw overrides.receiptError
      return tx
    },
  })
  const write = vm.runInContext(js + '\nwriteContract', context)
  return { events, receiptTimeouts, run: (options = {}) => write({
    contractName: 'Pump13', functionName: 'createToken', args: [], address, abi: [],
    beforeWrite: () => events.push('guard'), onSubmitted: tx => {
      assert.equal(tx, hash); events.push('submitted')
    }, ...options,
  }) }
}
test('V13 guards and submission callback coexist with bounded preflight and receipt waits', async () => {
  const f = fixture()
  assert.equal(await f.run({ simulationTimeout: 1000, requestTimeout: 1000, receiptTimeout: 321 }), hash)
  assert.deepEqual(f.events, ['guard', 'simulate', 'gas', 'guard', 'write', 'submitted', 'receipt'])
  assert.deepEqual(f.receiptTimeouts, [321])
})
test('receipt failure preserves submitted hash after notifying the registration callback', async () => {
  const f = fixture({ receiptError: new Error('RPC unavailable') })
  await assert.rejects(f.run(), error => error instanceof SubmittedTransactionError && error.transactionHash === hash)
  assert.deepEqual(f.events.slice(-2), ['submitted', 'receipt'])
  assert.deepEqual(f.receiptTimeouts, [120_000])
})
test('preflight timeout never opens wallet or registers a transaction', async () => {
  const f = fixture({ publicClient: { simulateContract: () => new Promise(() => {}) } })
  await assert.rejects(f.run({ simulationTimeout: 10 }), /Network preflight timed out/)
  assert.deepEqual(f.events, ['guard'])
})
test('final V13 guard can reject a changed account before wallet submission', async () => {
  const f = fixture(); let guards = 0
  await assert.rejects(f.run({ beforeWrite: () => { if (++guards === 2) throw new Error('account changed') } }), /account changed/)
  assert.deepEqual(f.events, ['simulate', 'gas'])
})
