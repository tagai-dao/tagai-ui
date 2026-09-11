<script setup lang="ts">
import { computed } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useChainStore } from '@/stores/chain'
import { useTheme } from '@/composables/useTheme'
import { getDexScreenerEmbedPath } from '@/utils/pumpVersion'
import Kline from '@/views/buy-sell/Kline.vue'

const comStore = useCommunityStore()
const chainStore = useChainStore()
const { isDark } = useTheme()
const chartUrl = computed(() => {
  const chain = chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc'
  const theme = isDark.value ? 'dark' : 'light'
  return `https://dexscreener.com/${chain}/${getDexScreenerEmbedPath(comStore.currentSelectedCommunity)}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=0&chartDefaultOnMobile=1&chartTheme=${theme}&theme=${theme}&chartStyle=1&chartType=usd&interval=15`
})
</script>

<template>
  <div class="w-full min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
    <template v-if="comStore.currentSelectedCommunity?.tick">
      <Kline v-if="!comStore.currentSelectedCommunity.listed" :tick="comStore.currentSelectedCommunity.tick" chart-id="community-mobile-chart" />
      <iframe v-else :src="chartUrl" :title="`${comStore.currentSelectedCommunity.tick} K-line`" class="block w-full h-[360px] border-0" />
    </template>
  </div>
</template>
