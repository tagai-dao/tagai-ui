import { isAddress, parseAbi, type Address, type PublicClient } from 'viem'
import { getChainDeployment } from '@/config/chains'

const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const ABI = parseAbi(['function handleOf(address account) view returns (string)'])
const cache = new Map<string, { at: number; handle: string }>()

export type HolderIdentity = {
  agentHandle?: string | null; twitterUsername?: string | null; twitterName?: string | null;
  farcasterName?: string | null; steemId?: string | null; ethAddr: string
  accountType?: number | null; walletType?: number | null; accountSources?: string[] | string | null
}

const usableName = (value: unknown): value is string => typeof value === 'string'
  && !!value.trim() && !isAddress(value.trim(), { strict: false })

export function holderDisplayName(holder: HolderIdentity): string {
  if (usableName(holder.agentHandle)) {
    const handle = holder.agentHandle.trim()
    return /\.ai$/i.test(handle) ? handle : `${handle}.ai`
  }
  for (const value of [holder.twitterUsername, holder.twitterName, holder.farcasterName, holder.steemId]) {
    if (typeof value === 'string' && value.trim() && !isAddress(value.trim(), { strict: false })) return value.trim()
  }
  const address = holder.ethAddr || ''
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-6)}` : address
}

/** Match the icon to the identity actually chosen, not every linked origin. */
export function holderDisplayOrigin(holder: HolderIdentity): 'BINANCE' | 'X' | 'TAGAI' | null {
  if (usableName(holder.agentHandle)) return 'BINANCE'
  if (![holder.twitterUsername, holder.twitterName, holder.farcasterName, holder.steemId].some(usableName)) return null
  const sources = (Array.isArray(holder.accountSources) ? holder.accountSources : String(holder.accountSources || '').split(','))
    .map(source => source.trim().toUpperCase())
  if (![holder.twitterUsername, holder.twitterName].some(usableName)
    || (holder.accountType != null && [1, 2, 3].includes(Number(holder.accountType)))) return 'TAGAI'
  const hasX = (holder.accountType != null && Number(holder.accountType) === 0) || sources.includes('X')
  return hasX && Number(holder.walletType) !== 2 && Number(holder.accountType) !== 3 ? 'X' : 'TAGAI'
}

/** Supplementary metadata only. Independent of the viewed token's protocol. */
export async function readHolderAgentHandles(client: PublicClient, addresses: string[]): Promise<Record<string, string>> {
  const chainId = client.chain?.id
  if (chainId !== 56) return {}
  const deployment = getChainDeployment(chainId)
  const registry = deployment.contracts.handleRegistry16 ?? deployment.contracts.handleRegistry15
  if (!registry) return {}
  const result: Record<string, string> = {}
  const unique = [...new Set(addresses.filter(address => isAddress(address, { strict: false })).map(address => address.toLowerCase()))]
  const missing: Address[] = []
  for (const address of unique) {
    const hit = cache.get(`${chainId}:${registry}:${address}`)
    if (hit && Date.now() - hit.at < 60_000) result[address] = hit.handle
    else missing.push(address as Address)
  }
  if (!missing.length) return result
  try {
    const blockNumber = await client.getBlockNumber()
    const code = await client.getBytecode({ address: MULTICALL, blockNumber })
    if (!code || code === '0x') return result
    for (let offset = 0; offset < missing.length; offset += 40) {
      const chunk = missing.slice(offset, offset + 40)
      const rows = await client.multicall({
        multicallAddress: MULTICALL, blockNumber, allowFailure: true, batchSize: 0,
        contracts: chunk.map(address => ({ address: registry, abi: ABI, functionName: 'handleOf', args: [address] })),
      })
      chunk.forEach((address, index) => {
        const row = rows[index]
        if (row?.status !== 'success' || typeof row.result !== 'string') return
        const handle = row.result.trim() // Render the actual ID; never invent a domain suffix.
        result[address] = handle
        cache.set(`${chainId}:${registry}:${address}`, { at: Date.now(), handle })
        while (cache.size > 2000) cache.delete(cache.keys().next().value!)
      })
    }
  } catch {
    // Identity lookup failures must not hide or block holder balances.
  }
  return result
}
