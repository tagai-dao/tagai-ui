/**
 * Baskets 详情
 */
import { ref } from 'vue'
import { isAddress, type Address } from 'viem'
import { getBasketDetail } from '@/utils/baskets/data'
import type { BasketDetail } from '@/utils/baskets/types'
import { BASKET_CHAIN_ID } from '@/config/baskets'

export const useBasketDetail = () => {
  const detail = ref<BasketDetail | null>(null)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const hasError = ref(false)
  const errorMessage = ref('')
  let requestId = 0

  /**
   * force=true 绕过短时缓存。
   * 同一 Basket 已经展示时使用静默刷新，保留页面和滚动位置，
   * 新数据返回后再原位替换。
   */
  const load = async (address: string, force = false) => {
    const currentRequest = ++requestId
    if (!isAddress(address)) {
      hasError.value = true
      errorMessage.value = 'Invalid basket address'
      detail.value = null
      return
    }
    const normalizedAddress = address.toLowerCase()
    const canRefreshSilently = detail.value?.address.toLowerCase() === normalizedAddress
    if (canRefreshSilently) {
      isRefreshing.value = true
    } else {
      isLoading.value = true
      hasError.value = false
      errorMessage.value = ''
    }
    try {
      const next = await getBasketDetail(address as Address, BASKET_CHAIN_ID, { force })
      if (currentRequest !== requestId) return
      detail.value = next
      hasError.value = false
      errorMessage.value = ''
    } catch (e) {
      if (currentRequest !== requestId) return
      if (canRefreshSilently) {
        console.warn('[baskets] silent detail refresh failed', e)
      } else {
        hasError.value = true
        errorMessage.value = e instanceof Error ? e.message : 'Failed to load basket'
        detail.value = null
      }
    } finally {
      if (currentRequest === requestId) {
        isLoading.value = false
        isRefreshing.value = false
      }
    }
  }

  return { detail, isLoading, isRefreshing, hasError, errorMessage, load }
}
