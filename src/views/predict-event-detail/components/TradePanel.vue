<script setup lang="ts">
import { computed, onMounted, watch, ref, onUnmounted } from 'vue'
import { formatAddress, formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { EthWalletState, useAccountStore } from '@/stores/web3'
import { newParticipation } from '@/apis/api'
import { isAddress, parseUnits } from 'viem'
import { getUserTokenBalances, buyToken, sellToken, getBuyData, getSellData, getEventMarketInfos, addLiquidity, removeLiquidity, redeemPositions } from '@/utils/fpmm'
import { GlobalModalType, type EventPredictData } from '@/types'
import debounce from 'lodash.debounce'
import { handleErrorTip } from '@/utils/notify'
import { useModalStore } from '@/stores/common'
import { useNow } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useEventMarketOutcomes, OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'

const props = defineProps<{
    market: EventPredictData
}>()

const accStore = useAccountStore()
const { onCopy } = useTools()
const { isMultiOutcome, outcomeList, getPercent, getOutcomeLabel, winningOutcomeIndex } = useEventMarketOutcomes(() => props.market)
const now = useNow()
const { t } = useI18n()

// Global Tab State
const mainTab = ref<'trade' | 'liquidity' | 'redeem'>('trade')

// ==========================================
// TRADE LOGIC (From PredictTradeModal.vue)
// ==========================================
enum TradeType {
  BUY_YES,
  BUY_NO,
  SELL_YES,
  SELL_NO
}

const tradeShares = ref()
const tradeTokenBalance = ref(0);
const tradeTokenBalanceBi = ref(0n);
const tradeNoBalance = ref(0);
const tradeNoBalanceBi = ref(0n);
const tradeYesBalance = ref(0);
const tradeYesBalanceBi = ref(0n);
const outcomeBalances = ref<number[]>([])
const outcomeBalancesBi = ref<bigint[]>([])
const tradeWillReceiveAmount = ref(0);
const tradePriceImpact = ref('')
const tradeCalculating = ref(false)
const tradeLoading = ref(false)
const reserveA = ref(0)
const reserveB = ref(0)
const bnbFee = ref(0);
const isMax = ref(false);

const tradeActiveTab = ref<'buy' | 'sell'>('buy')
const tradeSelectedOutcomeIndex = ref(0)

const totalPool = computed(() => {
  if (props.market.outcomeReserves?.length) {
    return props.market.outcomeReserves.reduce((sum, r) => sum + (r ?? 0), 0)
  }
  return reserveA.value + reserveB.value
})

const resolveLegacyOutcome = (index: number): 'yes' | 'no' => (index === 0 ? 'yes' : 'no')

const getSelectedOutcomeBalance = () => {
  if (isMultiOutcome.value) {
    return outcomeBalances.value[tradeSelectedOutcomeIndex.value] ?? 0
  }
  return tradeSelectedOutcomeIndex.value === 0 ? tradeYesBalance.value : tradeNoBalance.value
}

const getSelectedOutcomeBalanceBi = () => {
  if (isMultiOutcome.value) {
    return outcomeBalancesBi.value[tradeSelectedOutcomeIndex.value] ?? 0n
  }
  return tradeSelectedOutcomeIndex.value === 0 ? tradeYesBalanceBi.value : tradeNoBalanceBi.value
}


const percentA = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((reserveB.value / totalPool.value) * 1000) / 10
})

const percentB = computed(() => {
  if (totalPool.value === 0) return 50
  return Math.round((reserveA.value / totalPool.value) * 1000) / 10
})

const currentTradeType = computed(() => {
  const base = tradeSelectedOutcomeIndex.value
  if (tradeActiveTab.value === 'buy') {
    return base === 0 ? TradeType.BUY_YES : (base === 1 ? TradeType.BUY_NO : TradeType.BUY_YES)
  }
  return base === 0 ? TradeType.SELL_YES : (base === 1 ? TradeType.SELL_NO : TradeType.SELL_YES)
})

const debouncedTradeCalculate = debounce(async () => {
  try {
    isMax.value = false
    if (!tradeShares.value) {
        tradeWillReceiveAmount.value = 0
        tradePriceImpact.value = ''
        return
    }

    tradeCalculating.value = true
    const infos = await getEventMarketInfos(props.market)
    reserveA.value = infos.reserves[0] ?? 0
    reserveB.value = infos.reserves[1] ?? 0
    lpSupply.value = infos.totalSupply || 0
    props.market.outcomeReserves = infos.reserves
    props.market.reserveA = reserveA.value
    props.market.reserveB = reserveB.value
    props.market.fee = infos.fee

    const outcomeArg = isMultiOutcome.value
      ? tradeSelectedOutcomeIndex.value
      : resolveLegacyOutcome(tradeSelectedOutcomeIndex.value)

    if (tradeActiveTab.value === 'buy') {
      const { amount, fee } = await getBuyData(props.market, tradeShares.value, outcomeArg)
      
      bnbFee.value = fee;
      tradeWillReceiveAmount.value = amount
      if (!isMultiOutcome.value && tradeSelectedOutcomeIndex.value === 0) {
        const newPercentA = (reserveB.value + Number(tradeShares.value)) / (totalPool.value + Number(tradeShares.value) * 2 - tradeWillReceiveAmount.value)
        tradePriceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else if (!isMultiOutcome.value) {
        const newPercentB = (reserveA.value + Number(tradeShares.value)) / (totalPool.value + Number(tradeShares.value) * 2 - tradeWillReceiveAmount.value)
        tradePriceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      } else {
        tradePriceImpact.value = ''
      }
    } else {
      if (tradeShares.value <= 0.1) {
        tradeShares.value += 0.1;
      }
      const sellData: any = await getSellData(
        props.market,
        reserveA.value,
        reserveB.value,
        tradeShares.value - 0.1,
        outcomeArg
      )
      bnbFee.value = sellData.fee;
      tradeWillReceiveAmount.value = sellData.receive;
      if (!isMultiOutcome.value && tradeSelectedOutcomeIndex.value === 0) {
        const newPercentA = (reserveB.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + Number(tradeShares.value))
        tradePriceImpact.value = `${(percentA.value / 100).toFixed(2)} -> ${newPercentA.toFixed(2)}`
      } else if (!isMultiOutcome.value) {
        const newPercentB = (reserveA.value - sellData.receive) / (totalPool.value - sellData.receive * 2 + Number(tradeShares.value))
        tradePriceImpact.value = `${(percentB.value / 100).toFixed(2)} -> ${newPercentB.toFixed(2)}`
      } else {
        tradePriceImpact.value = ''
      }
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    tradeCalculating.value = false
  }
}, 500)

async function getTradeMaxInfo() {
  isMax.value = true
  if (tradeActiveTab.value === 'buy') {
    tradeShares.value = tradeTokenBalance.value
  } else {
    tradeShares.value = getSelectedOutcomeBalance()
  }
  debouncedTradeCalculate()
}

async function executeTrade() {
  try {
    if (accStore.ethConnectState !== EthWalletState.Connected) {
      useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
      return;
    }
    tradeLoading.value = true
    const outcomeArg = isMultiOutcome.value
      ? tradeSelectedOutcomeIndex.value
      : resolveLegacyOutcome(tradeSelectedOutcomeIndex.value)

    if (tradeActiveTab.value === 'buy') {
      let shareAmount = parseUnits(tradeShares.value.toFixed(18), 18)
      if (isMax.value) {
        shareAmount = tradeTokenBalanceBi.value;
      }
      await buyToken(props.market, props.market.token as `0x${string}`, shareAmount, tradeWillReceiveAmount.value * 0.95, outcomeArg, bnbFee.value)
      updateReserves().catch()
    } else {
      let shareAmount = parseUnits(tradeShares.value.toFixed(18), 18) * 105n / 100n;
      const selectedBi = getSelectedOutcomeBalanceBi()
      if (shareAmount > selectedBi) {
        shareAmount = selectedBi;
      }
      await sellToken(props.market, parseUnits(tradeWillReceiveAmount.value.toFixed(18), 18), shareAmount, outcomeArg, bnbFee.value)
      updateReserves().catch()
    }
    if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
      await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, props.market.marketMaker as `0x${string}`, 'event')
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
const lpBalanceBi = ref(0n);
const lpSupply = ref(0)
const liquidityAmount = ref<number>()
const liquidityLoading = ref(false)

const isResolved = computed(() => props.market.status === 3)

const showLiquidityDot = computed(() => {
  return accStore.ethConnectState === EthWalletState.Connected && 
         isResolved.value && 
         lpBalance.value > 1
})

const showRedeemDot = computed(() => {
  return accStore.ethConnectState === EthWalletState.Connected && 
         accStore.getAccountInfo?.ethAddr && 
         isResolved.value && 
         (isMultiOutcome.value
           ? outcomeBalances.value.some(b => b > 0)
           : (tradeYesBalance.value > 0 || tradeNoBalance.value > 0))
})

const setLiquidityMax = () => {
    if (liquidityType.value === 'add') {
         liquidityAmount.value = tradeTokenBalance.value // collateralBalance
    } else {
         liquidityAmount.value = lpBalance.value
    }
}

const connect = async () => {
  useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
      return;
}

const handleLiquidityAction = async () => {
    if (accStore.ethConnectState !== EthWalletState.Connected) {
      useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
      return;
    }

    if (!liquidityAmount.value && mainTab.value === 'liquidity' && !liquidityLoading.value) return
    if (mainTab.value === 'redeem' && liquidityLoading.value) return
    liquidityLoading.value = true
    try {
        if (mainTab.value === 'liquidity') {
            if (liquidityType.value === 'add') {
                await addLiquidity(props.market, liquidityAmount.value!, props.market.token as `0x${string}`)
            } else {
              let amount = parseUnits(liquidityAmount.value!.toFixed(18), 18)
              if (amount > lpBalanceBi.value) {
                amount = lpBalanceBi.value;
              }
              await removeLiquidity(props.market, amount)
            }
        } else {
             await redeemPositions(props.market, props.market.token as `0x${string}`)
        }
        if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
            await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, props.market.marketMaker as `0x${string}`)
        }
        updateBalances().catch()
        updateReserves().catch()
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
    if (props.market.marketMaker && accStore.ethConnectAddress && isAddress(accStore.ethConnectAddress)) {
        const bs: any = await getUserTokenBalances(props.market.token as `0x${string}`, accStore.ethConnectAddress as `0x${string}`, props.market)
        tradeTokenBalance.value = bs.balance
        tradeNoBalance.value = bs.balanceB
        tradeYesBalance.value = bs.balanceA
        lpBalance.value = bs.lpBalance
        tradeTokenBalanceBi.value = bs.balanceBi;
        tradeNoBalanceBi.value = bs.balanceBBi;
        tradeYesBalanceBi.value = bs.balanceABi;
        lpBalanceBi.value = bs.lpBalanceBi;
        outcomeBalances.value = bs.outcomeBalances ?? [bs.balanceA, bs.balanceB]
        outcomeBalancesBi.value = bs.outcomeBalancesBi ?? [bs.balanceABi, bs.balanceBBi]
    }
}

const updateReserves = debounce(async () => {
  getEventMarketInfos(props.market).then((infos) => {
    reserveA.value = infos.reserves[0] ?? 0
    reserveB.value = infos.reserves[1] ?? 0
    lpSupply.value = infos.totalSupply || 0
    props.market.outcomeReserves = infos.reserves
    props.market.reserveA = reserveA.value
    props.market.reserveB = reserveB.value
    props.market.fee = infos.fee
  })
}, 500)

watch(() => tradeShares.value, () => {
  debouncedTradeCalculate()
})

watch(() => accStore.ethConnectAddress, (newVal) => {
  updateBalances()
}, { immediate: true })

let interval: any;
onMounted(async () => {
  interval = setInterval(() => {
    updateReserves()
  }, 3000)
  updateReserves()
  updateBalances()
})

onUnmounted(() => {
  clearInterval(interval)
})

function copyMarketAddress(address: `0x${string}`) {
  onCopy(address)
}

// 倒计时和状态逻辑
const tradeEndTime = computed(() => props.market.endTime * 1000)
const isTradeEnded = computed(() => {
  return now.value.getTime() >= tradeEndTime.value
})

const pad = (n: number) => n.toString().padStart(2, '0')
const formatDurationColon = (ms: number) => {
  if (ms < 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  // 如果超过24小时，显示天数
  if (h > 24) {
      const d = Math.floor(h / 24)
      const remainH = h % 24
      return `${d}d ${pad(remainH)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const tradeTimeLeftText = computed(() => {
  if (isTradeEnded.value) return ''
  const diff = tradeEndTime.value - now.value.getTime()
  return `${t('predictTrade.endStill')}${formatDurationColon(diff)}`
})
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
        class="flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize relative"
        :class="mainTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
        {{ $t(tab === 'trade' ? 'trade' : (tab === 'liquidity' ? 'predictLiquidity.liquidity' : 'predictRedeem.redeem')) }}
        <div v-if="tab === 'liquidity' && showLiquidityDot" class="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
        <div v-if="tab === 'redeem' && showRedeemDot" class="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
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
        <div
          class="gap-3 mb-6"
          :class="isMultiOutcome ? 'grid grid-cols-1 sm:grid-cols-3' : 'grid grid-cols-2 gap-4'"
        >
            <button
                v-for="(outcome, idx) in outcomeList"
                :key="outcome.outcomeIndex"
                class="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all relative overflow-hidden"
                :class="tradeSelectedOutcomeIndex === outcome.outcomeIndex
                  ? 'border-orange-normal bg-orange-50 text-orange-700 shadow-sm'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-orange-200'"
                @click="tradeSelectedOutcomeIndex = outcome.outcomeIndex; debouncedTradeCalculate()"
            >
                <span class="text-xs sm:text-sm font-bold z-10 text-center line-clamp-2 leading-tight">
                  {{ isMultiOutcome ? outcome.label : (outcome.outcomeIndex === 0 ? $t('predictTrade.yes') : $t('predictTrade.no')) }}
                </span>
                <span class="text-xs font-mono mt-1 z-10">
                  {{ (getPercent(outcome.outcomeIndex) * 100).toFixed(1) }}% · {{ getPercent(outcome.outcomeIndex).toFixed(2) }} ${{ props.market.tick }}
                </span>
                <div
                  v-if="tradeSelectedOutcomeIndex === outcome.outcomeIndex"
                  class="absolute inset-x-0 bottom-0 h-1"
                  :style="{ backgroundColor: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length] }"
                />
            </button>
        </div>

        <!-- Input -->
        <div class="mb-6 flex-1">
            <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-bold text-gray-700"></label>
                <div class="text-xs text-gray-500">
                {{ $t('balance') }}: 
                <span v-if="tradeActiveTab === 'buy'" class="font-mono font-bold text-gray-800">{{ formatAmount(tradeTokenBalance) }} {{ props.market.tick }}</span>
                <span v-else class="font-mono font-bold text-gray-800">
                  {{ formatAmount(getSelectedOutcomeBalance()) }}
                  {{ isMultiOutcome ? getOutcomeLabel(tradeSelectedOutcomeIndex) : (tradeSelectedOutcomeIndex === 0 ? 'Yes' : 'No') }}
                </span>
                </div>
            </div>
            
            <div class="relative mb-3">
                <input 
                type="number" 
                v-model="tradeShares" 
                min="1"
                class="w-full bg-gray-50 text-center text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span class="text-gray-400 text-sm">{{tradeActiveTab === 'buy' ? props.market.tick : $t('predictTrade.shareUnit')}}</span>
                    <button 
                        class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
                        @click="getTradeMaxInfo">
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
                    <span v-if="tradeActiveTab === 'buy'" class="font-mono font-bold text-lg text-gray-900">
                      {{ formatAmount(tradeWillReceiveAmount) }}
                      {{ isMultiOutcome ? getOutcomeLabel(tradeSelectedOutcomeIndex) : (tradeSelectedOutcomeIndex === 0 ? $t('predictTrade.yesShare') : $t('predictTrade.noShare')) }}
                    </span>
                    <span v-else class="font-mono font-bold text-lg text-gray-900">{{ formatAmount(tradeWillReceiveAmount) }} {{ props.market.tick }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">Price Impact</span>
                    <span class="font-mono" :class="tradeActiveTab === 'buy' ? 'text-red-500' : 'text-green-500'">{{ tradePriceImpact }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">{{ $t('predictTrade.fee') }}</span>
                    <span class="font-mono text-gray-600">{{ (props.market.fee ? props.market.fee * 100 : 0).toFixed(2) }}% + {{ bnbFee ? formatAmount(bnbFee) : 0 }} BNB</span>
                </div>
            </div>
        </div>
        <button v-if="accStore.ethConnectState !== EthWalletState.Connected"
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
            @click="connect"
        >
        {{ $t('connect') }}
        </button>
        <div v-else-if="props.market.status !== 1 || isTradeEnded" class="w-full">
            <button
                disabled
                class="w-full py-4 flex justify-center items-center rounded-full bg-gray-300 font-bold text-lg text-white cursor-not-allowed"
            >
              {{ $t('predictTrade.tradeEnded') }}
            </button>
        </div>
        <div v-else class="w-full flex flex-col gap-2">
            <button
                class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
                @click="executeTrade"
                :disabled="tradeCalculating || tradeLoading || !tradeShares"
            >
                {{ tradeActiveTab === 'buy' ? $t("buy") : $t("sell") }}
                {{ isMultiOutcome ? getOutcomeLabel(tradeSelectedOutcomeIndex) : (tradeSelectedOutcomeIndex === 0 ? $t("predictTrade.yes") : $t("predictTrade.no")) }}
                <i-ep-loading v-if="tradeCalculating || tradeLoading" class="animate-spin ml-2" />
            </button>
            <div class="text-center text-xs text-red-500 font-medium">
                 {{ tradeTimeLeftText }}
            </div>
        </div>
    </div>

    <!-- LIQUIDITY TAB CONTENT -->
    <div v-else-if="mainTab === 'liquidity'" class="flex-1 flex flex-col gap-6">
         <!-- Sub Tabs for Liquidity -->
         <div class="bg-gray-100 p-1 rounded-lg flex">
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all"
                :class="liquidityType === 'add' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'add';liquidityAmount=0">{{ $t('predictLiquidity.addLiquidity') }}</button>
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all relative"
                :class="liquidityType === 'remove' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'remove';liquidityAmount=0">
                {{ $t('predictLiquidity.removeLiquidity') }}
                <div v-if="showLiquidityDot" class="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
            </button>
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
                    {{ $t('balance') }}: <span class="font-mono font-bold text-gray-800">{{ formatAmount(liquidityType === 'add' ? tradeTokenBalance : lpBalance) }} {{ liquidityType === 'add' ? props.market.tick : 'LP' }}</span>
                </div>
            </div>
             <div class="relative mb-3">
                <input 
                    type="number" 
                    v-model="liquidityAmount" 
                    min="0"
                    class="w-full bg-gray-50 text-center text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span class="text-gray-400 text-sm">{{ liquidityType === 'add' ? props.market.tick : 'LP' }}</span>
                    <button class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors" @click="setLiquidityMax">Max</button>
                </div>
            </div>
         </div>

         <button v-if="accStore.ethConnectState !== EthWalletState.Connected"
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
            @click="connect"
        >
        {{ $t('connect') }}
        </button>
        <button v-else
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white shadow-lg transition-all transform active:scale-[0.99]"
            @click="handleLiquidityAction"
            :disabled="liquidityLoading || !liquidityAmount || (props.market.status !== 1 && liquidityType === 'add')"
        >
            {{ liquidityType === 'add' ? $t('predictLiquidity.addLiquidity') : $t('predictLiquidity.removeLiquidity') }}
            <i-ep-loading v-if="liquidityLoading" class="animate-spin ml-2" />
        </button>
    </div>

    <!-- REDEEM TAB CONTENT -->
    <div v-else class="flex-1 flex flex-col gap-6">
        <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
             <template v-if="isMultiOutcome">
               <div
                 v-for="(outcome, idx) in outcomeList"
                 :key="outcome.outcomeIndex"
                 class="flex justify-between items-center"
               >
                 <span class="text-gray-500 truncate pr-2">{{ outcome.label }}</span>
                 <span
                   class="font-mono font-bold"
                   :style="{ color: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length] }"
                 >
                   {{ formatAmount(outcomeBalances[outcome.outcomeIndex] ?? 0) }}
                 </span>
               </div>
             </template>
             <template v-else>
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your Yes Positions</span>
                 <span class="font-mono font-bold text-red-600">{{ formatAmount(tradeYesBalance) }}</span>
             </div>
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your No Positions</span>
                 <span class="font-mono font-bold text-blue-600">{{ formatAmount(tradeNoBalance) }}</span>
             </div>
             </template>
        </div>

        <div v-if="!isResolved" class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex-1 flex flex-col justify-center">
            <div class="text-4xl mb-2">⏳</div>
            <p class="font-bold">{{ $t('predictRedeem.predictionInProgress') }}</p>
            <p class="text-sm mt-1">{{ $t('predictRedeem.rewardTip') }}</p>
        </div>

        <div v-else class="text-center space-y-4 flex-1 flex flex-col justify-center">
             <div class="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
                 <p class="font-bold text-lg">{{ $t('predictRedeem.eventResolved') }}</p>
                 <p>{{ $t('predictRedeem.winner', {
                   winner: isMultiOutcome && winningOutcomeIndex != null
                     ? getOutcomeLabel(winningOutcomeIndex)
                     : (props.market.winner === 'yes' ? $t('predictTrade.yes') : $t('predictTrade.no'))
                 }) }}</p>
             </div>
             
             <button v-if="accStore.ethConnectState !== EthWalletState.Connected"
                  class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
                  @click="connect"
              >
              {{ $t('connect') }}
              </button>
             <button v-else
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