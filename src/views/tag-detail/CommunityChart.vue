<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useChainStore } from '@/stores/chain'
import { useTheme } from '@/composables/useTheme'
import { getDexScreenerEmbedPath } from '@/utils/pumpVersion'
import { useDexScreenerPair } from '@/composables/useDexScreenerPair'
import Kline from '@/views/buy-sell/Kline.vue'
import { communityChartPeriods, type CommunityChartPeriod } from '@/utils/communityChartPeriod'

const comStore = useCommunityStore()
const chainStore = useChainStore()
const { isDark } = useTheme()
const period = ref<CommunityChartPeriod>('h24')
const selected = computed(() => communityChartPeriods.find(p => p.key === period.value)!)
const scope = computed(() => `${chainStore.activeChainId}:${comStore.currentSelectedCommunity?.token || ''}`)
const { pair, useDexScreener, onEmbedError } = useDexScreenerPair(() => ({
  chain: chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc',
  token: comStore.currentSelectedCommunity?.token,
  preferred: getDexScreenerEmbedPath(comStore.currentSelectedCommunity),
  enabled: !!comStore.currentSelectedCommunity?.listed,
}))
function publish(change: number | null) {
  comStore.chartQuote = { scope: scope.value, period: period.value, change: change != null && Number.isFinite(change) ? change : null }
}
watch([period, pair, useDexScreener], () => {
  publish(useDexScreener.value ? pair.value?.priceChange?.[period.value] ?? null : null)
}, { flush: 'sync' })
watch(scope, () => {
  period.value = 'h24'
  publish(null)
}, { flush: 'sync' })
onBeforeUnmount(() => { comStore.chartQuote = { scope: '', period: 'h24', change: null } })
const chartUrl = computed(() => {
  const chain = chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc'
  const theme = isDark.value ? 'dark' : 'light'
  return `https://dexscreener.com/${chain}/${pair.value?.pairAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=0&chartDefaultOnMobile=1&chartTheme=${theme}&theme=${theme}&chartStyle=1&chartType=usd&interval=${selected.value.interval}`
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
      <Kline v-if="!useDexScreener" :key="scope" :tick="comStore.currentSelectedCommunity.tick" :period="selected.internal" :change-seconds="selected.seconds" @change="publish" chart-id="community-mobile-chart" />
      <iframe v-else :src="chartUrl" @error="onEmbedError" :title="`${comStore.currentSelectedCommunity.tick} K-line`" class="block w-full h-[360px] border-0" />
    </template>
  </div>
</template>
