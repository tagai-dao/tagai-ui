<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useModalStore } from '@/stores/common'
import { formatAddress, formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { useAccount } from '@/composables/useAccount'
import { useAccountStore } from '@/stores/web3'
import { isAddress } from 'viem'
import { newParticipation } from '@/apis/api'
import { getUserTokenBalances, calculateMaxSellAmount, 
  buyToken, sellToken,getBuyData, getSellData, getMarketInfos } from '@/utils/fpmm'
import type { BattleData } from '@/types'
import debounce from 'lodash.debounce'
import { handleErrorTip } from '@/utils/notify'

const modalStore = useModalStore()
const battle = computed(() => modalStore.modalParams?.battle)
const tweets = computed(() => modalStore.modalParams?.tweets || {})
const accStore = useAccountStore()
const reserveA = ref(0)
const reserveB = ref(0)
const bnbFee = ref(0);

enum TradeType {
  BUY_RED,
  BUY_BLUE,
  SELL_RED,
  SELL_BLUE
}

const { onCopy } = useTools()
const shares = ref()
const tokenBalance = ref(0);
const blueBalance = ref(0);
const redBalance = ref(0);
const willReceiveAmount = ref(0);
const priceImpact = ref('')

const calculationg = ref(false)
const trading = ref(false)

// UI State
const activeTab = ref<'buy' | 'sell'>('buy')
const selectedOutcome = ref<'red' | 'blue'>('red')

const totalPool = computed(() => reserveA.value + reserveB.value)

const percentA = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((reserveB.value / totalPool.value) * 1000) / 10
})

const percentB = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((reserveA.value / totalPool.value) * 1000) / 10
})

const currentTradeType = computed(() => {
  if (activeTab.value === 'buy') {
    return selectedOutcome.value === 'red' ? TradeType.BUY_RED : TradeType.BUY_BLUE
  } else {
    return selectedOutcome.value === 'red' ? TradeType.SELL_RED : TradeType.SELL_BLUE
  }
})

// 创建 debounced 计算函数，500ms 延迟
const debouncedCalculate = debounce(async () => {
  try {
    calculationg.value = true
    if (activeTab.value === 'buy') {
      const { amount, fee } = await getBuyData(battle.value as BattleData, shares.value, selectedOutcome.value)
      
      bnbFee.value = fee;
      willReceiveAmount.value = amount
      if (selectedOutcome.value === 'red') {
        const newPercentA = (reserveB.value + shares.value) / (totalPool.value + shares.value * 2 - willReceiveAmount.value)
        priceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else {
        const newPercentB = (reserveA.value + shares.value) / (totalPool.value + shares.value * 2 - willReceiveAmount.value)
        priceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      }
    } else {
      const sellData: any = await getSellData(battle.value as BattleData, reserveA.value, reserveB.value, shares.value, selectedOutcome.value)
      bnbFee.value = sellData.fee;
      willReceiveAmount.value = sellData.receive;
      if (selectedOutcome.value === 'red') {
        const newPercentA = (reserveB.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + shares.value)
        priceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else {
        const newPercentB = (reserveA.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + shares.value)
        priceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      }
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    calculationg.value = false
  }
}, 500)

watch(() => shares.value, () => {
  debouncedCalculate()
})

watch(() => accStore.ethConnectAddress, (newVal) => {
  if (isAddress(newVal)) {
    getUserTokenBalances(battle.value.token as `0x${string}`, newVal, battle.value as BattleData).then((bs: any) => {
      tokenBalance.value = bs.balance;
      blueBalance.value = bs.balanceB;
      redBalance.value = bs.balanceA;
    })
  }
}, { immediate: true })

function copyMarketAddress(address: `0x${string}`) {
  onCopy(address)
}

async function getMaxInfo() {
  const type = currentTradeType.value
  switch (type) {
    case TradeType.BUY_RED:
    case TradeType.BUY_BLUE:
      shares.value = tokenBalance.value
      break
    case TradeType.SELL_BLUE:
      shares.value = blueBalance.value
      break
    case TradeType.SELL_RED:
      shares.value = redBalance.value
      break
  }
}

async function trade() {
  const type = currentTradeType.value
  console.log('trade', type, shares.value)
  // Implement trade call here
  try {
    trading.value = true
    if (activeTab.value === 'buy') {
      const hash = await buyToken(battle.value as BattleData, battle.value.token as `0x${string}`, shares.value, willReceiveAmount.value * 0.95, selectedOutcome.value, bnbFee.value)
      console.log('buy hash', hash)
      updateReserves()
    } else {
      const hash = await sellToken(battle.value as BattleData, willReceiveAmount.value, shares.value * 1.05, selectedOutcome.value, bnbFee.value)
      console.log('sell hash', hash)
      updateReserves()
    }
    await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, battle.value?.marketMaker as `0x${string}`)
  } catch (error) {
    handleErrorTip(error)
  } finally {
    trading.value = false
  }
}

function adjustShares(delta: number) {
  const newValue = (Number(shares.value) || 0) + delta
  shares.value = Math.max(0, newValue)
}

const updateReserves = debounce(async () => {
  getMarketInfos([battle.value as BattleData]).then((infos: any) => {
    shares.value = 0;
    reserveA.value = infos[battle.value?.marketMaker + '-priceA']
    reserveB.value = infos[battle.value?.marketMaker + '-priceB']
  })
}, 500)

onMounted(async () => {
  updateReserves()
})
</script>

<template>
  <div class="bg-white text-black w-full p-4 sm:p-6 rounded-2xl mx-auto font-sans">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl sm:text-2xl font-bold mb-2 leading-tight">{{ battle?.title || 'Prediction' }}</h2>
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">Market Address: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(battle?.marketMaker as `0x${string}`)">{{ formatAddress(battle?.marketMaker) }}</span></span>
      </div>
      <div class="mt-1 flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">{{ $t('predictTrade.currentAddress') }}: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(accStore.ethConnectAddress as `0x${string}`)">{{ formatAddress(accStore.ethConnectAddress) }}</span></span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200 mb-6">
      <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'buy' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'buy';debouncedCalculate()"
      >
        {{ $t('buy') }}
        <div v-if="activeTab === 'buy'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
      <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'sell' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'sell';debouncedCalculate()"
      >
        {{ $t('sell') }}
        <div v-if="activeTab === 'sell'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
    </div>

    <div class="flex flex-col gap-6">
      
      <!-- Outcome Selection -->
      <div class="grid grid-cols-2 gap-4">
        <button 
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
          :class="selectedOutcome === 'red' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-red-200'"
          @click="selectedOutcome = 'red';debouncedCalculate()"
        >
          <span class="text-lg font-bold z-10">{{ $t('predictTrade.red') }} {{ (percentA / 100).toFixed(2) }} ${{ battle.tick }}</span>
          <!-- <span class="text-xs mt-1 z-10">{{ activeTab === 'buy' ? $t('predictTrade.buyRed') : $t('predictTrade.sellRed') }}</span> -->
        </button>
        
        <button 
          class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
          :class="selectedOutcome === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200'"
          @click="selectedOutcome = 'blue';debouncedCalculate()"
        >
          <span class="text-lg font-bold z-10">{{ $t('predictTrade.blue') }} {{ (percentB / 100).toFixed(2) }} ${{ battle.tick }}</span>
           <!-- <span class="text-xs mt-1 z-10">{{ activeTab === 'buy' ? $t('predictTrade.buyBlue') : $t('predictTrade.sellBlue') }}</span> -->
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
          <label class="text-sm font-bold text-gray-700"></label>
          <div class="text-xs text-gray-500">
            {{ $t('balance') }}: 
            <span v-if="activeTab === 'buy'" class="font-mono font-bold text-gray-800">{{ formatAmount(tokenBalance) }} {{ battle.tick }}</span>
            <span v-else-if="selectedOutcome === 'red'" class="font-mono font-bold text-gray-800">{{ formatAmount(redBalance) }} Red</span>
            <span v-else class="font-mono font-bold text-gray-800">{{ formatAmount(blueBalance) }} Blue</span>
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
             <span class="text-gray-400 text-sm">{{activeTab === 'buy' ? battle.tick : $t('predictTrade.shareUnit')}}</span>
             <button 
              class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
              @click="getMaxInfo"
            >
              {{ $t('max') }}
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button v-for="amount in [-10000, -1000, 1000, 10000]" :key="amount"
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
            <span class="text-gray-600 text-sm">{{ $t('predictTrade.payReceive') }}</span>
            <span v-if="activeTab === 'buy'" class="font-mono font-bold text-lg text-gray-900">{{ formatAmount(willReceiveAmount) }} {{ selectedOutcome === 'red' ? $t('predictTrade.redShare') : $t('predictTrade.blueShare') }}</span>
            <span v-else class="font-mono font-bold text-lg text-gray-900">{{ formatAmount(willReceiveAmount) }} {{ battle.tick }}</span>
         </div>
         <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">Price Impact</span>
            <span class="font-mono" :class="activeTab === 'buy' ? 'text-red-500' : 'text-green-500'">{{ priceImpact }}</span>
         </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-gray-500">{{ $t('predictTrade.fee') }}</span>
            <span class="font-mono text-gray-600">{{ (battle.fee ? battle.fee * 100 : 0).toFixed(2) }}% + {{ bnbFee ? formatAmount(bnbFee) : 0 }} BNB</span>
         </div>
      </div>

      <!-- Trade Button -->
      <button 
        class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
        @click="trade"
        :disabled="calculationg || trading || !shares"
      >
        {{ activeTab === 'buy' ? $t("buy") : $t("sell") }} {{ selectedOutcome === 'red' ? $t("predictTrade.red") : $t("predictTrade.blue") }}
        <i-ep-loading v-if="calculationg || trading" class="animate-spin" />
      </button>

      <!-- Market State (Mini) -->
      <div class="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
         <div class="flex justify-between text-xs font-bold text-gray-500 mb-2">
            <span>{{ $t('predictTrade.red') }} {{ percentA }}%</span>
            <span>{{ $t('predictTrade.blue') }} {{ percentB }}%</span>
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
