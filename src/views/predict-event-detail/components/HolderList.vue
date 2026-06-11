<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import type { EventPredictData, FPMMUserHolding } from '@/types'
import { getFPMMUserHoldings } from '@/apis/api'
import { handleErrorTip } from '@/utils/notify'
import { formatAddress } from '@/utils/helper'
import { useEventMarketOutcomes, isMultiOutcomeMarket, OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'

const props = defineProps<{
  market: EventPredictData
}>()

const { outcomeList } = useEventMarketOutcomes(() => props.market)
const isMulti = computed(() => isMultiOutcomeMarket(props.market))

const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const redList = ref<FPMMUserHolding[]>([])
const blueList = ref<FPMMUserHolding[]>([])
const multiList = ref<FPMMUserHolding[]>([])
const activeTab = ref<'red' | 'blue'>('red')
const activeOutcomeIndex = ref(0)

const fetchHoldings = async (positionA: string, positionB: string, page?: number) => {
  return getFPMMUserHoldings(
    props.market.marketMaker,
    positionA,
    positionB,
    page
  )
}

const onLoad = async () => {
  try {
    if (refreshing.value || loading.value || finished.value) return

    if (isMulti.value) {
      const outcome = outcomeList.value.find(o => o.outcomeIndex === activeOutcomeIndex.value)
      if (!outcome?.positionId) {
        finished.value = true
        return
      }
      const page = Math.floor(multiList.value.length / 20) + 1
      const res: any = await fetchHoldings(outcome.positionId, outcome.positionId, page)
      const newItems = res?.b1 || []
      multiList.value = multiList.value.concat(newItems)
      if (newItems.length < 20) finished.value = true
      return
    }

    const currentLen = Math.max(redList.value.length, blueList.value.length)
    const page = Math.floor(currentLen / 20) + 1
    const res: any = await fetchHoldings(props.market.positionAID, props.market.positionBID, page)

    if (res) {
      const newRed = res.listA || res.red || res.b1 || []
      const newBlue = res.listB || res.blue || res.b2 || []
      redList.value = redList.value.concat(newRed)
      blueList.value = blueList.value.concat(newBlue)
      if (newRed.length < 20 && newBlue.length < 20) finished.value = true
    } else {
      finished.value = true
    }
  } catch (error) {
    handleErrorTip(error)
    finished.value = true
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  try {
    finished.value = false
    refreshing.value = true
    multiList.value = []
    redList.value = []
    blueList.value = []

    if (isMulti.value) {
      const outcome = outcomeList.value.find(o => o.outcomeIndex === activeOutcomeIndex.value)
      if (outcome?.positionId) {
        const res: any = await fetchHoldings(outcome.positionId, outcome.positionId)
        multiList.value = res?.b1 || []
        if (multiList.value.length < 30) finished.value = true
      } else {
        finished.value = true
      }
      return
    }

    const res: any = await fetchHoldings(props.market.positionAID, props.market.positionBID)
    if (res) {
      redList.value = res.b1 || []
      blueList.value = res.b2 || []
    }
    if (redList.value.length < 30 && blueList.value.length < 30) finished.value = true
  } catch (error) {
    handleErrorTip(error)
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

const switchOutcome = (outcomeIndex: number) => {
  activeOutcomeIndex.value = outcomeIndex
  onRefresh()
}

onActivated(() => {
  onRefresh()
})
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col shadow-sm h-full">
      <div class="p-4 border-b border-gray-100 font-bold text-gray-800 flex items-center justify-between gap-3">
        <span class="hidden md:block">Top Holders</span>
        <!-- 多元 outcome tabs -->
        <div v-if="isMulti" class="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            v-for="(outcome, idx) in outcomeList"
            :key="outcome.outcomeIndex"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all truncate max-w-full"
            :class="activeOutcomeIndex === outcome.outcomeIndex ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-600'"
            :style="activeOutcomeIndex === outcome.outcomeIndex ? { backgroundColor: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length] } : {}"
            @click="switchOutcome(outcome.outcomeIndex)"
          >
            {{ outcome.label }}
          </button>
        </div>
        <!-- Mobile Tab Switcher (binary) -->
        <div v-else class="flex md:hidden bg-gray-100 rounded-lg p-1 w-full text-sm font-medium">
          <button 
            class="flex-1 py-1.5 rounded-md transition-all duration-200"
            :class="activeTab === 'red' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'red'"
          >
            Yes Holders
          </button>
          <button 
            class="flex-1 py-1.5 rounded-md transition-all duration-200"
            :class="activeTab === 'blue' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'blue'"
          >
            No Holders
          </button>
        </div>
      </div>
      
      <div class="custom-scrollbar flex-1 overflow-y-auto min-h-0">
          <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
            <van-list
              v-model:loading="loading"
              :finished="finished"
              finished-text=""
              @load="onLoad"
              :immediate-check="false"
            >
              <div class="flex gap-4 p-4 min-h-[200px]">
                  <!-- Multi outcome holders -->
                  <div v-if="isMulti" class="flex-1 flex flex-col gap-3">
                    <div
                      v-for="(holder, idx) in multiList"
                      :key="holder.ethAddr + '-' + idx"
                      v-show="holder.ethAddr != market.marketMaker"
                      class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                    >
                      <img :src="holder.profile" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                      <div class="flex-1 min-w-0">
                        <div v-if="holder.twitterId" class="font-bold text-sm text-gray-900 truncate">{{ holder.twitterName || holder.twitterUsername || 'Unknown' }}</div>
                        <div v-else class="text-xs text-gray-500 font-mono">{{ formatAddress(holder.ethAddr) }}</div>
                      </div>
                      <div class="text-xs font-bold text-gray-700">{{ holder.balance.toLocaleString() }}</div>
                    </div>
                    <div v-if="multiList.length === 0 && !loading" class="text-center text-gray-400 text-xs py-4">No holders</div>
                  </div>

                  <template v-else>
                  <!-- Left (Red) Holders -->
                  <div class="flex-1 flex flex-col gap-3" :class="activeTab === 'red' ? 'flex' : 'hidden md:flex'">
                      <div class="hidden md:block text-xs font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-2">Yes Holders</div>
                      <div v-for="(holder, idx) in redList" :key="holder.ethAddr + 'red'" 
                      v-show="holder.ethAddr != market.marketMaker"
                           class="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
                           <div class="relative">
                              <img :src="holder.profile" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                              <!-- <div class="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                                  {{ idx + 1 }}
                              </div> -->
                          </div>
                          <div class="flex-1 min-w-0">
                            <div v-if="holder.ethAddr == market.marketMaker" class="font-bold text-sm text-red-600 truncate">{{ 'Market' }}</div>
                            <div v-else-if="holder.twitterId" class="font-bold text-sm text-gray-900 truncate">{{ holder.twitterName || holder.twitterUsername || 'Unknown' }}</div>
                            <div v-else class="text-xs text-gray-500 font-mono">{{ formatAddress(holder.ethAddr) }}</div>
                          </div>
                          <div class="text-xs font-bold text-red-500">{{ holder.balance.toLocaleString() }}</div>
                      </div>
                      <div v-if="redList.length === 0 && !loading" class="text-center text-gray-400 text-xs py-4">No holders</div>
                  </div>

                  <!-- Vertical Divider -->
                  <div class="w-px bg-gray-100 hidden md:block"></div>

                  <!-- Right (Blue) Holders -->
                  <div class="flex-1 flex flex-col gap-3" :class="activeTab === 'blue' ? 'flex' : 'hidden md:flex'">
                      <div class="hidden md:block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-100 pb-2">No Holders</div>
                       <div v-for="(holder, idx) in blueList" :key="holder.ethAddr + 'blue'" 
                       v-show="holder.ethAddr != market.marketMaker"
                           class="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                          <div class="relative">
                              <img :src="holder.profile" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                              <!-- <div class="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                                  {{ idx + 1 }}
                              </div> -->
                          </div>
                          <div class="flex-1 min-w-0">
                            <div v-if="holder.ethAddr == market.marketMaker" class="font-bold text-sm text-blue-600 truncate">{{ 'Market' }}</div>
                            <div v-else-if="holder.twitterId" class="font-bold text-sm text-gray-900 truncate">{{ holder.twitterName || holder.twitterUsername || 'Unknown' }}</div>
                            <div v-else class="text-xs text-gray-500 font-mono">{{ formatAddress(holder.ethAddr) }}</div>
                          </div>
                          <div class="text-xs font-bold text-blue-500">{{ holder.balance.toLocaleString() }}</div>
                      </div>
                      <div v-if="blueList.length === 0 && !loading" class="text-center text-gray-400 text-xs py-4">No holders</div>
                  </div>
                  </template>
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

