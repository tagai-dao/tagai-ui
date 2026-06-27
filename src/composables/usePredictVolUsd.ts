import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { BattleData, Community, EventPredictData } from '@/types'
import { useStateStore } from '@/stores/common'
import { useCommunityStore } from '@/stores/community'
import { useCommunityTokenPrice } from '@/composables/useCommunityTokenPrice'
import { predictVolTokenAmount } from '@/utils/predictVol'
import { getImportTokenPrice } from '@/utils/pump'

/**
 * 导入型代币真实现货价（BNB/token）缓存。
 * priceOfTick = marketCap / TotalSupply 仅对 TagAI 原生币成立；导入币真实供应量 ≠ TotalSupply，
 * 故其单价（及预测 Vol）会偏差上百倍，须改用池子现货价。按 token 全局缓存，避免重复链上读取。
 */
const importPriceCache = new Map<string, number>()
const importPriceInflight = new Map<string, Promise<number | undefined>>()

/** 预测市场 Vol 美元估值（与列表卡片、社区标签排序同口径） */
export function usePredictVolUsd(market: MaybeRefOrGetter<BattleData | EventPredictData>) {
  const stateStore = useStateStore()
  const comStore = useCommunityStore()
  const { priceOfTick } = useCommunityTokenPrice()
  const importPriceBnb = ref(0)

  const findCommunity = (tick?: string): Community | undefined => {
    if (!tick) return undefined
    const lists = [comStore.trendingCommunities, comStore.newCommunities, comStore.marketCapCommunities]
    for (const l of lists) {
      const hit = (l as Community[])?.find(c => c.tick === tick)
      if (hit) return hit
    }
    return comStore.currentSelectedCommunity?.tick === tick ? comStore.currentSelectedCommunity : undefined
  }

  // 导入币：异步取池子现货价并缓存（非导入币走 priceOfTick，无需链上读取）
  watch(
    () => {
      const m = toValue(market) as any
      return `${m?.tick ?? ''}|${m?.token ?? ''}`
    },
    async () => {
      importPriceBnb.value = 0
      const m = toValue(market) as any
      const com = findCommunity(m?.tick)
      if (!com?.isImport) return
      const token: string | undefined = m?.token || com.token
      const pair = com.pair
      if (!token || !pair) return
      if (importPriceCache.has(token)) {
        importPriceBnb.value = importPriceCache.get(token)!
        return
      }
      let task = importPriceInflight.get(token)
      if (!task) {
        task = getImportTokenPrice(token, pair, com.dexVersion ?? 4, {}, stateStore.ethPrice)
          .catch(() => undefined)
          .finally(() => importPriceInflight.delete(token))
        importPriceInflight.set(token, task)
      }
      const p = await task
      if (p != null && isFinite(p) && p > 0) {
        importPriceCache.set(token, p)
        // 仅当当前 market 仍是同一币种时写入，避免快速切换造成串值
        const cur = toValue(market) as any
        if ((cur?.token || findCommunity(cur?.tick)?.token) === token) importPriceBnb.value = p
      }
    },
    { immediate: true },
  )

  return computed(() => {
    const m = toValue(market)
    const tokens = predictVolTokenAmount(m)
    if (!tokens) return 0
    const com = findCommunity(m.tick)
    const priceBnb = com?.isImport ? importPriceBnb.value : priceOfTick(m.tick)
    return tokens * priceBnb * stateStore.ethPrice
  })
}
