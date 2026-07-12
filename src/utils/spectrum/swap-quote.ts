/**
 * 买卖报价（纯函数）— 移植自 Spectrum swap-quote.ts
 */
import { parseUnits } from 'viem'
import { deriveLegMins, clampSlippageBps } from './hook-data'
import { SPECTRUM_USDC_DECIMALS } from '@/config/spectrum'

export type TradeSide = 'buy' | 'sell'

export type QuoteLeg = {
  symbol: string
  decimals: number
  targetWeightPct: number
  priceUsd: number
}

export type SwapQuoteInput = {
  side: TradeSide
  amount: number
  navPerToken: number
  feeFrac: number
  slippageBps: number
  holdings: ReadonlyArray<QuoteLeg>
  basketDecimals: number
}

export type SwapQuote = {
  quotedLegAmounts: bigint[]
  amountRaw: bigint
  minOutRaw: bigint
  legCount: number
  /** 预估到手（未扣滑点地板，仅 UI） */
  estimatedOut: number
}

export const toRaw = (value: number, decimals: number): bigint => {
  if (!Number.isFinite(value) || value <= 0) return 0n
  try {
    return parseUnits(value.toFixed(Math.min(decimals, 18)), decimals)
  } catch {
    return 0n
  }
}

/**
 * 推导可广播的 swap 参数；任一腿未定价或金额过小 → null（禁止交易）
 */
export const buildSwapQuote = (input: SwapQuoteInput): SwapQuote | null => {
  const { side, amount, navPerToken, feeFrac, slippageBps, holdings, basketDecimals } = input
  if (!(amount > 0) || !(navPerToken > 0) || !Number.isFinite(feeFrac)) return null
  if (holdings.length === 0) return null

  const estimatedOut =
    side === 'buy'
      ? (amount * (1 - feeFrac)) / navPerToken
      : amount * navPerToken * (1 - feeFrac)
  const minOut = estimatedOut * (1 - clampSlippageBps(slippageBps) / 10_000)
  const shareDecimals = Math.min(basketDecimals, 18)
  const amountRaw = side === 'buy' ? toRaw(amount, SPECTRUM_USDC_DECIMALS) : toRaw(amount, shareDecimals)
  const minOutRaw = side === 'buy' ? toRaw(minOut, shareDecimals) : toRaw(minOut, SPECTRUM_USDC_DECIMALS)
  if (amountRaw <= 0n || minOutRaw <= 0n) return null

  const legCount = holdings.length
  if (side === 'sell') {
    return { quotedLegAmounts: [], amountRaw, minOutRaw, legCount, estimatedOut }
  }

  // BUY：按目标权重拆净 USDC，推算各腿买入量
  const usdNet = amount * (1 - feeFrac)
  const quotedLegAmounts = holdings.map((h) => {
    if (!(h.priceUsd > 0)) return 0n
    const legUsd = (h.targetWeightPct / 100) * usdNet
    return toRaw(legUsd / h.priceUsd, h.decimals)
  })
  if (quotedLegAmounts.some((q) => q <= 0n)) return null
  // 与 hook-data 一致：滑点后 legMin 不能变 0
  if (deriveLegMins(quotedLegAmounts, slippageBps).some((m) => m <= 0n)) return null

  return { quotedLegAmounts, amountRaw, minOutRaw, legCount, estimatedOut }
}
