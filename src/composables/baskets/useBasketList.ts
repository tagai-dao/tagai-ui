/**
 * Baskets 列表
 * - 渐进加载：meta 到了先出卡片，成分 top 后台补
 */
import { ref, watch } from 'vue'
import { listBaskets } from '@/utils/baskets/data'
import type { BasketSummary } from '@/utils/baskets/types'
import { useChainStore } from '@/stores/chain'

export const useBasketList = () => {
  const chainStore = useChainStore()
  const baskets = ref<BasketSummary[]>([])
  const isLoading = ref(false)
  const hasError = ref(false)
  const errorMessage = ref('')
  const searchQuery = ref('')
  /** 卡片已出、成分权重仍在补 */
  const isEnriching = ref(false)
  let sequence = 0

  const filteredBaskets = () => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return baskets.value
    return baskets.value.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.symbol.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q),
    )
  }

  /** force=true 绕过短时缓存（刷新按钮） */
  const refresh = async (force = false) => {
    const request = ++sequence
    const chainId = chainStore.activeChainId
    const hasExistingList = baskets.value.length > 0
    isLoading.value = true
    isEnriching.value = false
    hasError.value = false
    errorMessage.value = ''
    try {
      const full = await listBaskets(chainId, {
        force,
        // Shells have no AUM yet. Publishing them prematurely caused the
        // leading indices to jump from the bottom to the top after pricing.
      })
      if (request !== sequence || chainId !== chainStore.activeChainId) return
      baskets.value = full
    } catch (e) {
      if (request !== sequence) return
      hasError.value = true
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load baskets'
      if (!hasExistingList) baskets.value = []
    } finally {
      if (request === sequence) {
        isLoading.value = false
        isEnriching.value = false
      }
    }
  }
  watch(() => chainStore.activeChainId, () => {
    baskets.value = []
    void refresh()
  })

  return {
    baskets,
    isLoading,
    isEnriching,
    hasError,
    errorMessage,
    searchQuery,
    filteredBaskets,
    refresh,
  }
}
