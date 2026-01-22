<script setup lang="ts">
import TradePanel from './components/TradePanel.vue'
import type { MarketData, EventPredictData } from '@/types'

const props = defineProps<{
  market: EventPredictData
}>()
</script>

<template>
  <div class="h-full">
    <TradePanel :market="market" />
  </div>
</template>

