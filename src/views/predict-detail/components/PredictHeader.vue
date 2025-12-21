<script setup lang="ts">
import { PropType, computed } from 'vue'
import { formatAddress } from '@/utils/helper'
import TweetBtnReply from '@/components/tweets/TweetBtnReply.vue'
import TweetBtnCurate from '@/components/tweets/TweetBtnCurate.vue'

const props = defineProps({
  battle: {
    type: Object,
    required: true
  }
})

// Mock helper to format time
const formatTime = (timeStr: string) => timeStr

const progress = computed(() => {
  const total = props.battle.left.price + props.battle.right.price
  if (total === 0) return 50
  return (props.battle.left.price / total) * 100
})
</script>

<template>
  <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm mb-4">
    <!-- Title & Status -->
    <div class="flex justify-between items-start mb-6">
      <h1 class="text-xl sm:text-2xl font-bold leading-tight pr-4 flex-1">
        {{ battle.title }}
      </h1>
      <div class="flex flex-col items-end gap-2">
         <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full whitespace-nowrap">
          {{ battle.status === 1 ? 'Live' : 'Ended' }}
        </span>
        <span class="text-xs text-gray-500 font-mono">{{ formatAddress(battle.marketMaker) }}</span>
      </div>
    </div>

    <!-- Battle Cards -->
    <div class="flex flex-col sm:flex-row gap-4 relative">
      <!-- Left (Red) -->
      <div class="flex-1 bg-red-50 rounded-xl p-4 border border-red-100 relative overflow-hidden group hover:border-red-300 transition-all">
        <div class="flex items-center gap-3 mb-3">
          <img :src="battle.left.tweet.author.avatar" class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm">
          <div>
            <div class="font-bold text-sm text-gray-900">{{ battle.left.tweet.author.name }}</div>
            <div class="text-xs text-gray-500">{{ battle.left.tweet.author.handle }}</div>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-4 line-clamp-3 italic">
          "{{ battle.left.tweet.text }}"
        </p>
        <div class="flex justify-between items-end border-t border-red-100 pt-3">
            <div class="flex items-stretch gap-3 w-full">
                <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnReply :tweet="battle.left.tweet" :hide-number="true" />
                    <div class="text-xs text-red-600 text-center flex flex-col items-center">
                        <span>{{ battle.left.tweet.replyCount ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Comments</span>
                    </div>
                </div>
                <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnCurate :tweet="battle.left.tweet" :hide-number="true" />
                    <div class="text-xs text-red-600 text-center flex flex-col items-center">
                        <span>{{ battle.left.tweet.amount?.toLocaleString() ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Supports</span>
                    </div>
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
      <div class="flex-1 bg-blue-50 rounded-xl p-4 border border-blue-100 relative overflow-hidden group hover:border-blue-300 transition-all">
        <div class="flex items-center gap-3 mb-3">
          <img :src="battle.right.tweet.author.avatar" class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm">
          <div>
            <div class="font-bold text-sm text-gray-900">{{ battle.right.tweet.author.name }}</div>
            <div class="text-xs text-gray-500">{{ battle.right.tweet.author.handle }}</div>
          </div>
        </div>
        <p class="text-sm text-gray-700 mb-4 line-clamp-3 italic">
          "{{ battle.right.tweet.text }}"
        </p>
        <div class="flex justify-between items-end border-t border-blue-100 pt-3">
            <div class="flex items-stretch gap-3 w-full">
                <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnReply :tweet="battle.right.tweet" :hide-number="true" />
                    <div class="text-xs text-blue-600 text-center flex flex-col items-center">
                        <span>{{ battle.right.tweet.replyCount ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Comments</span>
                    </div>
                </div>
                <div class="flex-1 flex flex-col gap-1 items-center">
                    <TweetBtnCurate :tweet="battle.right.tweet" :hide-number="true" />
                    <div class="text-xs text-blue-600 text-center flex flex-col items-center">
                        <span>{{ battle.right.tweet.amount?.toLocaleString() ?? 0 }}</span>
                        <span class="text-[10px] opacity-70">Supports</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mt-6">
       <div class="flex justify-between text-xs font-bold text-gray-500 mb-2">
          <span class="text-red-500">{{ progress.toFixed(1) }}%</span>
          <span class="text-blue-500">{{ (100 - progress).toFixed(1) }}%</span>
       </div>
       <div class="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
          <div class="bg-red-500 transition-all duration-500" :style="{ width: progress + '%' }"></div>
          <div class="bg-blue-500 transition-all duration-500" :style="{ width: (100 - progress) + '%' }"></div>
          
          <!-- Middle marker -->
           <div class="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white opacity-50"></div>
       </div>
    </div>
  </div>
</template>

