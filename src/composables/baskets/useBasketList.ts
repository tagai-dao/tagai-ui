/**
 * Baskets 列表
 * - 渐进加载：meta 到了先出卡片，成分 top 后台补
 */
import { ref } from 'vue'
import { listBaskets } from '@/utils/baskets/data'
import type { BasketSummary } from '@/utils/baskets/types'
import { BASKET_CHAIN_ID } from '@/config/baskets'

export const useBasketList = () => {
  const baskets = ref<BasketSummary[]>([])
  const isLoading = ref(false)
  const hasError = ref(false)
  const errorMessage = ref('')
  const searchQuery = ref('')
  /** 卡片已出、成分权重仍在补 */
  const isEnriching = ref(false)

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
    const hasExistingList = baskets.value.length > 0
    isLoading.value = true
    isEnriching.value = false
    hasError.value = false
    errorMessage.value = ''
    try {
      const full = await listBaskets(BASKET_CHAIN_ID, {
        force,
        onShell: (shell) => {
          // 首屏：name / AUM / NAV 已够展示，结束全屏 loading
          baskets.value = shell
          isLoading.value = false
          isEnriching.value = true
        },
      })
      baskets.value = full
    } catch (e) {
      hasError.value = true
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load baskets'
      if (!hasExistingList) baskets.value = []
    } finally {
      isLoading.value = false
      isEnriching.value = false
    }
  }

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
