<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { mockTransactions } from '../mockData'
import { formatAddress, formatTime } from '@/utils/helper'

// Types
interface Transaction {
  trader: string
  fpmm: string
  outcomeIndex: number
  amount: number
  isBuy: number
  transTime: number
  transHash: string
  twitterId: string
  twitterName: string
  twitterUsername: string
  profile: string
  followers: number
  followings: number
}

const list = ref<Transaction[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

const onLoad = () => {
  // Simulate async fetch
  setTimeout(() => {
    if (refreshing.value) {
      list.value = []
      refreshing.value = false
    }

    // Append mock data
    const newData = [...mockTransactions, ...mockTransactions, ...mockTransactions, ...mockTransactions] // Clone multiple times to ensure scroll
    list.value.push(...newData)
    loading.value = false

    // Limit for demo
    if (list.value.length >= 40) {
      finished.value = true
    }
  }, 1000)
}

const onRefresh = () => {
  finished.value = false
  loading.value = true
  onLoad()
}

// Helpers
const formatTimestamp = (ts: number) => {
    // Return relative time (e.g., "7m ago") - using simple mock for now
    const now = Date.now() / 1000
    const diff = now - ts
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return '1d ago'
}

const getOutcomeColor = (index: number) => index === 0 ? 'text-green-500' : 'text-red-500' // Yes=Green, No=Red
const getOutcomeName = (index: number) => index === 0 ? 'Yes' : 'No'

// Mock price logic (since mock data lacks price)
const getPrice = (item: Transaction) => (Math.random() * 0.99 + 0.01).toFixed(3) // Random price between 0.01 and 1.00
const getValue = (item: Transaction) => Math.floor(item.amount * 0.5) // Assume avg price 0.5
</script>

<template>
  <div class="bg-white rounded-2xl flex flex-col shadow-sm border border-gray-100 overflow-hidden">
    <!-- Header removed to match screenshot style closely, or keep simple -->
    <!-- <div class="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between items-center">
        <span>Recent Activity</span>
    </div> -->
    
    <div class="custom-scrollbar">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="No more transactions"
          @load="onLoad"
        >
          <div 
            v-for="(item, index) in list" 
            :key="index"
            class="flex items-center gap-3 p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer text-sm"
          >
            <!-- Avatar -->
            <img :src="item.profile" class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0">
            
            <!-- Main Content -->
            <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1">
                <span class="font-bold text-gray-900 truncate max-w-[100px]">{{ item.twitterName }}</span>
                <span class="text-gray-500">{{ item.isBuy ? 'bought' : 'sold' }}</span>
                <span class="font-bold whitespace-nowrap" :class="getOutcomeColor(item.outcomeIndex)">
                    {{ Math.floor(item.amount).toLocaleString() }} {{ getOutcomeName(item.outcomeIndex) }}
                </span>
                <span class="text-gray-500 whitespace-nowrap">
                    at {{ getPrice(item) }}¢
                </span>
                <span class="text-gray-400 whitespace-nowrap">
                    (${{ getValue(item) }})
                </span>
            </div>

            <!-- Right Side: Time & Link -->
            <div class="flex items-center gap-2 text-gray-400 text-xs whitespace-nowrap flex-shrink-0">
                <span>{{ formatTimestamp(item.transTime) }}</span>
                <a :href="'https://etherscan.io/tx/' + item.transHash" target="_blank" class="hover:text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                </a>
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
