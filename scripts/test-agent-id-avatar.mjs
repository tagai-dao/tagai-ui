import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createPublicClient, custom, parseAbi, decodeFunctionData, encodeFunctionResult, keccak256, toHex } from 'viem'
import { bsc } from 'viem/chains'
const dir = await mkdtemp(join(tmpdir(), 'agent-avatar-'))
await build({ entryPoints: ['src/utils/agentIdAvatar.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs'), logLevel: 'silent' })
const { readAgentIdAvatarUris, fetchAgentIdImage } = createRequire(import.meta.url)(join(dir, 'test.cjs'))
after(() => rm(dir, { recursive: true, force: true }))
const aggregate = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const abi = parseAbi(['function handleOf(address) view returns(string)', 'function tokenURI(uint256) view returns(string)'])
const wallet = '0x0000000000000000000000000000000000000001'

test('verified address -> handle -> NFT URI uses only fixed-block Multicalls', async () => {
  let phase = 0
  const client = createPublicClient({ chain: bsc, transport: custom({ request: async ({ method, params }) => {
    if (method === 'eth_blockNumber') return '0x1234'
    assert.equal(params[1], '0x1234')
    if (method === 'eth_getCode') return '0x6000'
    assert.equal(method, 'eth_call')
    assert.equal(params[0].to.toLowerCase(), '0xca11bde05977b3631167028862be2a173976ca11')
    const calls = decodeFunctionData({ abi: aggregate, data: params[0].data }).args[0]
    assert.equal(calls.length, 1)
    assert.equal(calls[0].target.toLowerCase(), '0x60b9262456de011f7d15a54cdd8c48baaa8b022f')
    const decoded = decodeFunctionData({ abi, data: calls[0].callData })
    assert.equal(decoded.functionName, phase === 0 ? 'handleOf' : 'tokenURI')
    if (phase++) assert.equal(decoded.args[0], BigInt(keccak256(toHex('tagai'))))
    return encodeFunctionResult({ abi: aggregate, functionName: 'aggregate3', result: [{ success: true,
      returnData: encodeFunctionResult({ abi, functionName: decoded.functionName, result: decoded.functionName === 'handleOf' ? 'tagai' : 'https://agentid.prd.space.id/metadata/tagai.json' }) }] })
  } }, { retryCount: 0 }) })
  const result = await readAgentIdAvatarUris(client, [wallet, wallet.toUpperCase().replace('0X', '0x'), 'invalid'])
  assert.equal(result[wallet], 'https://agentid.prd.space.id/metadata/tagai.json')
  assert.equal(phase, 2)
})
test('absent Multicall or wrong chain performs no contract reads', async () => {
  assert.deepEqual(await readAgentIdAvatarUris({ chain: { id: 4663 } }, [wallet]), {})
  assert.deepEqual(await readAgentIdAvatarUris({ chain: { id: 56 }, getBlockNumber: async () => 1n, getBytecode: async () => '0x' }, [wallet]), {})
})
test('metadata and artwork must be official; no wallet or arbitrary profile URL is fetched', async () => {
  let count = 0
  const request = async (url, options) => { count++; assert.equal(options.credentials, 'omit'); return { ok: true, text: async () => JSON.stringify({ image: 'https://agentid-nft.prd.space.id/prd/1/image.png' }) } }
  assert.equal(await fetchAgentIdImage('https://agentid.prd.space.id/metadata/tagai.json', request), 'https://agentid-nft.prd.space.id/prd/1/image.png')
  for (const url of ['http://localhost/x', 'https://evil.com/metadata/a.json', 'javascript:alert(1)']) assert.equal(await fetchAgentIdImage(url, request), '')
  assert.equal(count, 1)
  assert.equal(await fetchAgentIdImage('https://agentid.prd.space.id/metadata/tagai.json', async () => ({ ok: true, text: async () => JSON.stringify({ image: 'javascript:alert(1)' }) })), '')
})
