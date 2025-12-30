<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue'
import { formatAddress, formatAmount, formatDate, formatPrice } from '@/utils/helper'
import { getFPMMTradeList } from '@/apis/api'
import type { FPMMTrade, MarketData } from '@/types'
import { handleErrorTip } from '@/utils/notify'
import { useI18n } from 'vue-i18n'
import { ChainConfig } from '@/config'

const { t } = useI18n()

const props = defineProps<{
  market: MarketData
}>()

const list = ref<FPMMTrade[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

const onLoad = async () => {
  try {
    if (refreshing.value || loading.value || finished.value || list.value.length == 0) {
      return;
    }   
    const trades: FPMMTrade[] = (await getFPMMTradeList(props.market.battle.marketMaker, Math.floor((list.value.length - 1) / 30) + 1)) as unknown as FPMMTrade[]
    list.value = list.value.concat(trades)
    if (trades.length < 30) {
      finished.value = true
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  try {
    finished.value = false
    refreshing.value = true
    const trades: FPMMTrade[] = (await getFPMMTradeList(props.market.battle.marketMaker)) as unknown as FPMMTrade[]
    console.log(55, trades)
    list.value = trades
  } catch (error) {
    handleErrorTip(error)
  } finally {
    refreshing.value = false
  }
}

// Helpers
const formatTimestamp = (ts: number) => {
    // Return relative time (e.g., "7m ago") - using simple mock for now
    const now = Date.now() / 1000
    const diff = now - ts
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return '1d ago'
}

const outcomeColors = ['text-red-500', 'text-blue-500'] as const
const tradeTypeColors = ['text-green-500', 'text-red-500'] as const

const getOutcomeColor = (index: number): string => outcomeColors[index] ?? 'text-gray-400'
const getOutcomeName = (index: number): string => index === 0 ? t('predictTrade.red') : t('predictTrade.blue')
const getTradeTypeColor = (isBuy: number): string => isBuy === 1 ? tradeTypeColors[0] : tradeTypeColors[1]

// Mock price logic (since mock data lacks price)
const getPrice = (item: FPMMTrade): string => formatPrice(item.amount / item.outcomeTokensAmount)
const getValue = (item: FPMMTrade): number => Math.floor(item.amount * 0.5)
const lpAmounts = (item: FPMMTrade): Array<number> => {
  if (item.opType === 1) return [] as Array<number>;
  if (typeof item.amounts === 'string') {
    item.amounts = JSON.parse(item.amounts) as Array<number>
  }
  return item.amounts as Array<number>
}

const getAddShares = (item: FPMMTrade): number => Math.max(lpAmounts(item)[0], lpAmounts(item)[1])
const getAddSharedEarned = (item: FPMMTrade): number => Math.abs(lpAmounts(item)[0] - lpAmounts(item)[1]) - 0.00001
const getAddSharedEarnedIndex = (item: FPMMTrade): number => lpAmounts(item)[0] > lpAmounts(item)[1] ? 0 : 1
const getRemoveLpReceived = (item: FPMMTrade): number => item.collateralRemoved

onActivated(() => {
  onRefresh()
})
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col shadow-sm border border-gray-100 overflow-hidden">
    <!-- Header removed to match screenshot style closely, or keep simple -->
    <!-- <div class="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between items-center">
        <span>Recent Activity</span>
    </div> -->
    
    <div class="custom-scrollbar">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="No more transactions"
          @load="onLoad"
        >
          <div 
            v-for="(item, index) in list" 
            :key="index"
            class="flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer text-sm"
          >
            <!-- Avatar -->
            <img :src="item.profile" class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0">
            
            <!-- Main Content -->
            <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1" v-if="item.opType === 1">
                <span class="font-bold text-gray-900 truncate max-w-[100px]">{{ item.twitterUsername ? `@${item.twitterUsername}` : formatAddress(item.ethAddr) }}</span>
                <span class="text-gray-500" :class="getTradeTypeColor(item.isBuy)">{{ item.isBuy ? $t('predictTrade.bought') : $t('predictTrade.sold') }}</span>
                <span class="font-bold whitespace-nowrap" :class="getOutcomeColor(item.outcomeIndex)">
                    {{ Math.floor(item.outcomeTokensAmount).toLocaleString() }} {{ getOutcomeName(item.outcomeIndex) }}
                </span>
                <span class="text-gray-500 whitespace-nowrap">
                    at {{ getPrice(item) }}
                </span>
                <span class="text-gray-400 whitespace-nowrap">
                    ({{ formatAmount(item.amount) }} {{ market.battle.tick }})
                </span>
            </div>

            <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1" v-if="item.opType === 2 && item.isBuy == 1">
                <span class="font-bold text-gray-900 truncate max-w-[100px]">{{ item.twitterUsername ? `@${item.twitterUsername}` : formatAddress(item.ethAddr) }}</span>
                <span class="text-green-500">{{ $t('predictLiquidity.add') }}</span>
                <span class="font-bold whitespace-nowrap" :class="getTradeTypeColor(item.isBuy)">
                    {{ formatAmount(getAddShares(item)) }} {{ market.battle.tick }}
                </span> 
                <span>
                  {{ $t('predictLiquidity.get') }}
                </span>
                <span class="font-bold whitespace-nowrap" v-show="getAddSharedEarned(item) > 0" :class="getAddSharedEarnedIndex(item) == 0 ? 'text-red-500' : 'text-blue-500'">
                  {{ formatAmount(getAddSharedEarned(item)) }} 
                  {{ getAddSharedEarnedIndex(item) === 0 ? $t('predictTrade.red') : $t('predictTrade.blue') }}
                </span>
                <span v-show="getAddSharedEarned(item) > 0">
                  {{ $t('and') }}
                </span>
                <span>
                  {{ formatAmount(item.amount) }} LP
                </span>
            </div>

            <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1" v-if="item.opType === 2 && item.isBuy == 2">
                <span class="font-bold text-gray-900 truncate max-w-[100px]">{{ item.twitterUsername ? `@${item.twitterUsername}` : formatAddress(item.ethAddr) }}</span>
                <span class="text-gray-500" :class="getTradeTypeColor(item.isBuy)">{{ $t('predictLiquidity.remove') }}</span>
                <span class="font-bold whitespace-nowrap" :class="getTradeTypeColor(item.isBuy)">
                    {{ formatAmount(item.amount) }} LP
                </span>
                <span>
                  {{ $t('predictLiquidity.get') }}
                </span>
                <span class="font-bold whitespace-nowrap text-red-500">
                  {{ formatAmount(lpAmounts(item)[0]) }} {{ $t('predictTrade.red') }}
                </span>
                <span>
                  {{ $t('and') }}
                </span>
                <span class="font-bold whitespace-nowrap text-blue-500">
                  {{ formatAmount(lpAmounts(item)[1]) }} {{ $t('predictTrade.blue') }}
                </span>
            </div>

            <!-- Right Side: Time & Link -->
            <div class="flex items-center gap-2 text-gray-400 text-xs whitespace-nowrap flex-shrink-0">
                <span>{{ formatTimestamp(item.transTime) }}</span>
                <a :href="ChainConfig.browser + 'tx/' + item.transHash" target="_blank" class="hover:text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                </a>
            </div>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #eee;
  border-radius: 2px;
}
</style>
