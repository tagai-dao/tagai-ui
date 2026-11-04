import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createPublicClient, custom, parseAbi, decodeFunctionData, encodeFunctionData, encodeFunctionResult, zeroAddress } from 'viem'
import { bsc } from 'viem/chains'

const dir = await mkdtemp(join(tmpdir(), 'v19-transfer-'))
await build({ entryPoints: ['src/utils/v19/transfer-policy.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs'), logLevel: 'silent' })
const { readV19TransferState, allowsV19Transfer } = createRequire(import.meta.url)(join(dir, 'test.cjs'))
after(async () => rm(dir, { recursive: true, force: true }))
const token = '0x' + '11'.repeat(20), account = '0x' + '22'.repeat(20), community = '0x' + '33'.repeat(20)
const multicall = '0xca11bde05977b3631167028862be2a173976ca11'
const aggregate = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function listed() view returns(bool)', 'function nutboxCommunity() view returns(address)'])
function fixture({ listed = false, receiver = community, fail, balance = 100n } = {}) {
  const calls = []
  const client = createPublicClient({ chain: bsc, transport: custom({ request: async ({ method, params }) => {
    if (method === 'eth_blockNumber') return '0x1e240'
    assert.equal(method, 'eth_call', 'no independent or batched contract RPC is allowed')
    assert.equal(params[0].to.toLowerCase(), multicall)
    assert.equal(params[1], '0x1e240')
    const children = decodeFunctionData({ abi: aggregate, data: params[0].data }).args[0]
    assert.deepEqual(children.map(c => [c.target.toLowerCase(), c.callData]), [
      [token, encodeFunctionData({ abi, functionName: 'balanceOf', args: [account] })],
      [token, encodeFunctionData({ abi, functionName: 'listed' })],
      [token, encodeFunctionData({ abi, functionName: 'nutboxCommunity' })],
    ])
    calls.push(children)
    const results = children.map(c => {
      const fn = decodeFunctionData({ abi, data: c.callData }).functionName
      return fn === fail ? { success: false, returnData: '0x' } : {
        success: true, returnData: encodeFunctionResult({ abi, functionName: fn, result: { balanceOf: balance, listed, nutboxCommunity: receiver }[fn] }),
      }
    })
    return encodeFunctionResult({ abi: aggregate, functionName: 'aggregate3', result: results })
  } }, { retryCount: 0 }) })
  return { client, calls }
}
test('balance, listing state and canonical recipient use one fixed-block Multicall', async () => {
  const f = fixture()
  const state = await readV19TransferState(f.client, token, account)
  assert.equal(f.calls.length, 1)
  assert.equal(state.blockNumber, 123456n)
  assert.equal(state.balance, 100n)
  assert.equal(state.community.toLowerCase(), community)
  assert.equal(allowsV19Transfer(state, community.toUpperCase().replace('0X', '0x')), true)
  assert.equal(allowsV19Transfer(state, account), false)
  assert.equal(allowsV19Transfer(state, zeroAddress), false)
})
test('listed tokens restore other valid recipients', async () => {
  const { client } = fixture({ listed: true })
  assert.equal(allowsV19Transfer(await readV19TransferState(client, token, account), account), true)
})
for (const fail of ['balanceOf', 'listed', 'nutboxCommunity']) test(`a missing required ${fail} result refuses the whole transfer state`, async () => {
  const { client } = fixture({ fail })
  await assert.rejects(readV19TransferState(client, token, account))
})
test('uninitialized community and a wrong chain cannot authorize an inner transfer', async () => {
  const { client } = fixture({ receiver: zeroAddress })
  await assert.rejects(readV19TransferState(client, token, account), /V19_TRANSFER_UNAVAILABLE/)
  await assert.rejects(readV19TransferState({ ...client, chain: { id: 4663 } }, token, account), /V19_TRANSFER_UNAVAILABLE/)
  assert.equal(allowsV19Transfer(undefined, community), false)
})
