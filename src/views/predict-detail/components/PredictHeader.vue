<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { formatAddress, parseTimestamp } from '@/utils/helper'
import TweetBtnReply from '@/components/tweets/TweetBtnReply.vue'
import TweetBtnCurate from '@/components/tweets/TweetBtnCurate.vue'
import type { BattleData, MarketData, Tweet } from '@/types'
import { useClipboard } from '@vueuse/core'
import { useRouter } from 'vue-router'

const props = defineProps<{
  market: MarketData
}>()

const { copy, copied } = useClipboard()
const router = useRouter()

const openTweet = (tweet: Tweet) => {
  router.push(`/post-detail/${tweet.tweetId as string}`)
}

const aAmount = computed(() => {
  return props.market.battle.amounta || (props.market.tweets[props.market.battle.predictAID]?.amount ?? 0)
})
const bAmount = computed(() => {
  return props.market.battle.amountb || (props.market.tweets[props.market.battle.predictBID]?.amount ?? 0)
})

const totalCuration = computed(() => {
  return aAmount.value + bAmount.value
})

</script>

<template>
  <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm mb-4">
    <!-- Title & Status -->
    <div class="flex justify-between items-start mb-6">
      <h1 class="text-lm sm:text-xl font-bold leading-tight pr-4 flex-1">
        {{ market.battle.title }}
      </h1>
      <div class="flex flex-col items-end gap-2">
         <span 
          class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
          :class="{
            'bg-green-light text-green-dark': !market.battle.winner,
            'bg-grey-light text-grey-normal': !!market.battle.winner
          }"
         >
          {{ market.battle.winner ? 'Ended' : parseTimestamp((Math.max(market.tweets[market.battle.predictAID]?.dayNumber, market.tweets[market.battle.predictBID]?.dayNumber) + 3) * 86400000) }}
        </span>
        <div class="flex items-center gap-1">
          <span 
            @click="copy(market.battle.marketMaker)"
            class="text-xs text-blue-600 font-mono underline cursor-pointer hover:text-blue-800 transition-colors"
            title="Click to copy address"
          >
            {{ formatAddress(market.battle.marketMaker) }}
          </span>
          <span v-if="copied" class="text-[10px] text-green-600 font-bold animate-pulse">Copied!</span>
        </div>
      </div>
    </div>

    <!-- Battle Cards -->
    <div class="flex flex-col sm:flex-row gap-4 relative">
      <!-- Left (Red) -->
      <div @click="openTweet(market.tweets[market.battle.predictAID])" class="flex-1 bg-red-50 rounded-xl p-4 border border-red-100 relative overflow-hidden group hover:border-red-300 transition-all">
        <div v-if="market.battle.winner === 'left'" class="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-sm z-20">
          Winner
        </div>
        <div class="flex items-center gap-3 mb-3">
          <img :src="(market.tweets[market.battle.predictAID] as Tweet).profile" class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm">
          <div>
            <div class="font-bold text-sm text-gray-900">{{ (market.tweets[market.battle.predictAID] as Tweet).twitterName }}</div>
            <div class="text-xs text-gray-500">{{ (market.tweets[market.battle.predictAID] as Tweet).twitterUsername }}</div>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-4 line-clamp-3 italic">
          "{{ market.tweets[market.battle.predictAID]?.content }}"
        </p>
        <div class="flex justify-between items-end border-t border-red-100 pt-3">
            <div class="flex items-stretch gap-3 w-full">
                <!-- <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnReply :tweet="market.tweets[market.battle.predictAID]" :hide-number="true" />
                    <div class="text-xs text-red-600 text-center flex flex-col items-center">
                        <span>{{ market.tweets[market.battle.predictAID]?.replyCount ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Comments</span>
                    </div>
                </div> -->
                <div class="flex-1 flex justify-center gap-1 items-center">
                    <TweetBtnCurate ref="curateBtnARef" 
                    :tweet="market.tweets[market.battle.predictAID]" 
                    :hide-number="true" 
                    :btnclass="`text-lg text-red-600 text-center flex justify-center items-center cursor-pointer hover:opacity-80 transition-opacity`"
                    :numberclass="`text-lg text-red-600 text-center flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity`"
                    class="scale-150">
                        <template #number>
                            <span>{{ aAmount.toFixed(0).toLocaleString() }}</span>
                            ({{ totalCuration ? (aAmount / totalCuration * 100).toFixed(0) : '50' }}%)
                        </template>
                    </TweetBtnCurate>
                </div>
            </div>
        </div>
      </div>

      <!-- VS Badge (Absolute centered on desktop, hidden or adjusted on mobile) -->
      <div class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 hidden sm:flex">
        <div class="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center font-black text-gray-300 italic text-sm border border-gray-100">
          VS
        </div>
      </div>

      <!-- Right (Blue) -->
      <div @click="openTweet(market.tweets[market.battle.predictBID])" class="flex-1 bg-blue-50 rounded-xl p-4 border border-blue-100 relative overflow-hidden group hover:border-blue-300 transition-all">
        <div v-if="market.battle.winner === 'right'" class="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-sm z-20">
          Winner
        </div>
        <div class="flex items-center gap-3 mb-3">
          <img :src="market.tweets[market.battle.predictBID]?.profile" class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm">
          <div>
            <div class="font-bold text-sm text-gray-900">{{ market.tweets[market.battle.predictBID]?.twitterName }}</div>
            <div class="text-xs text-gray-500">{{ market.tweets[market.battle.predictBID]?.twitterUsername }}</div>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-4 line-clamp-3 italic">
          "{{ market.tweets[market.battle.predictBID]?.content }}"
        </p>
        <div class="flex justify-between items-end border-t border-blue-100 pt-3">
            <div class="flex items-stretch gap-3 w-full">
                <!-- <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnReply :tweet="market.tweets[market.battle.predictBID]" :hide-number="true" />
                    <div class="text-xs text-blue-600 text-center flex flex-col items-center">
                        <span>{{ market.tweets[market.battle.predictBID]?.replyCount ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Comments</span>
                    </div>
                </div> -->
                <div class="flex-1 flex justify-center gap-1 items-center">
                      <TweetBtnCurate ref="curateBtnBRef" 
                      :tweet="market.tweets[market.battle.predictBID]" 
                      :hide-number="true" 
                      :btnclass="`text-lg text-blue-600 text-center flex justify-center items-center cursor-pointer hover:opacity-80 transition-opacity`"
                      :numberclass="`text-lg text-blue-600 text-center flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity`"
                      class="scale-150">
                      <template #number>
                            <span>{{ bAmount.toFixed(0).toLocaleString() }}</span>
                            ({{ totalCuration ? (bAmount / totalCuration * 100).toFixed(0) : '50' }}%)
                        </template>
                    </TweetBtnCurate>
                </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <!-- <div class="mt-6">
       <div class="flex justify-between text-xs font-bold text-gray-500 mb-2">
          <span class="text-red-500">{{ getBattleStats(market.battle).percentA.toFixed(1) }}%</span>
          <span class="text-blue-500">{{ getBattleStats(market.battle).percentB.toFixed(1) }}%</span>
       </div>
       <div class="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
          <div class="bg-red-500 transition-all duration-500" :style="{ width: getBattleStats(market.battle).percentA + '%' }"></div>
          <div class="bg-blue-500 transition-all duration-500" :style="{ width: getBattleStats(market.battle).percentB + '%' }"></div>
       </div>
    </div> -->
  </div>
</template>

