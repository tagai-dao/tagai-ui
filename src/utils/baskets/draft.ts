import { getAddress, isAddress } from 'viem'
import type { BasketPoolKey } from '@/config/baskets'
import type { BasketLegRoute } from './types'

// Restore the exact direct-pool key and quote currency on both chains. Replacing
// a USDG key with native ETH during restoration would silently change the trade.
export function restoreBasketDraftRoute(raw: any, chainId: number): BasketLegRoute | null {
  if (!raw || !isAddress(raw.poolQuoteToken) || ![0, 1, 2, 3].includes(raw.venue)) return null
  const quote = getAddress(raw.poolQuoteToken)
  const key = raw.v4Pool
  if (!key || ![key.currency0, key.currency1, key.hooks].every(value => isAddress(value))) return null
  if (!Number.isInteger(key.fee) || key.fee < 0 || key.fee > 0xffffff || !Number.isInteger(key.tickSpacing) || key.tickSpacing < -0x800000 || key.tickSpacing > 0x7fffff) return null
  if (chainId === 56 && (!isAddress(key.poolManager) || !/^0x[\da-fA-F]{64}$/.test(key.parameters ?? ''))) return null
  if (!Number.isInteger(raw.v3Fee) || raw.v3Fee < 0 || raw.v3Fee >= 1_000_000 || (raw.venue === 1 && raw.v3Fee === 0)) return null
  const v4Pool: BasketPoolKey = { currency0: getAddress(key.currency0), currency1: getAddress(key.currency1), fee: key.fee, tickSpacing: key.tickSpacing, hooks: getAddress(key.hooks),
    ...(chainId === 56 ? { poolManager: getAddress(key.poolManager), parameters: key.parameters } : {}) }
  return { venue: raw.venue, poolQuoteToken: quote, v4Pool, v3Fee: raw.v3Fee,
    ...(Number.isInteger(raw.defaultMaxExecutionLossBps) && raw.defaultMaxExecutionLossBps > 0 && raw.defaultMaxExecutionLossBps < 10_000 ? { defaultMaxExecutionLossBps: raw.defaultMaxExecutionLossBps } : {}) }
}
