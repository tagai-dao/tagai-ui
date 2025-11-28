<script setup lang="ts">
import { computed, ref } from 'vue'
import { useModalStore } from '@/stores/common'

const modalStore = useModalStore()
const battle = computed(() => modalStore.modalParams?.battle)
const tweets = computed(() => modalStore.modalParams?.tweets || {})

const shares = ref(10)

// Mock calculations for demo purposes since we don't have the actual bonding curve logic here yet
const amountA = computed(() => {
  if (!battle.value?.predictAID) return 0
  return tweets.value[battle.value.predictAID]?.amount || 0
})
const amountB = computed(() => {
  if (!battle.value?.predictBID) return 0
  return tweets.value[battle.value.predictBID]?.amount || 0
})
const totalPool = computed(() => amountA.value + amountB.value)

const percentA = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((amountA.value / totalPool.value) * 1000) / 10
})

const percentB = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((amountB.value / totalPool.value) * 1000) / 10
})

// Mock cost calculation
const buyYesCost = computed(() => (shares.value * (percentA.value / 100)).toFixed(2))
const buyNoCost = computed(() => (shares.value * (percentB.value / 100)).toFixed(2))

// Mock sell return calculation
const sellYesReturn = computed(() => (shares.value * (percentA.value / 100) * 0.95).toFixed(2))
const sellNoReturn = computed(() => (shares.value * (percentB.value / 100) * 0.95).toFixed(2))

// Mock user balances
const userEthBalance = ref('1.25')
const userYesShares = ref(20)
const userNoShares = ref(5)
</script>

<template>
  <div class="bg-white text-black p-4 sm:p-6 rounded-2xl w-full mx-auto font-sans">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl sm:text-2xl font-bold mb-2 leading-tight">{{ battle?.title || 'Prediction' }}</h2>
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs font-mono">ID: 1</span>
        <span class="font-mono">$ Total Cost Pool: {{ totalPool.toFixed(2) }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-6 lg:gap-8">
      <!-- Top Section: Trading Interface -->
      <div>
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <label class="text-sm font-bold text-gray-700">交易份额数量 (SHARES)</label>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex-1 relative">
              <input 
                type="number" 
                v-model="shares" 
                min="1" 
                class="w-full bg-gray-50 text-gray-900 rounded-lg border border-gray-200 p-3 pr-12 font-mono text-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter amount"
              >
              <span class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">shares</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:gap-4">
          <!-- Buy YES Column -->
          <div class="flex flex-col gap-3">
            <div class="border border-blue-500/30 bg-blue-50/50 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition-colors group relative overflow-hidden">
              <div class="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
              <div class="relative z-10">
                <div class="text-blue-600 font-bold text-lg mb-1">Buy YES</div>
                <div class="text-xs text-gray-500 mb-4">看好事件发生</div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-500">支付成本:</span>
                  <span class="font-bold font-mono text-gray-800">{{ buyYesCost }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-500">价格影响:</span>
                  <span class="text-green-600 font-mono">{{ percentA }}% → {{ (percentA + 0.5).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
            <button class="w-full rounded-xl border border-blue-500/30 bg-blue-50/50 p-4 cursor-pointer hover:border-blue-500 transition-colors group relative overflow-hidden text-left">
              <div class="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
               <div class="relative z-10 flex flex-col gap-1">
                 <div class="text-blue-600 font-bold text-lg mb-1">Sell YES</div>
                 <div class="text-xs text-gray-500 mb-4">卖出持有的YES份额</div>
                 <div class="flex justify-between text-sm mb-1 w-full">
                  <span class="text-gray-500">获得收益:</span>
                  <span class="font-bold font-mono text-gray-800">{{ sellYesReturn }}</span>
                 </div>
                 <div class="flex justify-between text-xs w-full">
                  <span class="text-gray-500">价格影响:</span>
                  <span class="text-red-600 font-mono">{{ percentA }}% → {{ (percentA - 0.5).toFixed(1) }}%</span>
                 </div>
               </div>
            </button>
          </div>

          <!-- Buy NO Column -->
          <div class="flex flex-col gap-3">
            <div class="border border-red-500/30 bg-red-50/50 rounded-xl p-4 cursor-pointer hover:border-red-500 transition-colors group relative overflow-hidden">
              <div class="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
              <div class="relative z-10">
                <div class="text-red-600 font-bold text-lg mb-1">Buy NO</div>
                <div class="text-xs text-gray-500 mb-4">看衰事件发生</div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-500">支付成本:</span>
                  <span class="font-bold font-mono text-gray-800">{{ buyNoCost }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-500">价格影响:</span>
                  <span class="text-red-600 font-mono">{{ percentB }}% → {{ (percentB - 0.5).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
            <button class="w-full rounded-xl border border-red-500/30 bg-red-50/50 p-4 cursor-pointer hover:border-red-500 transition-colors group relative overflow-hidden text-left">
              <div class="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
               <div class="relative z-10 flex flex-col gap-1">
                 <div class="text-red-600 font-bold text-lg mb-1">Sell NO</div>
                 <div class="text-xs text-gray-500 mb-4">卖出持有的NO份额</div>
                 <div class="flex justify-between text-sm mb-1 w-full">
                  <span class="text-gray-500">获得收益:</span>
                  <span class="font-bold font-mono text-gray-800">{{ sellNoReturn }}</span>
                 </div>
                 <div class="flex justify-between text-xs w-full">
                  <span class="text-gray-500">价格影响:</span>
                  <span class="text-green-600 font-mono">{{ percentB }}% → {{ (percentB - 0.5).toFixed(1) }}%</span>
                 </div>
               </div>
            </button>
          </div>
        </div>
        
        <!-- User Balances -->
        <div class="grid grid-cols-2 gap-3 sm:gap-4 mt-6">
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div class="text-xs text-gray-500 mb-1">Available to Buy</div>
                <div class="text-lg font-bold font-mono text-gray-900">{{ userEthBalance }} ETH</div>
            </div>
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 flex justify-between">
                <div>
                    <div class="text-xs text-gray-500 mb-1">YES Shares</div>
                    <div class="text-lg font-bold font-mono text-blue-600">{{ userYesShares }}</div>
                </div>
                 <div>
                    <div class="text-xs text-gray-500 mb-1">NO Shares</div>
                    <div class="text-lg font-bold font-mono text-red-600">{{ userNoShares }}</div>
                </div>
            </div>
        </div>
      </div>

      <!-- Bottom Section: Visualization -->
      <div class="bg-gray-50 rounded-2xl p-6 border border-gray-200 flex flex-col">
        <h3 class="text-xs font-bold text-gray-500 mb-8 uppercase tracking-wider">Market State Visualization</h3>
        
        <div class="flex-1 flex flex-col justify-center mb-2 min-h-[80px]">
          <!-- Progress Bar -->
          <div class="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
             <div 
              class="bg-red-500 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white"
              :style="{ width: percentA + '%' }"
             >
             </div>
             <div 
              class="bg-blue-500 transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white"
              :style="{ width: percentB + '%' }"
             >
             </div>
          </div>
          
          <!-- Labels below bar -->
          <div class="flex justify-between mt-2 text-sm font-bold">
            <span class="text-red-500">{{ percentA }}%</span>
            <span class="text-blue-500">{{ percentB }}%</span>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-5 flex justify-between text-sm font-mono text-gray-500">
          <div class="flex gap-4">
            <span>Shares Yes</span>
            <span class="text-gray-900 font-bold">{{ Math.floor(amountA) }}</span>
          </div>
          <div class="flex gap-4">
            <span>Shares No</span>
            <span class="text-gray-900 font-bold">{{ Math.floor(amountB) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom Range Input Styling */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #2563eb; /* blue-600 */
  cursor: pointer;
  margin-top: -7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  cursor: pointer;
  background: #e5e7eb; /* gray-200 */
  border-radius: 3px;
}
</style>
