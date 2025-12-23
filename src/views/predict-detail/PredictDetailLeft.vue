<script setup lang="ts">
import { ref } from 'vue'
import PredictHeader from './components/PredictHeader.vue'
import TradeList from './components/TradeList.vue'
import HolderList from './components/HolderList.vue'
import TradePanel from './components/TradePanel.vue'
import { mockBattleData } from './mockData'
import type { MarketData } from '@/types'

const activeTab = ref(0)
const tabs = ['Transactions', 'Holders']

const props = defineProps<{
  market: MarketData
}>()

</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header Section -->
    <PredictHeader :market="market" />

    <!-- Mobile Trade Panel (Insert here, hidden on desktop) -->
    <div class="block lg:hidden">
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
  </div>
</template>

