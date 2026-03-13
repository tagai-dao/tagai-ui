<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PredictDetailLeft from './PredictDetailLeft.vue'
import PredictDetailRight from './PredictDetailRight.vue'
import { useRouter } from 'vue-router'
import { getEventMarket } from '@/apis/api'
import type { EventPredictData } from '@/types'
import { handleErrorTip } from '@/utils/notify'
import { useAccountStore } from '@/stores/web3'
import { getMarketInfos } from '@/utils/fpmm'

const accStore = useAccountStore()
const router = useRouter()
const market = ref<EventPredictData | null>(null)

onMounted(async () => {
  // 从url中获取market id
  const marketId = router.currentRoute.value.params.id as string
  try {
    const res: any = await getEventMarket(marketId, accStore.getAccountInfo?.twitterId) as unknown as EventPredictData
    const marketInfos = await getMarketInfos([res] as EventPredictData[])
    market.value = {
        ...res,
        reserveA: marketInfos[res.marketMaker + '-priceA'],
        reserveB: marketInfos[res.marketMaker + '-priceB'],
        fee: marketInfos[res.marketMaker + '-fee']
    } 
  } catch (error) {
    console.log(1, error)
    handleErrorTip(error)
  }
})

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

