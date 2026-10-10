import type { Address } from 'viem'
import { getBasketDeployment, toContractPoolKey } from '@/config/baskets'
import type { BasketLegRoute } from './types'

export const isBscBasketV3 = (chainId: number, version?: number): boolean =>
  (chainId === 56 || chainId === 4663) && Number(version) >= 3

export const getPoolQuoteToken = (
  route: BasketLegRoute,
  chainId: number,
  version?: number,
): Address => {
  const deployment = getBasketDeployment(chainId)
  if (isBscBasketV3(chainId, version)) {
    if (!route.poolQuoteToken) throw new Error('Basket V3 route is missing its direct pool quote token')
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
    if (!route.poolQuoteToken) throw new Error('Basket V3 route is missing its direct pool quote token')
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

/** Labels the actual counter-currency, including native ETH versus WETH. */
export function basketRouteQuoteSymbol(route: BasketLegRoute, chainId: number): string {
  const deployment = getBasketDeployment(chainId)
  const quote = getPoolQuoteToken(route, chainId, deployment.creationVersion).toLowerCase()
  if (quote === '0x0000000000000000000000000000000000000000') return deployment.nativeSymbol
  if (quote === deployment.contracts.settlementToken.toLowerCase()) return deployment.settlementSymbol
  if (quote === deployment.contracts.wrappedNative.toLowerCase()) return deployment.wrappedNativeSymbol
  return `${quote.slice(0, 8)}…${quote.slice(-6)}`
}
