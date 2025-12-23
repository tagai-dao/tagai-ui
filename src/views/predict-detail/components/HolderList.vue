<script setup lang="ts">
import { onActivated, ref } from 'vue'
import type { FPMMUserHolding, MarketData } from '@/types'
import { getFPMMUserHoldings } from '@/apis/api'
import { handleErrorTip } from '@/utils/notify'
import { formatAddress } from '@/utils/helper';
import UserAvatar from '@/components/common/UserAvatar.vue';

const props = defineProps<{
  market: MarketData
}>()

const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const redList = ref<FPMMUserHolding[]>([])
const blueList = ref<FPMMUserHolding[]>([])

const onLoad = async () => {
  try {
    if (refreshing.value || loading.value || finished.value) return
    
    // Use the length of the longer list to determine page
    const currentLen = Math.max(redList.value.length, blueList.value.length)
    const page = Math.floor(currentLen / 20) + 1
    
    // Note: The API likely returns { listA: [], listB: [] } or similar. 
    // We assume the API handles pagination for both lists simultaneously.
    const res: any = await getFPMMUserHoldings(
      props.market.battle.marketMaker,
      props.market.battle.positionAID,
      props.market.battle.positionBID,
      page
    )

    if (res) {
      // Assuming response structure, adjust if API differs
      // If API returns flat list with position distinction, we'd filter here.
      // But based on params, it likely returns separated lists.
      const newRed = res.listA || res.red || []
      const newBlue = res.listB || res.blue || []
      
      redList.value = redList.value.concat(newRed)
      blueList.value = blueList.value.concat(newBlue)
      
      if (newRed.length < 20 && newBlue.length < 20) {
        finished.value = true
      }
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
    const res: any = await getFPMMUserHoldings(
      props.market.battle.marketMaker,
      props.market.battle.positionAID,
      props.market.battle.positionBID
    )
    if (res) {
      redList.value = res.b1 || []
      blueList.value = res.b2 || []
    }
    
    // Check if we already have all data (short lists)
    if (redList.value.length < 30 && blueList.value.length < 30) {
        finished.value = true
    }
    
  } catch (error) {
    console.error(6, error)
    handleErrorTip(error)
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

// Helper to calculate percentage if needed, or just use balance
const getTotalSupply = () => {
  // This is an estimation or needs total supply from market data
  // For now we just show balance or calculate relative to loaded?
  // Let's just show balance as in TradeList
  return 0
}

onActivated(() => {
  onRefresh()
})
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col shadow-sm h-full">
      <div class="p-4 border-b border-gray-100 font-bold text-gray-800">Top Holders</div>
      
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
                  <!-- Left (Red) Holders -->
                  <div class="flex-1 flex flex-col gap-3">
                      <div class="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 border-b border-red-100 pb-2">Red Holders</div>
                      <div v-for="(holder, idx) in redList" :key="holder.ethAddr + 'red'" 
                      v-show="holder.ethAddr != market.battle.marketMaker"
                           class="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
                           <div class="relative">
                              <img :src="holder.profile" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                              <!-- <div class="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                                  {{ idx + 1 }}
                              </div> -->
                          </div>
                          <div class="flex-1 min-w-0">
                            <div v-if="holder.ethAddr == market.battle.marketMaker" class="font-bold text-sm text-red-600 truncate">{{ 'Market' }}</div>
                            <div v-else-if="holder.twitterId" class="font-bold text-sm text-gray-900 truncate">{{ holder.twitterName || holder.twitterUsername || 'Unknown' }}</div>
                            <div v-else class="text-xs text-gray-500 font-mono">{{ formatAddress(holder.ethAddr) }}</div>
                          </div>
                          <div class="text-xs font-bold text-red-500">{{ holder.balance.toLocaleString() }}</div>
                      </div>
                      <div v-if="redList.length === 0 && !loading" class="text-center text-gray-400 text-xs py-4">No holders</div>
                  </div>

                  <!-- Vertical Divider -->
                  <div class="w-px bg-gray-100"></div>

                  <!-- Right (Blue) Holders -->
                  <div class="flex-1 flex flex-col gap-3">
                      <div class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 border-b border-blue-100 pb-2">Blue Holders</div>
                       <div v-for="(holder, idx) in blueList" :key="holder.ethAddr + 'blue'" 
                       v-show="holder.ethAddr != market.battle.marketMaker"
                           class="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                          <div class="relative">
                              <img :src="holder.profile" class="w-8 h-8 rounded-full bg-gray-200 object-cover">
                              <!-- <div class="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center rounded-full font-bold border border-white">
                                  {{ idx + 1 }}
                              </div> -->
                          </div>
                          <div class="flex-1 min-w-0">
                            <div v-if="holder.ethAddr == market.battle.marketMaker" class="font-bold text-sm text-blue-600 truncate">{{ 'Market' }}</div>
                            <div v-else-if="holder.twitterId" class="font-bold text-sm text-gray-900 truncate">{{ holder.twitterName || holder.twitterUsername || 'Unknown' }}</div>
                            <div v-else class="text-xs text-gray-500 font-mono">{{ formatAddress(holder.ethAddr) }}</div>
                          </div>
                          <div class="text-xs font-bold text-blue-500">{{ holder.balance.toLocaleString() }}</div>
                      </div>
                      <div v-if="blueList.length === 0 && !loading" class="text-center text-gray-400 text-xs py-4">No holders</div>
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

