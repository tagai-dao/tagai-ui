<script setup lang="ts">
import TradePanel from './components/TradePanel.vue'
import type { MarketData } from '@/types'

const props = defineProps<{
  market: MarketData
}>()
</script>

<template>
  <div class="h-full">
    <TradePanel :market="market" />
  </div>
</template>

