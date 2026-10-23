import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createPublicClient, custom, parseAbi, decodeFunctionData, encodeFunctionResult } from 'viem'
import { bsc } from 'viem/chains'

const dir = await mkdtemp(join(tmpdir(), 'holder-identity-'))
await build({ entryPoints: ['src/utils/holderIdentity.ts'], bundle: true, platform: 'node', format: 'cjs',
  outfile: join(dir, 'test.cjs'), alias: { '@': join(process.cwd(), 'src') }, define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const { holderDisplayName, holderDisplayOrigin, readHolderAgentHandles } = createRequire(import.meta.url)(join(dir, 'test.cjs'))
after(() => rm(dir, { recursive: true, force: true }))
const addr = n => `0x${n.toString(16).padStart(40, '0')}`
const mc = '0xca11bde05977b3631167028862be2a173976ca11'
const registry = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f'
const aggregate = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const handle = parseAbi(['function handleOf(address account) view returns(string)'])

test('prefers actual Agent ID, then social username/name, then other TagAI identity, then short address', () => {
  const holder = { ethAddr: addr(1), agentHandle: 'agent.ai', twitterUsername: 'alice', twitterName: 'Alice' }
  assert.equal(holderDisplayName(holder), 'agent.ai')
  assert.equal(holderDisplayName({ ...holder, agentHandle: '' }), 'alice')
  assert.equal(holderDisplayName({ ...holder, agentHandle: null, twitterUsername: ' ' }), 'Alice')
  assert.equal(holderDisplayName({ ethAddr: addr(1), farcasterName: 'caster' }), 'caster')
  assert.equal(holderDisplayName({ ethAddr: addr(1), steemId: 'steem-user' }), 'steem-user')
  assert.equal(holderDisplayName({ ethAddr: addr(1), twitterUsername: addr(1) }), '0x0000...000001')
})

test('displays complete .ai IDs and only the icon belonging to the chosen identity', () => {
  const base = { ethAddr: addr(1), twitterUsername: 'tagai', accountType: 0, accountSources: ['TAGAI', 'X'] }
  assert.equal(holderDisplayName({ ...base, agentHandle: 'tagai' }), 'tagai.ai')
  assert.equal(holderDisplayName({ ...base, agentHandle: 'tagai.ai' }), 'tagai.ai')
  assert.equal(holderDisplayOrigin({ ...base, agentHandle: 'tagai' }), 'BINANCE')
  assert.equal(holderDisplayOrigin(base), 'X')
  assert.equal(holderDisplayOrigin({ ...base, accountType: 1, accountSources: ['TAGAI'] }), 'TAGAI')
  assert.equal(holderDisplayOrigin({ ...base, accountType: 1 }), 'TAGAI')
  assert.equal(holderDisplayOrigin({ ...base, accountType: 2, accountSources: [] }), 'TAGAI')
  assert.equal(holderDisplayOrigin({ ...base, walletType: 2 }), 'TAGAI')
  assert.equal(holderDisplayOrigin({ ethAddr: addr(1) }), null)
  assert.equal(holderDisplayOrigin({ ethAddr: addr(1), farcasterName: 'caster', accountType: 0 }), 'TAGAI')
})

test('real viem reads 45 addresses only through verified fixed-block Multicalls and caches successes', async () => {
  const reads = []
  let childCount = 0
  const client = createPublicClient({ chain: bsc, transport: custom({ request: async ({ method, params }) => {
    reads.push(method)
    if (method === 'eth_blockNumber') return '0x1234'
    if (method === 'eth_getCode') {
      assert.equal(params[0].toLowerCase(), mc); assert.equal(params[1], '0x1234')
      return '0x6000'
    }
    assert.equal(method, 'eth_call')
    assert.equal(params[0].to.toLowerCase(), mc); assert.equal(params[1], '0x1234')
    const calls = decodeFunctionData({ abi: aggregate, data: params[0].data }).args[0]
    assert.ok(calls.length <= 40)
    childCount += calls.length
    const rows = calls.map(call => {
      assert.equal(call.target.toLowerCase(), registry); assert.equal(call.allowFailure, true)
      const decoded = decodeFunctionData({ abi: handle, data: call.callData })
      assert.equal(decoded.functionName, 'handleOf')
      const wallet = decoded.args[0].toLowerCase()
      return { success: true, returnData: encodeFunctionResult({ abi: handle, functionName: 'handleOf', result: wallet === addr(2) ? '' : `agent-${wallet.slice(-3)}.ai` }) }
    })
    return encodeFunctionResult({ abi: aggregate, functionName: 'aggregate3', result: rows })
  } }, { retryCount: 0 }) })
  const addresses = Array.from({ length: 45 }, (_, i) => addr(i + 1))
  const result = await readHolderAgentHandles(client, [...addresses, addresses[0], 'invalid'])
  assert.equal(result[addr(1)], 'agent-001.ai'); assert.equal(result[addr(2)], '')
  assert.equal(childCount, 45)
  assert.equal(reads.filter(method => method === 'eth_call').length, 2)
  assert.equal(reads.filter(method => method === 'eth_getCode').length, 1)
  const before = reads.length
  assert.deepEqual(await readHolderAgentHandles(client, addresses), result)
  assert.equal(reads.length, before)
})

test('unavailable identity RPC cannot fail holder display or issue individual contract calls', async () => {
  const client = { chain: { id: 56 }, getBlockNumber: async () => { throw Error('offline') } }
  assert.deepEqual(await readHolderAgentHandles(client, [addr(100)]), {})
  assert.equal(holderDisplayName({ ethAddr: addr(100), twitterUsername: 'known-user' }), 'known-user')
  assert.deepEqual(await readHolderAgentHandles({ chain: { id: 4663 } }, [addr(100)]), {})
})

test('missing Multicall deployment skips reads; failed or malformed children never become names', async () => {
  let calls = 0
  const client = { chain: { id: 56 }, getBlockNumber: async () => 99n,
    getBytecode: async ({ address, blockNumber }) => {
      assert.equal(address.toLowerCase(), mc); assert.equal(blockNumber, 99n)
      return '0x'
    }, multicall: async () => { calls++; throw Error('must not call') } }
  assert.deepEqual(await readHolderAgentHandles(client, [addr(200)]), {})
  assert.equal(calls, 0)
  client.getBytecode = async () => '0x6000'
  client.multicall = async options => {
    calls++
    assert.equal(options.blockNumber, 99n); assert.equal(options.multicallAddress.toLowerCase(), mc)
    return [{ status: 'success', result: 'real-agent' }, { status: 'failure', error: Error('revert') }, { status: 'success', result: 123 }]
  }
  const result = await readHolderAgentHandles(client, [addr(200), addr(201), addr(202)])
  assert.deepEqual(result, { [addr(200)]: 'real-agent' })
  await readHolderAgentHandles(client, [addr(201)])
  assert.equal(calls, 2, 'failed child reads must remain retryable')
})

test('holder UI preserves avatar popup and guards asynchronous identity results by chain/token/request', async () => {
  const source = await readFile('src/views/tag-detail/TagToken.vue', 'utf8')
  assert.match(source, /<HolderIdentityLabel :holder="holder"/)
  const label = await readFile('src/components/common/HolderIdentityLabel.vue', 'utf8')
  assert.match(label, /:title="holder.ethAddr"/)
  assert.match(label, /externalSourceLogos\[origin\]/)
  assert.match(label, /break-all/)
  assert.match(source, /<UserAvatar[\s\S]*?:eth-addr="holder.ethAddr"/)
  assert.match(source, /request !== holderIdentityRequest \|\| chainId !== chainStore.activeChainId \|\| token !== comStore.currentSelectedCommunity\?\.token/)
  assert.match(source, /readHolderAgentHandles\(getReadOnlyClient\(56\)/)
})
