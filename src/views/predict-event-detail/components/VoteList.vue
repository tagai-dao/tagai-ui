<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getMarketVoteList } from '@/apis/api'
import { formatAddress, parseTimestamp } from '@/utils/helper'
import type { EventPredictData } from '@/types'
import { useAccountStore } from '@/stores/web3'
import { getPotentialReward } from '@/utils/fpmm'
import UserAvatar from '@/components/common/UserAvatar.vue'

const props = defineProps<{
  market: EventPredictData
}>()

const loading = ref(false)
const refreshing = ref(false)
const list = ref<any[]>([])
const finished = ref(false)
const totalVoteRewards = ref(0)

const accStore = useAccountStore()

const loadData = async () => {
  if (loading.value || finished.value || refreshing.value) return
  
  loading.value = true
  try {
    const res: any = await getMarketVoteList(props.market.marketMaker, Math.floor((list.value.length - 1) / 30) + 1)
    
    if (res && res.length > 0) {
      list.value.push(...res)
      if (res.length < 30) {
        finished.value = true
      }
    } else {
      finished.value = true
    }
  } catch (error) {
    console.error(error)
    finished.value = true
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  refreshing.value = true
  finished.value = false
  try {
    const res: any = await getMarketVoteList(props.market.marketMaker)
    if (res && res.length > 0) {
      list.value = res
      if (res.length < 30) {
        finished.value = true
      }
    } else {
      list.value = []
      finished.value = true
    }

    const reward = await getPotentialReward(props.market);
    totalVoteRewards.value = reward.rewardAmount;
  } catch (error) {
    console.error(error)
  } finally {
    refreshing.value = false
  }
}

watch(() => props.market.marketMaker, () => {
  onRefresh()
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col">
    <div class="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span class="text-sm text-gray-500 font-medium">{{ $t('predictTrade.potentialReward') }}</span>
        <span class="font-bold font-mono text-gray-900">{{ totalVoteRewards.toLocaleString() }} ${{ market.tick }}</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :finished-text="$t('noMore')"
        @load="loadData"
      >
        <div class="divide-y divide-gray-100">
          <div v-for="(item, index) in list" :key="index" class="p-4 hover:bg-white transition-colors">
            <div class="flex items-center gap-3">
              <!-- Avatar -->
              <div class="flex-shrink-0">
                <UserAvatar 
                  :profile-img="item.profile" 
                  :name="item.twitterName" 
                  :username="item.twitterUsername"
                  :followers="item.followers" 
                  :followings="item.followings" 
                  :steem-id="item.steemId" 
                  :eth-addr="item.ethAddr" 
                  :teleported="true"
                  :credit="item.predictionCredit"
                  :credit-factor="item.predictCreditFactor"
                >
                  <template #avatar-img>
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-100">
                      <img v-if="item.profile" :src="item.profile" class="w-full h-full object-cover" :alt="item.twitterName || item.twitterUsername">
                      <div v-else class="w-full h-full flex items-center justify-center bg-gray-200">
                        <i-ep-avatar class="text-gray-400 text-lg" />
                      </div>
                    </div>
                  </template>
                </UserAvatar>
              </div>
              
              <!-- Content -->
              <div class="flex flex-col flex-1 min-w-0">
                 <div class="flex items-center gap-1 flex-wrap text-base leading-snug">
                    <span class="font-bold text-gray-900 hover:underline cursor-pointer truncate max-w-[200px]">
                      {{ item.twitterUsername ? '@' + item.twitterUsername : (item.twitterName || formatAddress(item.ethAddr)) }}
                    </span>
                    <span class="text-gray-500 mx-1">{{ $t('predictTrade.voted') }}</span>
                    <span 
                      class="font-bold"
                      :class="item.voteResult === 1 ? 'text-red-600' : 'text-blue-600'"
                    >
                       {{ item.voteResult === 1 ? $t('predictTrade.yes') : $t('predictTrade.no') }}
                    </span>
                 </div>
                 <!-- <div class="flex items-center gap-2 text-xs text-gray-400">
                    <span v-if="item.voteVp" class="font-mono text-gray-600 font-medium">{{ item.voteVp }} VP</span>
                    <span>·</span>
                    <span>{{ parseTimestamp(item.timestamp) }}</span>
                 </div> -->
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- Empty State -->
    <div v-if="list.length === 0 && !loading && !refreshing" class="py-12 flex flex-col items-center justify-center text-gray-400">
       <div class="text-4xl mb-2">🗳️</div>
       <p class="text-sm">{{ $t('noMore') }}</p>
    </div>
  </div>
</template>
