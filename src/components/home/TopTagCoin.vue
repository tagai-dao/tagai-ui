<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { formatPrice } from '@/utils/helper'
import { useStateStore } from '@/stores/common'
import { useRouter } from 'vue-router'
import type { Community } from '@/types'
import { getCommunityByMarketCap } from '@/apis/api'
import { getTokenInfo } from '@/utils/pump'
import { handleErrorTip } from '@/utils/notify'

const comStore = useCommunityStore()
const stateStore = useStateStore()
const router = useRouter()

const loading = ref(false)
const finished = ref(false)
const displayedCount = ref(6) // 初始显示6个

// 获取市值排序后的 TagCoin 列表
const sortedTagCoins = computed(() => {
  if (!comStore.marketCapCommunities || comStore.marketCapCommunities.length === 0) {
    return []
  }
  // 按市值排序
  return comStore.marketCapCommunities
    .slice()
    .sort((a, b) => {
      const marketCapA = parseFloat(a.marketCap as any) || 0
      const marketCapB = parseFloat(b.marketCap as any) || 0
      return marketCapB - marketCapA
    })
})

// 获取当前显示的 TagCoin（前 displayedCount 个）
const topTagCoins = computed(() => {
  return sortedTagCoins.value.slice(0, displayedCount.value)
})

// 如果 marketCapCommunities 为空，则加载数据
onMounted(async () => {
  if (!comStore.marketCapCommunities || comStore.marketCapCommunities.length === 0) {
    try {
      const communities = await getCommunityByMarketCap() as Array<Community>
      if (communities && communities.length > 0) {
        const tokenInfo = await getTokenInfo(communities)
        comStore.marketCapCommunities = tokenInfo
      }
    } catch (e) {
      console.error('Load market cap communities error:', e)
    }
  }
})

// 加载更多 TagCoin
async function onLoad() {
  try {
    if (loading.value || finished.value) return
    loading.value = true
    
    // 如果当前显示的数量已经达到或超过总数，标记为完成
    if (displayedCount.value >= sortedTagCoins.value.length) {
      finished.value = true
      loading.value = false
      return
    }
    
    // 检查是否需要加载更多数据
    const currentPage = Math.floor((comStore.marketCapCommunities.length - 1) / 30) + 1
    if (displayedCount.value >= comStore.marketCapCommunities.length) {
      // 需要从后端加载更多数据
      const communities = await getCommunityByMarketCap(currentPage) as Array<Community>
      if (communities && communities.length > 0) {
        const tokenInfo = await getTokenInfo(communities)
        comStore.marketCapCommunities = comStore.marketCapCommunities.concat(tokenInfo)
      } else {
        finished.value = true
      }
    }
    
    // 增加显示数量（每次增加6个）
    displayedCount.value += 6
    
    // 如果显示数量已经达到总数，标记为完成
    if (displayedCount.value >= sortedTagCoins.value.length) {
      finished.value = true
    }
  } catch (e) {
    console.error('Load more TagCoin error:', e)
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

function gotoDetail(community: Community) {
  comStore.currentSelectedCommunity = community
  router.push('/tag-detail/' + community.tick)
}
</script>

<template>
  <div class="h-auto max-h-[50%] bg-white rounded-2xl flex flex-col">
    <div class="font-bold text-h3 py-3 px-4">Top TagCoin</div>
    <div class="flex-1 overflow-auto no-scroll-bar max-h-[400px]">
      <div v-if="topTagCoins.length === 0" class="flex justify-center py-5 w-full">
        <img class="my-8" src="~@/assets/images/empty-data.svg" alt="">
      </div>
      <div v-else class="flex flex-col">
        <div 
          class="flex items-center gap-3 py-3 px-4 border-t-[0.5px] border-grey-light cursor-pointer hover:bg-gray-50 transition-colors"
          v-for="community of topTagCoins" 
          :key="community.tick"
          @click="gotoDetail(community)"
        >
          <!-- Logo -->
          <div class="flex-shrink-0">
            <div class="w-10 h-10 min-w-10 min-h-10 rounded-xl bg-grey-normal-active flex items-center justify-center overflow-hidden">
              <img 
                class="w-full h-full object-center object-cover" 
                :src="community.logo.startsWith('https://tiptag') ? community.logo + '?x-oss-process=image/resize,w_100' : community.logo" 
                alt=""
              >
            </div>
          </div>
          <!-- 名称 -->
          <div class="flex-1 min-w-0">
            <div class="font-bold text-h4 truncate" :class="community.listed ? 'text-orange-normal' : 'text-black'">
              {{ community.tick }}
            </div>
          </div>
          <!-- Market Cap -->
          <div class="flex-shrink-0 text-right">
            <div class="font-bold text-h4">
              {{ formatPrice(Math.floor(parseFloat(community.marketCap as any) * stateStore.ethPrice)) }}
            </div>
          </div>
        </div>
        <template v-if="!loading">
          <div v-if="!finished" class="px-4 py-2 text-center">
            <button class="py-2 text-sm text-orange-normal" @click="onLoad">{{$t('showMore')}}</button>
          </div>
          <div v-else-if="topTagCoins.length > 0" class="text-center text-sm text-grey-light-active pb-3">{{$t('noMore')}}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
