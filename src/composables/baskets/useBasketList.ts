/**
 * Baskets 列表
 */
import { ref } from 'vue'
import { listBaskets, type BasketSummary } from '@/utils/spectrum/basket-data'
import { SPECTRUM_CHAIN_ID } from '@/config/spectrum'

export const useBasketList = () => {
  const baskets = ref<BasketSummary[]>([])
  const isLoading = ref(false)
  const hasError = ref(false)
  const errorMessage = ref('')
  const searchQuery = ref('')

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
    isLoading.value = true
    hasError.value = false
    errorMessage.value = ''
    try {
      baskets.value = await listBaskets(SPECTRUM_CHAIN_ID, { force })
    } catch (e) {
      hasError.value = true
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load baskets'
      baskets.value = []
    } finally {
      isLoading.value = false
    }
  }

  return {
    baskets,
    isLoading,
    hasError,
    errorMessage,
    searchQuery,
    filteredBaskets,
    refresh,
  }
}
