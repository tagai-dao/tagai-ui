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
  launchNav: number
  currentNavAsOf?: number | null
  toDatePct?: number | null
  dataQuality?: BasketDataQuality
  launchTimeQuality?: BasketLaunchTimeQuality
}

export type BasketDataQuality = 'complete' | 'partial' | 'stale' | 'unavailable'
export type BasketLaunchTimeQuality = 'complete' | 'unavailable'
export type BasketPerformanceRange = '24h' | '7d' | '30d' | 'all'

export type BasketPerformancePoint = {
  timestamp: number
  nav: string
  aumUsd: string | null
  dataQuality: BasketDataQuality
  carriedForward?: boolean
  rangeStart?: boolean
  launchBaseline?: boolean
}

export type BasketPerformance = {
  address: Address
  launchNav: string
  launchTimestamp?: number | null
  launchTimeQuality: BasketLaunchTimeQuality
  currentNav: string | null
  aumUsd?: string | null
  toDatePct?: number | null
  changePct?: number | null
  asOf: number | null
  dataQuality: BasketDataQuality
  pricingVersion?: string | null
}

export type BasketPerformanceSeries = BasketPerformance & {
  range: BasketPerformanceRange
  interval: number
  rangeStartPoint: BasketPerformancePoint | null
  points: BasketPerformancePoint[]
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
