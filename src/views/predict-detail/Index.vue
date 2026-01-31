<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import PredictDetailLeft from './PredictDetailLeft.vue'
import PredictDetailRight from './PredictDetailRight.vue'
import { useRouter } from 'vue-router'
import { getMarket } from '@/apis/api'
import type { BattleData, MarketData } from '@/types'
import { handleErrorTip } from '@/utils/notify'
import { useAccountStore } from '@/stores/web3'
import { getMarketInfos } from '@/utils/fpmm'

const accStore = useAccountStore()
const router = useRouter()
const market = ref<MarketData | null>(null)

onMounted(async () => {
  // 从url中获取market id
  const marketId = router.currentRoute.value.params.id as string
  try {
    const res: any = await getMarket(marketId, accStore.getAccountInfo?.twitterId) as unknown as MarketData
    const marketInfos = await getMarketInfos([res.battle] as BattleData[])
    market.value = {
        battle: {
            ...res.battle,
            winner: getWinner(res),
            reserveA: marketInfos[res.battle.marketMaker + '-priceA'],
            reserveB: marketInfos[res.battle.marketMaker + '-priceB'],
            fee: marketInfos[res.battle.marketMaker + '-fee']
        },
        tweets: res.tweets
    } 
  } catch (error) {
    console.log(1, error)
    handleErrorTip(error)
  }
})

// 判断胜利者：与 PredictBattleCard 显示分数使用相同数据源（amounta/amountb 优先），避免显示分数高但 winner 不一致
const getWinner = (market: MarketData): 'left' | 'right' | null => {
    const tweetA = market.tweets[market.battle.predictAID]
    const tweetB = market.tweets[market.battle.predictBID]
    if (tweetA && tweetB) {
        if (tweetA.isSettled && tweetB.isSettled) {
            const amountA = market.battle.amounta ?? (tweetA.amount ?? 0)
            const amountB = market.battle.amountb ?? (tweetB.amount ?? 0)
            return amountA > amountB ? 'left' : 'right'
        }
        return null
    }
    return null
}

</script>

<template>
  <div class="h-screen overflow-y-auto bg-gray-50 pb-20 sm:pb-0">
    <!-- Back Button / Header for Mobile -->
    <div class="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 sm:hidden flex items-center gap-2">
       <button @click="router.back()" class="text-gray-600 font-bold">← {{ $t('back') }}</button>
       <span class="font-bold text-gray-900 truncate flex-1">Prediction Market</span>
    </div>

    <div class="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
       <!-- Desktop Back Button -->
       <div class="hidden sm:flex items-center mb-4">
          <button @click="router.back()" class="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold transition-colors">
             <span>←</span>
             <span>{{ $t('back') }}</span>
          </button>
       </div>

       <div class="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          
          <!-- Left Column: Info & Lists -->
          <div class="w-full lg:w-[60%] xl:w-[62%]">
             <PredictDetailLeft :market="market" v-if="market"/>
          </div>

          <!-- Right Column: Trade Panel (Desktop Only) -->
          <div class="hidden lg:block w-full lg:w-[40%] xl:w-[38%] lg:sticky lg:top-6">
             <PredictDetailRight :market="market" v-if="market"/>
          </div>
       </div>

        <div v-if="!market" class="flex justify-center items-center h-full">
            <i-ep-loading class="animate-spin text-3xl mt-24" />
        </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: Add custom container queries or specific overrides if tailwind isn't enough */
</style>

