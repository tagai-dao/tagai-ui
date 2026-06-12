import { useCommunityStore } from '@/stores/community'
import { TotalSupply } from '@/config'
import type { Community } from '@/types'

/** 代币单价（BNB）：list 缓存的 marketCap / 总供应量，避免依赖链上字段 */
export const useCommunityTokenPrice = () => {
  const comStore = useCommunityStore()

  const priceOfTick = (tick: string): number => {
    const lists = [comStore.trendingCommunities, comStore.newCommunities, comStore.marketCapCommunities]
    for (const list of lists) {
      const hit = (list as Community[])?.find(c => c.tick === tick)
      if (hit?.marketCap) return Number(hit.marketCap) / TotalSupply
    }
    return 0
  }

  return { priceOfTick }
}
