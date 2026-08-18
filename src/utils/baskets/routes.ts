import type { Address } from 'viem'
import { getBasketDeployment, toContractPoolKey } from '@/config/baskets'
import type { BasketLegRoute } from './types'

export const isBscBasketV3 = (chainId: number, version?: number): boolean =>
  chainId === 56 && Number(version) >= 3

export const getPoolQuoteToken = (
  route: BasketLegRoute,
  chainId: number,
  version?: number,
): Address => {
  const deployment = getBasketDeployment(chainId)
  if (isBscBasketV3(chainId, version)) {
    if (!route.poolQuoteToken) throw new Error('BSC Basket V3 route is missing its direct pool quote token')
    return route.poolQuoteToken
  }
  if (chainId === 56) {
    return route.quoteToken === 1
      ? deployment.contracts.settlementToken
      : deployment.contracts.wrappedNative
  }
  return deployment.contracts.wrappedNative
}

export const toContractLegRoute = (
  route: BasketLegRoute,
  chainId: number,
  version?: number,
) => {
  if (isBscBasketV3(chainId, version)) {
    if (!route.poolQuoteToken) throw new Error('BSC Basket V3 route is missing its direct pool quote token')
    return {
      venue: route.venue,
      poolQuoteToken: route.poolQuoteToken,
      v4Pool: toContractPoolKey(route.v4Pool, chainId),
      v3Fee: route.v3Fee,
      defaultMaxExecutionLossBps: route.defaultMaxExecutionLossBps ?? 0,
    }
  }
  if (chainId === 56) {
    return {
      venue: route.venue,
      quoteToken: route.quoteToken ?? 0,
      v4Pool: toContractPoolKey(route.v4Pool, chainId),
      v3Fee: route.v3Fee,
    }
  }
  return {
    venue: route.venue,
    v4Pool: toContractPoolKey(route.v4Pool, chainId),
    v3Fee: route.v3Fee,
  }
}
