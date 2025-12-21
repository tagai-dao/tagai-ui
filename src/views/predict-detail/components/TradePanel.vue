<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { formatAddress, formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { useAccountStore } from '@/stores/web3'
import { newParticipation } from '@/apis/api'
import { isAddress } from 'viem'
import { getUserTokenBalances, buyToken, sellToken, getBuyData, getSellData, getMarketInfos, addLiquidity, removeLiquidity, redeemPositions } from '@/utils/fpmm'
import type { BattleData } from '@/types'
import debounce from 'lodash.debounce'
import { handleErrorTip } from '@/utils/notify'

const props = defineProps<{
    battle: BattleData
}>()

const accStore = useAccountStore()
const { onCopy } = useTools()

// Global Tab State
const mainTab = ref<'trade' | 'liquidity' | 'redeem'>('trade')

// ==========================================
// TRADE LOGIC (From PredictTradeModal.vue)
// ==========================================
enum TradeType {
  BUY_RED,
  BUY_BLUE,
  SELL_RED,
  SELL_BLUE
}

const tradeShares = ref()
const tradeTokenBalance = ref(0);
const tradeBlueBalance = ref(0);
const tradeRedBalance = ref(0);
const tradeWillReceiveAmount = ref(0);
const tradePriceImpact = ref('')
const tradeCalculating = ref(false)
const tradeLoading = ref(false)
const reserveA = ref(0)
const reserveB = ref(0)
const bnbFee = ref(0);

const tradeActiveTab = ref<'buy' | 'sell'>('buy')
const tradeSelectedOutcome = ref<'red' | 'blue'>('red')

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
  if (tradeActiveTab.value === 'buy') {
    return tradeSelectedOutcome.value === 'red' ? TradeType.BUY_RED : TradeType.BUY_BLUE
  } else {
    return tradeSelectedOutcome.value === 'red' ? TradeType.SELL_RED : TradeType.SELL_BLUE
  }
})

const debouncedTradeCalculate = debounce(async () => {
  try {
    if (!tradeShares.value) {
        tradeWillReceiveAmount.value = 0
        tradePriceImpact.value = ''
        return
    }
    tradeCalculating.value = true
    if (tradeActiveTab.value === 'buy') {
      const { amount, fee } = await getBuyData(props.battle, tradeShares.value, tradeSelectedOutcome.value)
      
      bnbFee.value = fee;
      tradeWillReceiveAmount.value = amount
      if (tradeSelectedOutcome.value === 'red') {
        const newPercentA = (reserveB.value + Number(tradeShares.value)) / (totalPool.value + Number(tradeShares.value) * 2 - tradeWillReceiveAmount.value)
        tradePriceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else {
        const newPercentB = (reserveA.value + Number(tradeShares.value)) / (totalPool.value + Number(tradeShares.value) * 2 - tradeWillReceiveAmount.value)
        tradePriceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      }
    } else {
      const sellData: any = await getSellData(props.battle, reserveA.value, reserveB.value, tradeShares.value, tradeSelectedOutcome.value)
      bnbFee.value = sellData.fee;
      tradeWillReceiveAmount.value = sellData.receive;
      if (tradeSelectedOutcome.value === 'red') {
        const newPercentA = (reserveB.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + Number(tradeShares.value))
        tradePriceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else {
        const newPercentB = (reserveA.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + Number(tradeShares.value))
        tradePriceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      }
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    tradeCalculating.value = false
  }
}, 500)

async function getTradeMaxInfo() {
  const type = currentTradeType.value
  switch (type) {
    case TradeType.BUY_RED:
    case TradeType.BUY_BLUE:
      tradeShares.value = tradeTokenBalance.value
      break
    case TradeType.SELL_BLUE:
      tradeShares.value = tradeBlueBalance.value
      break
    case TradeType.SELL_RED:
      tradeShares.value = tradeRedBalance.value
      break
  }
  debouncedTradeCalculate()
}

async function executeTrade() {
  try {
    tradeLoading.value = true
    if (tradeActiveTab.value === 'buy') {
      await buyToken(props.battle, props.battle.token as `0x${string}`, tradeShares.value, tradeWillReceiveAmount.value * 0.95, tradeSelectedOutcome.value, bnbFee.value)
      updateReserves()
    } else {
      await sellToken(props.battle, tradeWillReceiveAmount.value, tradeShares.value * 1.05, tradeSelectedOutcome.value, bnbFee.value)
      updateReserves()
    }
    if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
      await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, props.battle.marketMaker as `0x${string}`)
    }
    // Refresh
    tradeShares.value = ''
    updateBalances()
  } catch (error) {
    handleErrorTip(error)
  } finally {
    tradeLoading.value = false
  }
}

function adjustShares(delta: number) {
  const newValue = (Number(tradeShares.value) || 0) + delta
  tradeShares.value = Math.max(0, newValue)
  debouncedTradeCalculate()
}

// ==========================================
// LIQUIDITY / REDEEM LOGIC (From PredictLiquidityModal.vue)
// ==========================================
const liquidityType = ref<'add' | 'remove'>('add')
const lpBalance = ref(0)
const lpSupply = ref(0)
const liquidityAmount = ref<number>()
const liquidityLoading = ref(false)

const isResolved = computed(() => props.battle.status === 2)

const setLiquidityMax = () => {
    if (liquidityType.value === 'add') {
         liquidityAmount.value = tradeTokenBalance.value // collateralBalance
    } else {
         liquidityAmount.value = lpBalance.value
    }
}

const handleLiquidityAction = async () => {
    if (!liquidityAmount.value && mainTab.value === 'liquidity' && !liquidityLoading.value) return
    if (mainTab.value === 'redeem' && liquidityLoading.value) return
    
    liquidityLoading.value = true
    try {
        if (mainTab.value === 'liquidity') {
            if (liquidityType.value === 'add') {
                await addLiquidity(props.battle, liquidityAmount.value!, props.battle.token as `0x${string}`)
            } else {
                await removeLiquidity(props.battle, liquidityAmount.value!)
            }
        } else {
             await redeemPositions(props.battle, props.battle.token as `0x${string}`)
        }
        if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
            await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, props.battle.marketMaker as `0x${string}`)
        }
        await updateBalances()
        updateReserves()
        liquidityAmount.value = undefined
    } catch (e) {
        handleErrorTip(e)
    } finally {
        liquidityLoading.value = false
    }
}

// ==========================================
// SHARED UPDATERS
// ==========================================

const updateBalances = async () => {
    if (props.battle && accStore.ethConnectAddress && isAddress(accStore.ethConnectAddress)) {
        const bs: any = await getUserTokenBalances(props.battle.token as `0x${string}`, accStore.ethConnectAddress as `0x${string}`, props.battle)
        // Common
        tradeTokenBalance.value = bs.balance
        tradeBlueBalance.value = bs.balanceB
        tradeRedBalance.value = bs.balanceA
        lpBalance.value = bs.lpBalance
    }
}

const updateReserves = debounce(async () => {
  getMarketInfos([props.battle]).then((infos: any) => {
    reserveA.value = infos[props.battle.marketMaker + '-priceA']
    reserveB.value = infos[props.battle.marketMaker + '-priceB']
    lpSupply.value = infos[props.battle.marketMaker + '-totalSupply'] || 0
  })
}, 500)

watch(() => tradeShares.value, () => {
  debouncedTradeCalculate()
})

watch(() => accStore.ethConnectAddress, (newVal) => {
  updateBalances()
}, { immediate: true })

onMounted(async () => {
  updateReserves()
  updateBalances()
})

function copyMarketAddress(address: `0x${string}`) {
  onCopy(address)
}
</script>

<template>
  <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col">
    <!-- Header Info (Shared) -->
    <!-- <div class="mb-4">
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">Market: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(battle.marketMaker as `0x${string}`)">{{ formatAddress(battle.marketMaker) }}</span></span>
      </div>
    </div> -->

    <!-- Main Navigation Tabs -->
    <div class="flex p-1 bg-gray-100 rounded-xl mb-6">
        <button 
        v-for="tab in ['trade', 'liquidity', 'redeem']" 
        :key="tab"
        @click="mainTab = tab as any"
        class="flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize"
        :class="mainTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
        {{ $t(tab === 'trade' ? 'trade' : (tab === 'liquidity' ? 'predictLiquidity.liquidity' : 'predictRedeem.redeem')) }}
        </button>
    </div>

    <!-- TRADE TAB CONTENT -->
    <div v-if="mainTab === 'trade'" class="flex-1 flex flex-col">
        <!-- Sub Tabs -->
        <div class="flex border-b border-gray-200 mb-6">
            <button 
                class="flex-1 pb-3 text-lg font-bold transition-colors relative"
                :class="tradeActiveTab === 'buy' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
                @click="tradeActiveTab = 'buy';debouncedTradeCalculate()"
            >
                {{ $t('buy') }}
                <div v-if="tradeActiveTab === 'buy'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
            </button>
            <button 
                class="flex-1 pb-3 text-lg font-bold transition-colors relative"
                :class="tradeActiveTab === 'sell' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
                @click="tradeActiveTab = 'sell';debouncedTradeCalculate()"
            >
                {{ $t('sell') }}
                <div v-if="tradeActiveTab === 'sell'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
            </button>
        </div>

        <!-- Outcome Selection -->
        <div class="grid grid-cols-2 gap-4 mb-6">
            <button 
                class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
                :class="tradeSelectedOutcome === 'red' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-red-200'"
                @click="tradeSelectedOutcome = 'red';debouncedTradeCalculate()"
            >
                <span class="text-lg font-bold z-10">{{ $t('predictTrade.red') }} {{ (percentA / 100).toFixed(2) }} ${{ battle.tick }}</span>
            </button>
            
            <button 
                class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden group"
                :class="tradeSelectedOutcome === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200'"
                @click="tradeSelectedOutcome = 'blue';debouncedTradeCalculate()"
            >
                <span class="text-lg font-bold z-10">{{ $t('predictTrade.blue') }} {{ (percentB / 100).toFixed(2) }} ${{ battle.tick }}</span>
            </button>
        </div>

        <!-- Input -->
        <div class="mb-6 flex-1">
            <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-bold text-gray-700"></label>
                <div class="text-xs text-gray-500">
                {{ $t('balance') }}: 
                <span v-if="tradeActiveTab === 'buy'" class="font-mono font-bold text-gray-800">{{ formatAmount(tradeTokenBalance) }} {{ battle.tick }}</span>
                <span v-else-if="tradeSelectedOutcome === 'red'" class="font-mono font-bold text-gray-800">{{ formatAmount(tradeRedBalance) }} Red</span>
                <span v-else class="font-mono font-bold text-gray-800">{{ formatAmount(tradeBlueBalance) }} Blue</span>
                </div>
            </div>
            
            <div class="relative mb-3">
                <input 
                type="number" 
                v-model="tradeShares" 
                min="1"
                class="w-full bg-gray-50 text-right text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span class="text-gray-400 text-sm">{{tradeActiveTab === 'buy' ? battle.tick : $t('predictTrade.shareUnit')}}</span>
                    <button 
                    class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
                    @click="getTradeMaxInfo"
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

             <!-- Summary -->
            <div class="border-t border-gray-100 pt-4 space-y-2 mt-4">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600 text-sm">{{ $t('predictTrade.payReceive') }}</span>
                    <span v-if="tradeActiveTab === 'buy'" class="font-mono font-bold text-lg text-gray-900">{{ formatAmount(tradeWillReceiveAmount) }} {{ tradeSelectedOutcome === 'red' ? $t('predictTrade.redShare') : $t('predictTrade.blueShare') }}</span>
                    <span v-else class="font-mono font-bold text-lg text-gray-900">{{ formatAmount(tradeWillReceiveAmount) }} {{ battle.tick }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">Price Impact</span>
                    <span class="font-mono" :class="tradeActiveTab === 'buy' ? 'text-red-500' : 'text-green-500'">{{ tradePriceImpact }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">{{ $t('predictTrade.fee') }}</span>
                    <span class="font-mono text-gray-600">{{ (battle.fee ? battle.fee * 100 : 0).toFixed(2) }}% + {{ bnbFee ? formatAmount(bnbFee) : 0 }} BNB</span>
                </div>
            </div>
        </div>

        <button 
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
            @click="executeTrade"
            :disabled="tradeCalculating || tradeLoading || !tradeShares"
        >
            {{ tradeActiveTab === 'buy' ? $t("buy") : $t("sell") }} {{ tradeSelectedOutcome === 'red' ? $t("predictTrade.red") : $t("predictTrade.blue") }}
            <i-ep-loading v-if="tradeCalculating || tradeLoading" class="animate-spin ml-2" />
        </button>
    </div>

    <!-- LIQUIDITY TAB CONTENT -->
    <div v-else-if="mainTab === 'liquidity'" class="flex-1 flex flex-col gap-6">
         <!-- Sub Tabs for Liquidity -->
         <div class="bg-gray-100 p-1 rounded-lg flex">
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all"
                :class="liquidityType === 'add' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'add';liquidityAmount=0">{{ $t('predictLiquidity.addLiquidity') }}</button>
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all"
                :class="liquidityType === 'remove' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'remove';liquidityAmount=0">{{ $t('predictLiquidity.removeLiquidity') }}</button>
         </div>

         <!-- Info Card -->
         <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
             <div class="flex justify-between items-center mb-2">
                 <span class="text-gray-500 text-sm">Your LP Balance</span>
                 <span class="font-mono font-bold">{{ formatAmount(lpBalance) }} LP</span>
             </div>
             <div class="flex justify-between items-center">
                 <span class="text-gray-500 text-sm">Total Supply</span>
                 <span class="font-mono font-bold">{{ formatAmount(lpSupply) }} LP</span>
             </div>
         </div>

         <!-- Input -->
         <div class="flex-1">
            <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-bold text-gray-700">{{ liquidityType === 'add' ? 'Amount to Add' : 'Amount to Remove' }}</label>
                <div class="text-xs text-gray-500">
                    {{ $t('balance') }}: <span class="font-mono font-bold text-gray-800">{{ formatAmount(liquidityType === 'add' ? tradeTokenBalance : lpBalance) }} {{ liquidityType === 'add' ? battle.tick : 'LP' }}</span>
                </div>
            </div>
             <div class="relative mb-3">
                <input 
                    type="number" 
                    v-model="liquidityAmount" 
                    min="0"
                    class="w-full bg-gray-50 text-right text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span class="text-gray-400 text-sm">{{ liquidityType === 'add' ? battle.tick : 'LP' }}</span>
                    <button class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors" @click="setLiquidityMax">Max</button>
                </div>
            </div>
         </div>

         <button 
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white shadow-lg transition-all transform active:scale-[0.99]"
            @click="handleLiquidityAction"
            :disabled="liquidityLoading || !liquidityAmount || (battle.status !== 1 && liquidityType === 'add')"
        >
            {{ liquidityType === 'add' ? $t('predictLiquidity.addLiquidity') : $t('predictLiquidity.removeLiquidity') }}
            <i-ep-loading v-if="liquidityLoading" class="animate-spin ml-2" />
        </button>
    </div>

    <!-- REDEEM TAB CONTENT -->
    <div v-else class="flex-1 flex flex-col gap-6">
        <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your Red Positions</span>
                 <span class="font-mono font-bold text-red-600">{{ formatAmount(tradeRedBalance) }}</span>
             </div>
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your Blue Positions</span>
                 <span class="font-mono font-bold text-blue-600">{{ formatAmount(tradeBlueBalance) }}</span>
             </div>
        </div>

        <div v-if="!isResolved" class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex-1 flex flex-col justify-center">
            <div class="text-4xl mb-2">⏳</div>
            <p class="font-bold">{{ $t('predictRedeem.predictionInProgress') }}</p>
            <p class="text-sm mt-1">{{ $t('predictRedeem.rewardTip') }}</p>
        </div>

        <div v-else class="text-center space-y-4 flex-1 flex flex-col justify-center">
             <div class="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
                 <p class="font-bold text-lg">{{ $t('predictRedeem.eventResolved') }}</p>
                 <p>{{ $t('predictRedeem.winner', { winner: battle?.winner === 'left' ? $t('predictTrade.red') : $t('predictTrade.blue') }) }}</p>
             </div>
             
             <button 
                class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
                @click="handleLiquidityAction"
                :disabled="liquidityLoading"
            >
                {{ $t('predictRedeem.redeemRewards') }}
                <i-ep-loading v-if="liquidityLoading" class="animate-spin ml-2" />
            </button>
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
