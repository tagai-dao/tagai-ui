<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PredictHeader from './components/PredictHeader.vue'
import PredictChart from './components/PredictChart.vue'
import TradeList from './components/TradeList.vue'
import HolderList from './components/HolderList.vue'
import TradePanel from './components/TradePanel.vue'
import { mockBattleData } from './mockData'
import type { MarketData, Tweet } from '@/types'

const activeTab = ref(0)
const tabs = ['Transactions', 'Holders']

const props = defineProps<{
   market: MarketData
}>()

const tradePanelRef = ref<HTMLElement | null>(null)
const isTradePanelVisible = ref(true)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (tradePanelRef.value) {
     observer = new IntersectionObserver(([entry]) => {
         isTradePanelVisible.value = entry.isIntersecting
     }, {
         threshold: 0.1
     })
     observer.observe(tradePanelRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

const scrollToTrade = () => {
    tradePanelRef.value?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    })
}
</script>

<template>
  <div class="flex flex-col gap-4 relative">
    <!-- Header Section -->
    <PredictHeader :market="market" />

    <!-- Chart -->
    <PredictChart v-if="market.battle.marketMaker" :marketAddr="market.battle.marketMaker" chartId="predict-chart" />

    <!-- Mobile Trade Panel (Insert here, hidden on desktop) -->
    <div class="block lg:hidden scroll-mt-24" ref="tradePanelRef">
       <TradePanel :market="market" />
    </div>

    <!-- Data Tabs Section -->
    <div class="bg-white rounded-2xl shadow-sm flex flex-col">
       <!-- Tab Headers -->
       <div class="flex border-b border-gray-100">
           <button 
              v-for="(tab, index) in tabs" 
              :key="index"
              @click="activeTab = index"
              class="flex-1 py-4 font-bold text-sm uppercase tracking-wide transition-colors relative"
              :class="activeTab === index ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
           >
              {{ tab }}
              <div v-if="activeTab === index" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
           </button>
       </div>

       <!-- Tab Content -->
       <div class="bg-gray-50/50">
           <KeepAlive>
               <TradeList v-if="activeTab === 0" :market="market" />
               <HolderList v-else :market="market" />
           </KeepAlive>
       </div>
    </div>

    <!-- Floating Trade Button (Mobile Only) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-20 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-20 opacity-0"
    >
        <button 
            v-if="!isTradePanelVisible"
            @click="scrollToTrade"
            class="fixed bottom-6 w-1/2 flex justify-center left-1/2 -translate-x-1/2 z-50 bg-gradient-primary text-white shadow-xl rounded-full px-8 py-3 font-bold text-lg flex items-center gap-2 active:scale-95 lg:hidden"
        >
            {{ $t('trade') }}
        </button>
    </Transition>
  </div>
</template>

