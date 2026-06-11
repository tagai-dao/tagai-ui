import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { EventPredictData, EventPredictOutcome } from '@/types'

/** K 线 / outcome 按钮配色 */
export const OUTCOME_CHART_COLORS = ['#EF5350', '#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']

export const isMultiOutcomeMarket = (market?: EventPredictData | null) => {
  if (!market) return false
  if (market.factoryVersion === 2) {
    return (market.outcomeCount ?? market.outcomes?.length ?? 0) > 2
  }
  return false
}

/** 归一化 outcome 列表；二元市场 fallback 为 Yes/No */
export const getOutcomeList = (market: EventPredictData): EventPredictOutcome[] => {
  if (market.outcomes?.length) {
    return [...market.outcomes].sort((a, b) => a.outcomeIndex - b.outcomeIndex)
  }
  return [
    { outcomeIndex: 0, label: 'Yes' },
    { outcomeIndex: 1, label: 'No' },
  ]
}

/** 从 market 读取各 outcome 池子储备 */
export const getOutcomeReserves = (market: EventPredictData): number[] => {
  if (market.outcomeReserves?.length) {
    return market.outcomeReserves
  }
  return [market.reserveA ?? 0, market.reserveB ?? 0]
}

/** FPMM 边际价格权重：Π_{j≠i} r_j（与 Gnosis FPMM / Polymarket 一致） */
const calcFpmmPriceWeight = (reserves: number[], outcomeIndex: number) => {
  let weight = 1
  for (let j = 0; j < reserves.length; j++) {
    if (j === outcomeIndex) continue
    weight *= reserves[j] ?? 0
  }
  return weight
}

/**
 * 按 FPMM 池子储备计算各 outcome 边际概率（0~1）。
 * 不能用 reserve_i / Σreserve：买入 outcome i 会减少 r_i，简单占比会反向变化。
 * 正确公式：p_i = weight_i / Σ weight_k，其中 weight_i = Π_{j≠i} r_j
 * 二元时等价于 p_yes = r_no / (r_yes + r_no)
 */
export const calcOutcomePercents = (reserves: number[]) => {
  const n = reserves.length
  if (n === 0) return [] as number[]
  if (n === 1) return [1]

  const weights = reserves.map((_, i) => calcFpmmPriceWeight(reserves, i))
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum <= 0) {
    return reserves.map(() => 1 / n)
  }
  return weights.map(w => w / weightSum)
}

/**
 * 将 UI 上的目标概率（整数 %，和为 100）转为链上 FPMM distributionHint。
 * 合约按 hint 比例分配初始池子储备；要使边际价格等于目标概率，需 r_i ∝ ∏_{j≠i} p_j。
 * 二元市场与 createMarket 的 [100-p, p] 约定一致。
 */
export const targetPercentsToDistributionHint = (percents: number[]): number[] => {
  const n = percents.length
  if (n === 0) return []
  if (n === 1) return [100]

  const probs = percents.map(p => Math.max(Number(p) || 0, 1))
  const sum = probs.reduce((a, b) => a + b, 0)
  const p = probs.map(x => x / sum)

  if (n === 2) {
    return [Math.ceil((1 - p[0]) * 100), Math.ceil(p[0] * 100)]
  }

  const weights = p.map((_, i) => {
    let prod = 1
    for (let j = 0; j < n; j++) {
      if (j !== i) prod *= p[j]
    }
    return prod
  })
  const maxW = Math.max(...weights, 1e-12)
  return weights.map(w => Math.max(1, Math.ceil((w / maxW) * 100)))
}

/** Event V2 结算后得票最高的 outcome */
export const getWinningOutcomeIndex = (market: EventPredictData): number | null => {
  if (market.status !== 3) return null
  const outcomes = getOutcomeList(market)
  if (isMultiOutcomeMarket(market) && outcomes.some(o => o.voteTotal != null)) {
    let best = outcomes[0]
    for (const o of outcomes) {
      if ((o.voteTotal ?? 0) > (best.voteTotal ?? 0)) best = o
    }
    return best.outcomeIndex
  }
  if (market.winner === 'yes') return 0
  if (market.winner === 'no') return 1
  const yes = market.voteYes ?? 0
  const no = market.voteNo ?? 0
  return yes >= no ? 0 : 1
}

export const useEventMarketOutcomes = (market: MaybeRefOrGetter<EventPredictData | null | undefined>) => {
  const isMultiOutcome = computed(() => isMultiOutcomeMarket(toValue(market)))
  const outcomeList = computed(() => {
    const m = toValue(market)
    return m ? getOutcomeList(m) : []
  })
  const outcomePercents = computed(() => {
    const m = toValue(market)
    if (!m) return [] as number[]
    return calcOutcomePercents(getOutcomeReserves(m))
  })
  const winningOutcomeIndex = computed(() => {
    const m = toValue(market)
    return m ? getWinningOutcomeIndex(m) : null
  })

  const getPercent = (outcomeIndex: number) => outcomePercents.value[outcomeIndex] ?? 0

  const getOutcomeLabel = (outcomeIndex: number) =>
    outcomeList.value.find(o => o.outcomeIndex === outcomeIndex)?.label ?? `#${outcomeIndex + 1}`

  return {
    isMultiOutcome,
    outcomeList,
    outcomePercents,
    winningOutcomeIndex,
    getPercent,
    getOutcomeLabel,
  }
}
