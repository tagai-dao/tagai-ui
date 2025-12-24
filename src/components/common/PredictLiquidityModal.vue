<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useModalStore } from '@/stores/common'
import { formatAddress, formatAmount } from '@/utils/helper'
import { useTools } from '@/composables/useTools'
import { useAccountStore } from '@/stores/web3'
import { newParticipation } from '@/apis/api'
import { isAddress } from 'viem'
import { getUserTokenBalances, addLiquidity, removeLiquidity, redeemPositions, getUserLpBalance, getMarketInfos } from '@/utils/fpmm'
import type { BattleData } from '@/types'
import debounce from 'lodash.debounce'
import { handleErrorTip } from '@/utils/notify'

const modalStore = useModalStore()
const battle = computed(() => modalStore.modalParams?.battle)
const accStore = useAccountStore()
const { onCopy } = useTools()

// State
const activeTab = ref<'liquidity' | 'redeem'>('liquidity')
const liquidityType = ref<'add' | 'remove'>('add')

const lpBalance = ref(0)
const lpSupply = ref(0)
const reserveA = ref(0)
const reserveB = ref(0)
const collateralBalance = ref(0)
const blueBalance = ref(0)
const redBalance = ref(0)

const amount = ref<number>()
const loading = ref(false)
const calculating = ref(false)

// Computed
const totalPool = computed(() => reserveA.value + reserveB.value)
const isResolved = computed(() => battle.value?.status === 2) 

// Update balances
const updateBalances = async () => {
    if (battle.value && accStore.ethConnectAddress) {
        // Get Collateral, Red, Blue balances
        const bs: any = await getUserTokenBalances(battle.value.token as `0x${string}`, accStore.ethConnectAddress as `0x${string}`, battle.value as BattleData)
        collateralBalance.value = bs.balance
        redBalance.value = bs.balanceA
        blueBalance.value = bs.balanceB
        lpBalance.value = bs.lpBalance
        // Get Market Info (Reserves + Total Supply)
        const infos: any = await getMarketInfos([battle.value as BattleData])
        reserveA.value = infos[battle.value?.marketMaker + '-priceA']
        reserveB.value = infos[battle.value?.marketMaker + '-priceB']
        lpSupply.value = infos[battle.value?.marketMaker + '-totalSupply'] || 0
    }
}

const updateReceives = debounce(async () => {
    
})

watch(() => accStore.ethConnectAddress, updateBalances, { immediate: true })

// Actions
const setMax = () => {
    if (activeTab.value === 'liquidity') {
        if (liquidityType.value === 'add') {
             amount.value = collateralBalance.value
        } else {
             amount.value = lpBalance.value
        }
    }
}

const handleAction = async () => {
    if (!amount.value && activeTab.value === 'liquidity' && !loading.value) return
    if (activeTab.value === 'redeem' && loading.value) return
    
    loading.value = true
    try {
        if (activeTab.value === 'liquidity') {
            if (liquidityType.value === 'add') {
                await addLiquidity(battle.value as BattleData, amount.value!, battle.value.token as `0x${string}`)
            } else {
                await removeLiquidity(battle.value as BattleData, amount.value!)
            }
        } else {
             await redeemPositions(battle.value as BattleData, battle.value.token as `0x${string}`)
        }
        if (accStore.getAccountInfo?.twitterId && accStore.ethConnectAddress) {
            await newParticipation(accStore.getAccountInfo?.twitterId, accStore.ethConnectAddress as `0x${string}`, battle.value?.marketMaker as `0x${string}`)
        }
        await updateBalances()
        amount.value = undefined
    } catch (e) {
        handleErrorTip(e)
    } finally {
        loading.value = false
    }
}

function copyMarketAddress(address: `0x${string}`) {
  onCopy(address)
}

onMounted(() => {
})

</script>

<template>
  <div class="bg-white text-black w-full p-4 sm:p-6 rounded-2xl mx-auto font-sans relative">
    <img
      class="absolute top-4 right-4 sm:top-6 sm:right-6 cursor-pointer w-6 h-6 hover:opacity-70 transition-opacity z-10"
      @click="modalStore.setModalVisible(false)"
      src="~@/assets/icons/icon-modal-close.svg"
      alt="Close"
    />
      <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl sm:text-2xl font-bold mb-2 leading-tight pr-8">
        {{ battle?.title || 'Prediction Pool' }}
    </h2>
      <div class="flex items-center gap-3 text-sm text-gray-600">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">Market Address: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(battle?.marketMaker as `0x${string}`)">{{ formatAddress(battle?.marketMaker) }}</span></span>
      </div>
      <div class="flex items-center gap-3 text-sm text-gray-600 mt-1">
        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">{{ $t('predictTrade.currentAddress') }}: 
          <span class="text-blue-600 underline cursor-pointer" @click="copyMarketAddress(accStore.ethConnectAddress as `0x${string}`)">{{ formatAddress(accStore.ethConnectAddress) }}</span></span>
      </div>
    </div>

    <!-- Main Tabs -->
    <div class="flex border-b border-gray-200 mb-6">
       <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'liquidity' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'liquidity'"
      >
        {{ $t('predictLiquidity.liquidity') }}
        <div v-if="activeTab === 'liquidity'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
      <button 
        class="flex-1 pb-3 text-lg font-bold transition-colors relative"
        :class="activeTab === 'redeem' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'"
        @click="activeTab = 'redeem'"
      >
        {{ $t('predictRedeem.redeem') }}
        <div v-if="activeTab === 'redeem'" class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></div>
      </button>
    </div>

    <!-- Liquidity Content -->
    <div v-if="activeTab === 'liquidity'" class="flex flex-col gap-6">
        <!-- Sub Tabs for Liquidity -->
         <div class="bg-gray-100 p-1 rounded-lg flex">
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all"
                :class="liquidityType === 'add' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'add';amount=0">{{ $t('predictLiquidity.addLiquidity') }}</button>
             <button class="flex-1 py-2 rounded-md text-sm font-bold transition-all"
                :class="liquidityType === 'remove' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="liquidityType = 'remove';amount=0">{{ $t('predictLiquidity.removeLiquidity') }}</button>
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
         <div>
            <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-bold text-gray-700">{{ liquidityType === 'add' ? 'Amount to Add' : 'Amount to Remove' }}</label>
                <div class="text-xs text-gray-500">
                    {{ $t('balance') }}: <span class="font-mono font-bold text-gray-800">{{ formatAmount(liquidityType === 'add' ? collateralBalance : lpBalance) }} {{ liquidityType === 'add' ? battle.tick : 'LP' }}</span>
                </div>
            </div>
             <div class="relative mb-3">
                <input 
                    type="number" 
                    v-model="amount" 
                    min="0"
                    class="w-full bg-gray-50 text-center text-gray-900 rounded-lg border border-gray-200 p-3 pr-24 font-mono text-xl focus:outline-none focus:border-blue-500 transition-colors"
                >
                <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <span class="text-gray-400 text-sm">{{ liquidityType === 'add' ? battle.tick : 'LP' }}</span>
                    <button class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors" @click="setMax">Max</button>
                </div>
            </div>
         </div>

         <button 
            class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white shadow-lg transition-all transform active:scale-[0.99]"
            @click="handleAction"
            :disabled="loading || !amount || (battle.status !== 1 && liquidityType === 'add')"
        >
            {{ liquidityType === 'add' ? $t('predictLiquidity.addLiquidity') : $t('predictLiquidity.removeLiquidity') }}
            <i-ep-loading v-if="loading" class="animate-spin ml-2" />
        </button>
    </div>

    <!-- Redeem Content -->
    <div v-else class="flex flex-col gap-6">
        <div class="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your Red Positions</span>
                 <span class="font-mono font-bold text-red-600">{{ formatAmount(redBalance) }}</span>
             </div>
             <div class="flex justify-between items-center">
                 <span class="text-gray-500">Your Blue Positions</span>
                 <span class="font-mono font-bold text-blue-600">{{ formatAmount(blueBalance) }}</span>
             </div>
        </div>

        <div v-if="!isResolved" class="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div class="text-4xl mb-2">⏳</div>
            <p class="font-bold">{{ $t('predictRedeem.predictionInProgress') }}</p>
            <p class="text-sm mt-1">{{ $t('predictRedeem.rewardTip') }}</p>
        </div>

        <div v-else class="text-center space-y-4">
             <div class="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
                 <p class="font-bold text-lg">{{ $t('predictRedeem.eventResolved') }}</p>
                 <p>{{ $t('predictRedeem.winner', { winner: battle?.winner === 'left' ? $t('predictTrade.red') : $t('predictTrade.blue') }) }}</p>
             </div>
             
             <button 
                class="w-full py-4 flex justify-center items-center rounded-full bg-gradient-primary font-bold text-lg text-white primary-button shadow-lg transition-all transform active:scale-[0.99]"
                @click="handleAction"
                :disabled="loading"
            >
                {{ $t('predictRedeem.redeemRewards') }}
                <i-ep-loading v-if="loading" class="animate-spin ml-2" />
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