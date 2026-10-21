/**
 * Baskets 列表
 * - 渐进加载：meta 到了先出卡片，成分 top 后台补
 */
import { onUnmounted, ref, watch } from 'vue'
import { listBaskets } from '@/utils/baskets/data'
import type { BasketSummary } from '@/utils/baskets/types'
import { useChainStore } from '@/stores/chain'
import { readPublicSnapshot, writePublicSnapshot } from '@/utils/publicSnapshot'

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
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retries = 0

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
    clearTimeout(retryTimer)
    const request = ++sequence
    const chainId = chainStore.activeChainId
    const scope = `${chainId}:basket-list:display-v1`
    if (!baskets.value.length) baskets.value = readPublicSnapshot<BasketSummary[]>(scope) || []
    const hasExistingList = baskets.value.length > 0
    isLoading.value = true
    isEnriching.value = false
    hasError.value = false
    errorMessage.value = ''
    try {
      const full = await listBaskets(chainId, {
        force,
        previous: baskets.value,
        onShell: shells => {
          if (request !== sequence || chainId !== chainStore.activeChainId || hasExistingList) return
          baskets.value = shells
        },
      })
      if (request !== sequence || chainId !== chainStore.activeChainId) return
      baskets.value = full
      writePublicSnapshot(scope, full)
      if (full.some(item => item.dataQuality === 'unavailable' || item.dataQuality === 'stale') && retries < 3) {
        retries += 1
        retryTimer = setTimeout(() => { void refresh(true) }, retries * 5000)
      }
    } catch (e) {
      if (request !== sequence) return
      hasError.value = true
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load baskets'
      if (!hasExistingList) baskets.value = []
      if (retries < 3) {
        retries += 1
        retryTimer = setTimeout(() => { void refresh(true) }, retries * 5000)
      }
    } finally {
      if (request === sequence) {
        isLoading.value = false
        isEnriching.value = false
      }
    }
  }
  watch(() => chainStore.activeChainId, () => {
    retries = 0
    baskets.value = []
    void refresh()
  })
  onUnmounted(() => { sequence += 1; clearTimeout(retryTimer) })

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
