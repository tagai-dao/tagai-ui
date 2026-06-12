import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { BattleData, EventPredictData } from '@/types'
import { useStateStore } from '@/stores/common'
import { useCommunityTokenPrice } from '@/composables/useCommunityTokenPrice'
import { predictVolTokenAmount } from '@/utils/predictVol'

/** 预测市场 Vol 美元估值（与列表卡片、社区标签排序同口径） */
export function usePredictVolUsd(market: MaybeRefOrGetter<BattleData | EventPredictData>) {
  const stateStore = useStateStore()
  const { priceOfTick } = useCommunityTokenPrice()

  return computed(() => {
    const m = toValue(market)
    const tokens = predictVolTokenAmount(m)
    if (!tokens) return 0
    return tokens * priceOfTick(m.tick) * stateStore.ethPrice
  })
}
