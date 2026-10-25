import { isAddress, keccak256, toHex, parseAbi, type PublicClient, type Address } from 'viem'

export const AGENT_ID_REGISTRY = '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F' as const
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const ABI = parseAbi(['function handleOf(address) view returns(string)', 'function tokenURI(uint256) view returns(string)'])

/** Two dependent phases always use the same on-chain Multicall snapshot. */
export async function readAgentIdAvatarUris(client: PublicClient, addresses: string[]) {
  const result: Record<string, string> = {}
  if (client.chain?.id !== 56) return result
  const unique = [...new Set(addresses.filter(a => isAddress(a, { strict: false })).map(a => a.toLowerCase()))] as Address[]
  if (!unique.length) return result
  const blockNumber = await client.getBlockNumber()
  const code = await client.getBytecode({ address: MULTICALL, blockNumber })
  if (!code || code === '0x') return result
  for (let offset = 0; offset < unique.length; offset += 40) {
    const chunk = unique.slice(offset, offset + 40)
    const handles = await client.multicall({ multicallAddress: MULTICALL, blockNumber, batchSize: 0, allowFailure: true,
      contracts: chunk.map(address => ({ address: AGENT_ID_REGISTRY, abi: ABI, functionName: 'handleOf' as const, args: [address] as const })),
    })
    const owners = chunk.flatMap((address, i) => {
      const row = handles[i]
      return row?.status === 'success' && typeof row.result === 'string' && /^[a-z0-9]{1,64}$/.test(row.result)
        ? [{ address, id: BigInt(keccak256(toHex(row.result))) }] : []
    })
    if (!owners.length) continue
    const uris = await client.multicall({ multicallAddress: MULTICALL, blockNumber, batchSize: 0, allowFailure: true,
      contracts: owners.map(owner => ({ address: AGENT_ID_REGISTRY, abi: ABI, functionName: 'tokenURI' as const, args: [owner.id] as const })),
    })
    owners.forEach((owner, i) => {
      const row = uris[i]
      if (row?.status === 'success' && typeof row.result === 'string') result[owner.address] = row.result
    })
  }
  return result
}

export async function fetchAgentIdImage(uri: string, request = fetch): Promise<string> {
  // Only the official metadata origin; never fetch an arbitrary profile URL.
  if (!/^https:\/\/agentid\.prd\.space\.id\/metadata\/[a-z0-9]{1,64}\.json$/.test(uri)) return ''
  const response = await request(uri, { signal: AbortSignal.timeout(5000), credentials: 'omit', redirect: 'error' })
  if (!response.ok) return ''
  const text = await response.text()
  if (text.length > 65536) return ''
  const image = JSON.parse(text)?.image
  return typeof image === 'string' && /^https:\/\/agentid-nft\.prd\.space\.id\//.test(image) ? image : ''
}
