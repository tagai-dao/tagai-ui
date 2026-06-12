import type { BattleData, EventPredictData } from '@/types'

/** 池内各 outcome 抵押代币总量（trade_volume 未就绪时的回退口径） */
export function poolCollateralTokens(market: BattleData | EventPredictData): number {
  const outcomeReserves = (market as EventPredictData).outcomeReserves
  if (outcomeReserves?.length) {
    return outcomeReserves.reduce((sum, r) => sum + Number(r ?? 0), 0)
  }
  return Number(market.reserveA ?? 0) + Number(market.reserveB ?? 0)
}

/**
 * Vol 展示用的社区代币数量：优先 DB 累计成交量；为 0 且池内有抵押时回退池规模（兼容未回填 trade_volume）
 */
export function predictVolTokenAmount(market: BattleData | EventPredictData): number {
  const traded = Number(market.tradeVolume ?? 0)
  if (traded > 0) return traded
  const pool = poolCollateralTokens(market)
  if (pool > 0) return pool
  return traded
}
