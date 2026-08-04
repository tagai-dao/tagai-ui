import { encodeAbiParameters, type Address, type Hex } from 'viem'
import {
  BASKET_DEFAULT_SLIPPAGE_BPS,
  BASKET_FRONTEND_FEE_WALLET,
  BASKET_MAX_SLIPPAGE_BPS,
} from '@/config/baskets'
import type { TradeSide } from './types'

export const clampBasketSlippage = (bps: number): number => {
  if (!Number.isFinite(bps)) return BASKET_DEFAULT_SLIPPAGE_BPS
  return Math.min(Math.max(Math.round(bps), 1), BASKET_MAX_SLIPPAGE_BPS)
}

export const applySlippage = (amount: bigint, bps: number): bigint =>
  amount * BigInt(10_000 - clampBasketSlippage(bps)) / 10_000n

export const encodeBasketTradeData = ({
  chainId,
  side,
  minOut,
  legCount,
  firstMint = false,
  frontend = BASKET_FRONTEND_FEE_WALLET,
  legMins,
}: {
  chainId: number
  side: TradeSide
  minOut: bigint
  legCount: number
  firstMint?: boolean
  frontend?: Address
  legMins?: bigint[]
}): Hex => {
  const common = {
    frontend,
    minBasketOut: side === 'buy' ? minOut : 0n,
    minSettlementOut: side === 'sell' ? minOut : 0n,
    legMins: side === 'buy'
      ? (legMins ?? (firstMint ? Array.from({ length: legCount }, () => 1n) : []))
      : [],
    legSqrtPriceLimitsX96: [],
    allowFailedLegs: side === 'sell' ? Array.from({ length: legCount }, () => true) : [],
  }

  if (chainId === 56) {
    return encodeAbiParameters(
      [{
        type: 'tuple',
        components: [
          { name: 'frontend', type: 'address' },
          { name: 'minBasketOut', type: 'uint256' },
          { name: 'minSettlementOut', type: 'uint256' },
          { name: 'legMins', type: 'uint256[]' },
          { name: 'legSqrtPriceLimitsX96', type: 'uint160[]' },
          { name: 'settlementToWbnbSqrtPriceLimitX96', type: 'uint160' },
          { name: 'wbnbToSettlementSqrtPriceLimitX96', type: 'uint160' },
          { name: 'allowFailedLegs', type: 'bool[]' },
        ],
      }],
      [{
        ...common,
        settlementToWbnbSqrtPriceLimitX96: 0n,
        wbnbToSettlementSqrtPriceLimitX96: 0n,
      }],
    )
  }

  return encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'frontend', type: 'address' },
        { name: 'minBasketOut', type: 'uint256' },
        { name: 'minUsdgOut', type: 'uint256' },
        { name: 'legMins', type: 'uint256[]' },
        { name: 'legSqrtPriceLimitsX96', type: 'uint160[]' },
        { name: 'hubSqrtPriceLimitX96', type: 'uint160' },
        { name: 'allowFailedLegs', type: 'bool[]' },
      ],
    }],
    [{
      frontend: common.frontend,
      minBasketOut: common.minBasketOut,
      minUsdgOut: common.minSettlementOut,
      legMins: common.legMins,
      legSqrtPriceLimitsX96: common.legSqrtPriceLimitsX96,
      hubSqrtPriceLimitX96: 0n,
      allowFailedLegs: common.allowFailedLegs,
    }],
  )
}
