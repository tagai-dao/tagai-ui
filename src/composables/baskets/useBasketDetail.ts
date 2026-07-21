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
  const hasError = ref(false)
  const errorMessage = ref('')

  /** force=true 绕过短时缓存 */
  const load = async (address: string, force = false) => {
    if (!isAddress(address)) {
      hasError.value = true
      errorMessage.value = 'Invalid basket address'
      detail.value = null
      return
    }
    isLoading.value = true
    hasError.value = false
    errorMessage.value = ''
    try {
      detail.value = await getBasketDetail(address as Address, BASKET_CHAIN_ID, { force })
    } catch (e) {
      hasError.value = true
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load basket'
      detail.value = null
    } finally {
      isLoading.value = false
    }
  }

  return { detail, isLoading, hasError, errorMessage, load }
}
