import type { Address } from 'viem'
import type { BasketPoolKey } from '@/config/baskets'

export type BasketLegRoute = {
  venue: number
  /** BSC only: 0 = WBNB, 1 = settlement token (USDT). */
  quoteToken?: 0 | 1
  v4Pool: BasketPoolKey
  v3Fee: number
}

export type BasketHolding = {
  asset: Address
  symbol: string
  decimals: number
  targetWeightPct: number
  balance: number
  priceUsd: number
  valueUsd: number
  priced: boolean
  route: BasketLegRoute
}

export type BasketSummary = {
  chainId: number
  address: Address
  name: string
  symbol: string
  basketLength: number
  navPerToken: number
  aumUsd: number
  pricedCount: number
  top: { address: Address; symbol: string; weightPct: number }[]
  deployer: Address | null
}

export type BasketDetail = BasketSummary & {
  decimals: number
  totalSupply: number
  effectiveSupply: number | null
  fullyPriced: boolean
  basketFeeBps: number
  creatorShareBps: number
  launcher: Address | null
  creator: Address | null
  version: number
  createdAt: number
  lastRebalanceAt: number
  holdings: BasketHolding[]
  updatedAt: string
}

export type TradeSide = 'buy' | 'sell'

export type BasketSwapQuote = {
  amountRaw: bigint
  estimatedOutRaw: bigint
  estimatedOut: number
  minOutRaw: bigint
  legCount: number
  legMins: bigint[]
  source: 'quoter' | 'nav'
}
