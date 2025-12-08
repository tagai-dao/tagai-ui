<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useModalStore } from '@/stores/common'
import { formatAddress, formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { useAccount } from '@/composables/useAccount'
import { useAccountStore } from '@/stores/web3'
import { useCommunityStore } from '@/stores/community'
import { isAddress } from 'viem'
import { getUserTokenBalances, calculateMaxSellAmount } from '@/utils/fpmm'
import type { BattleData } from '@/types'
import debounce from 'lodash.debounce'

const modalStore = useModalStore()
const battle = computed(() => modalStore.modalParams?.battle)
const tweets = computed(() => modalStore.modalParams?.tweets || {})
const accStore = useAccountStore()
const comStore = useCommunityStore()

enum TradeType {
  BUY_RED,
  BUY_BLUE,
  SELL_RED,
  SELL_BLUE
}

const { onCopy } = useTools()
const shares = ref(10)
const tokenBalance = ref(0);
const blueBalance = ref(0);
const redBalance = ref(0);

// UI State
const activeTab = ref<'buy' | 'sell'>('buy')
const selectedOutcome = ref<'yes' | 'no'>('yes')

// Mock calculations for demo purposes
const amountA = computed(() => {
  if (!battle.value?.predictAID) return 0
  return battle.value.reserveB || 0
})
const amountB = computed(() => {
  if (!battle.value?.predictBID) return 0
  return battle.value.reserveA || 0
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

const currentTradeType = computed(() => {
  if (activeTab.value === 'buy') {
    return selectedOutcome.value === 'yes' ? TradeType.BUY_RED : TradeType.BUY_BLUE
  } else {
    return selectedOutcome.value === 'yes' ? TradeType.SELL_RED : TradeType.SELL_BLUE
  }
})

const priceImpact = computed(() => {
  // Mock price impact
  const impact = 0.5
  if (activeTab.value === 'buy') {
      return selectedOutcome.value === 'yes' 
        ? `${percentA.value}% → ${(percentA.value + impact).toFixed(1)}%`
        : `${percentB.value}% → ${(percentB.value + impact).toFixed(1)}%`
  } else {
       return selectedOutcome.value === 'yes' 
        ? `${percentA.value}% → ${(percentA.value - impact).toFixed(1)}%`
        : `${percentB.value}% → ${(percentB.value - impact).toFixed(1)}%`
  }
})

// Calculations
const totalValue = computed(() => {
  const price = selectedOutcome.value === 'yes' ? percentA.value : percentB.value
  const rawValue = shares.value * (price / 100)
  
  if (activeTab.value === 'buy') {
    return rawValue.toFixed(2)
  } else {
    // Sell return (with 5% fee mockup)
    return (rawValue * 0.95).toFixed(2)
  }
})

const potentialProfit = computed(() => {
  if (activeTab.value !== 'buy') return 0
  // If I buy 10 shares, I get 10 tokens. 
  // Each token is worth 1$ if I win.
  // So payout is shares.value.
  // Profit is shares.value - cost.
  // But usually "To Win" means the payout amount.
  return shares.value
})

watch(() => accStore.ethConnectAddress, (newVal) => {
  if (isAddress(newVal)) {
    getUserTokenBalances(comStore.currentSelectedCommunity!.token as `0x${string}`, newVal, battle.value as BattleData).then((bs: any) => {
      tokenBalance.value = bs.balance;
      blueBalance.value = bs.balanceB;
      redBalance.value = bs.balanceA;
    })
  }
}, { immediate: true })

watch(shares, debounce(async () => {
  // Calculate price impact
}, 500))

function copyMarketAddress(address: `0x${string}`) {
  onCopy(address)
}

async function getMaxInfo() {
  const type = currentTradeType.value
  switch (type) {
    case TradeType.BUY_RED:
    case TradeType.BUY_BLUE:
      // For buy, max is based on token balance / current price
      // This is a simplified mock. Real logic needs proper bonding curve calc.
      const price = selectedOutcome.value === 'yes' ? percentA.value : percentB.value
      if (price > 0) {
        shares.value = Math.floor(tokenBalance.value / (price / 100))
      }
      break
    case TradeType.SELL_BLUE:
      const d1 = await calculateMaxSellAmount(battle.value as BattleData, 1)
      shares.value = Math.floor(Number(d1)) // Assuming d1 is amount
      break
    case TradeType.SELL_RED:
      const d2 = await calculateMaxSellAmount(battle.value as BattleData, 0)
      shares.value = Math.floor(Number(d2))
      break
  }
}

async function trade() {
  const type = currentTradeType.value
  console.log('trade', type, shares.value)
  // Implement trade call here
}

function adjustShares(delta: number) {
  const newValue = (Number(shares.value) || 0) + delta
  shares.value = Math.max(0, newValue)
}

onMounted(async () => {

})
</script>

<template>
  <div class="bg-white text-black p-4 sm:p-6 rounded-2xl w-full mx-auto font-sans">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl sm:text-2xl font-bold mb-2 leading-tight">{{ battle?.title || 'Prediction' }}</h2>
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">Market Address: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(battle?.marketMaker as `0x${string}`)">{{ formatAddress(battle?.marketMaker) }}</span></span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-6">
      <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'buy' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'buy'"
      >
        Buy
        <div v-if="activeTab === 'buy'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
      <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'sell' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'sell'"
      >
        Sell
        <div v-if="activeTab === 'sell'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
    </div>

    <div class="flex flex-col gap-6">
      
      <!-- Outcome Selection -->
      <div class="grid grid-cols-2 gap-4">
        <button 
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
          :class="selectedOutcome === 'yes' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-red-200'"
          @click="selectedOutcome = 'yes'"
        >
          <span class="text-lg font-bold z-10">Yes {{ percentA }}¢</span>
          <span class="text-xs mt-1 z-10">{{ activeTab === 'buy' ? 'Buy Yes' : 'Sell Yes' }}</span>
        </button>
        
        <button 
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
          :class="selectedOutcome === 'no' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200'"
          @click="selectedOutcome = 'no'"
        >
          <span class="text-lg font-bold z-10">No {{ percentB }}¢</span>
           <span class="text-xs mt-1 z-10">{{ activeTab === 'buy' ? 'Buy No' : 'Sell No' }}</span>
        </button>
      </div>

      <!-- Limit Price (Placeholder) -->
      <!-- 
      <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
         <span class="text-sm font-bold text-gray-700">Limit Price</span>
         <div class="flex items-center gap-4">
            <button class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-gray-600 hover:bg-gray-300">-</button>
            <span class="font-mono font-bold">{{ selectedOutcome === 'yes' ? percentA : percentB }}¢</span>
            <button class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-gray-600 hover:bg-gray-300">+</button>
         </div>
      </div>
      -->

      <!-- Shares Input -->
      <div>
        <div class="flex justify-between items-center mb-2">
          <label class="text-sm font-bold text-gray-700">Shares</label>
          <div class="text-xs text-gray-500">
            Available: 
            <span v-if="activeTab === 'buy'" class="font-mono font-bold text-gray-800">{{ formatAmount(tokenBalance) }} {{ comStore.currentSelectedCommunity?.tick }}</span>
            <span v-else-if="selectedOutcome === 'yes'" class="font-mono font-bold text-gray-800">{{ formatAmount(redBalance) }} Yes</span>
            <span v-else class="font-mono font-bold text-gray-800">{{ formatAmount(blueBalance) }} No</span>
          </div>
        </div>
        
        <div class="relative mb-3">
          <input 
            type="number" 
            v-model="shares" 
            min="1"
            class="w-full bg-gray-50 text-right text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
          >
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
             <span class="text-gray-400 text-sm">Shares</span>
             <button 
              class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
              @click="getMaxInfo"
            >
              Max
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button v-for="amount in [-100, -10, 10, 100]" :key="amount"
            class="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-mono transition-colors"
            @click="adjustShares(amount)"
          >
            {{ amount > 0 ? '+' + amount : amount }}
          </button>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="border-t border-gray-100 pt-4 space-y-2">
         <div class="flex justify-between items-center">
            <span class="text-gray-600 text-sm">Total {{ activeTab === 'buy' ? 'Cost' : 'Proceeds' }}</span>
            <span class="font-mono font-bold text-lg text-gray-900">{{ totalValue }} {{ comStore.currentSelectedCommunity?.tick }}</span>
         </div>
         <div v-if="activeTab === 'buy'" class="flex justify-between items-center">
            <span class="text-gray-600 text-sm flex items-center gap-1">
              To Win
              <span class="text-green-500">💵</span>
            </span>
            <span class="font-mono font-bold text-lg text-green-600">{{ potentialProfit }} {{ comStore.currentSelectedCommunity?.tick }}</span>
         </div>
         <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Price Impact</span>
            <span class="font-mono" :class="activeTab === 'buy' ? 'text-red-500' : 'text-green-500'">{{ priceImpact }}</span>
         </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Fee</span>
            <span class="font-mono text-gray-600">{{ (battle.fee ? battle.fee * 100 : 0).toFixed(2) }}%</span>
         </div>
      </div>

      <!-- Trade Button -->
      <button 
        class="w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all transform active:scale-[0.99]"
        :class="activeTab === 'buy' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'"
        @click="trade"
      >
        {{ activeTab === 'buy' ? 'Buy' : 'Sell' }} {{ selectedOutcome === 'yes' ? 'Yes' : 'No' }}
      </button>

      <!-- Market State (Mini) -->
      <div class="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
         <div class="flex justify-between text-xs font-bold text-gray-500 mb-2">
            <span>Yes {{ percentA }}%</span>
            <span>No {{ percentB }}%</span>
         </div>
         <div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
             <div class="bg-red-500 transition-all duration-500" :style="{ width: percentA + '%' }"></div>
             <div class="bg-blue-500 transition-all duration-500" :style="{ width: percentB + '%' }"></div>
          </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
