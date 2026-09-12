<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useChainStore } from '@/stores/chain'
import { useTheme } from '@/composables/useTheme'
import { getDexScreenerEmbedPath } from '@/utils/pumpVersion'
import Kline from '@/views/buy-sell/Kline.vue'
import { communityChartPeriods, type CommunityChartPeriod } from '@/utils/communityChartPeriod'

const comStore = useCommunityStore()
const chainStore = useChainStore()
const { isDark } = useTheme()
const period = ref<CommunityChartPeriod>('h24')
const selected = computed(() => communityChartPeriods.find(p => p.key === period.value)!)
const scope = computed(() => `${chainStore.activeChainId}:${comStore.currentSelectedCommunity?.token || ''}`)
type Pair = { chainId: string; pairAddress: string; baseToken: { address: string }; liquidity?: { usd?: number }; priceChange?: Record<string, number> }
const pair = ref<Pair | null>(null)
function publish(change: number | null) {
  comStore.chartQuote = { scope: scope.value, period: period.value, change: change != null && Number.isFinite(change) ? change : null }
}
watch([period, pair], () => {
  publish(comStore.currentSelectedCommunity?.listed ? pair.value?.priceChange?.[period.value] ?? null : null)
}, { flush: 'sync' })
watch([scope, () => !!comStore.currentSelectedCommunity?.listed], (_, __, cleanup) => {
  period.value = 'h24'
  pair.value = null
  publish(null)
  if (!comStore.currentSelectedCommunity?.listed) return
  const token = comStore.currentSelectedCommunity.token
  const chain = chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc'
  const preferred = (getDexScreenerEmbedPath(comStore.currentSelectedCommunity) || '').toLowerCase()
  let disposed = false
  let controller: AbortController | undefined
  async function refresh() {
    if (controller) return
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), 10000)
    try {
      const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chain}/${token}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Market data unavailable')
      const rows = await response.json() as Pair[]
      const eligible = Array.isArray(rows) ? rows.filter(p => p.chainId === chain && p.baseToken?.address?.toLowerCase() === token.toLowerCase()) : []
      const next = eligible.find(p => p.pairAddress?.toLowerCase() === preferred)
        || eligible.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] || null
      if (!disposed) pair.value = next
    } catch { if (!disposed) pair.value = null }
    finally { clearTimeout(timeout); controller = undefined }
  }
  void refresh()
  const timer = setInterval(() => void refresh(), 60000)
  cleanup(() => { disposed = true; clearInterval(timer); controller?.abort() })
}, { immediate: true })
onBeforeUnmount(() => { comStore.chartQuote = { scope: '', period: 'h24', change: null } })
const chartUrl = computed(() => {
  const chain = chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc'
  const theme = isDark.value ? 'dark' : 'light'
  return `https://dexscreener.com/${chain}/${pair.value?.pairAddress || getDexScreenerEmbedPath(comStore.currentSelectedCommunity)}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=0&chartDefaultOnMobile=1&chartTheme=${theme}&theme=${theme}&chartStyle=1&chartType=usd&interval=${selected.value.interval}`
})
</script>

<template>
  <div class="w-full min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
    <div class="flex items-center gap-2 p-2" role="tablist" aria-label="Chart period">
      <button v-for="option in communityChartPeriods" :key="option.key" role="tab" :aria-selected="period === option.key"
        class="h-9 flex-1 rounded-lg text-sm font-semibold" :class="period === option.key ? 'bg-orange-normal text-white' : 'text-muted'"
        @click="period = option.key">{{ option.label }}</button>
    </div>
    <template v-if="comStore.currentSelectedCommunity?.tick">
      <Kline v-if="!comStore.currentSelectedCommunity.listed" :tick="comStore.currentSelectedCommunity.tick" :period="selected.internal" :change-seconds="selected.seconds" @change="publish" chart-id="community-mobile-chart" />
      <iframe v-else :src="chartUrl" :title="`${comStore.currentSelectedCommunity.tick} K-line`" class="block w-full h-[360px] border-0" />
    </template>
  </div>
</template>
