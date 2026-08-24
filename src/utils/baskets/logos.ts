import type { Address } from 'viem'
import { getBasketDeployment } from '@/config/baskets'

type DexPair = {
  baseToken?: { address?: string }
  quoteToken?: { address?: string }
  liquidity?: { usd?: number }
  info?: { imageUrl?: string }
}

const resolvedLogos = new Map<string, Promise<string | null>>()

const chainSlug = (chainId: number) => chainId === 56 ? 'bsc' : chainId === 4663 ? 'robinhood' : ''

export function presetBasketAssetLogo(chainId: number, address: string): string | null {
  const normalized = address.toLowerCase()
  return getBasketDeployment(chainId).assetPresets
    .find(asset => asset.address.toLowerCase() === normalized)?.logoUrl ?? null
}

/**
 * Resolve constituent artwork the same way Spectrum does: known protocol assets
 * stay local, while permissionless assets use the image published with their
 * deepest DexScreener pair. Results (including misses) are cached per session.
 */
export function resolveBasketAssetLogo(chainId: number, address: Address | string): Promise<string | null> {
  const preset = presetBasketAssetLogo(chainId, address)
  if (preset) return Promise.resolve(preset)

  const slug = chainSlug(chainId)
  const normalized = address.toLowerCase()
  if (!slug || !/^0x[0-9a-f]{40}$/.test(normalized)) return Promise.resolve(null)

  const key = `${slug}:${normalized}`
  const cached = resolvedLogos.get(key)
  if (cached) return cached

  const request = (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 6_000)
    try {
      const response = await fetch(
        `https://api.dexscreener.com/tokens/v1/${slug}/${normalized}`,
        { signal: controller.signal, headers: { Accept: 'application/json' } },
      )
      if (!response.ok) return null
      const pairs = await response.json() as DexPair[]
      return pairs
        .filter(pair => pair.info?.imageUrl)
        .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0]
        ?.info?.imageUrl ?? null
    } catch {
      return null
    } finally {
      window.clearTimeout(timeout)
    }
  })()

  resolvedLogos.set(key, request)
  return request
}
