<script setup lang="ts">
import TradePanel from './components/TradePanel.vue'
import { mockBattleData } from './mockData'
</script>

<template>
  <div class="h-full">
    <TradePanel :battle="mockBattleData" />
  </div>
</template>

