import { isAddress } from 'viem'
import type { CommerceResolveResult } from '@/apis/api'

export function verifiedBlink(value: unknown, id: string, chainId: number): CommerceResolveResult {
  const v = value as CommerceResolveResult | undefined
  if (!v || v.commerceId !== id || v.chainId !== chainId ||
      !v.publisher?.twitterId || !v.token || !isAddress(v.token) || !v.tick ||
      (v.publisher.address !== null && !isAddress(v.publisher.address))) {
    throw new Error('Blinks publisher could not be verified. Please retry; no trade was submitted.')
  }
  return v
}

// URL holds only an opaque commerce id, never a trusted payout wallet.
export function blinkIdFromRoute(route: { name?: unknown; params: Record<string, unknown>; query: Record<string, unknown> }): string | null {
  const value = route.name === 'commerce' ? route.params.commerceid
    : ['post-detail', 'space-detail', 'tag-detail', 'buy-sell'].includes(String(route.name)) ? route.query.blink : null
  if (value == null) return null
  if (typeof value !== 'string' || !value || value.length > 200) throw new Error('Invalid Blinks source')
  return value
}

export function blinkMatchesTrade(v: CommerceResolveResult, token: string, chainId: number): boolean {
  return v.chainId === chainId && v.token?.toLowerCase() === token.toLowerCase()
}
