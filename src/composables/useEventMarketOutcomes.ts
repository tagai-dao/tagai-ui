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

/** 按池子储备计算边际概率（0~1） */
export const calcOutcomePercents = (reserves: number[]) => {
  const total = reserves.reduce((sum, r) => sum + (r ?? 0), 0)
  if (total <= 0) {
    const n = Math.max(reserves.length, 1)
    return reserves.map(() => 1 / n)
  }
  return reserves.map(r => (r ?? 0) / total)
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
