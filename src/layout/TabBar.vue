<script setup lang="ts">
import {useModalStore, useStateStore} from "@/stores/common";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import CreateBtn from "@/layout/CreateBtn.vue";
import { useRoute } from "vue-router";
import { computed } from "vue";
import { useChainStore } from '@/stores/chain'

const accStore = useAccountStore()
const modalStore = useModalStore()
const stateStore = useStateStore()
const route = useRoute()
const chainStore = useChainStore()
const predictionEnabled = computed(() => chainStore.deployment.features.prediction)

const { vp, op } = useAccount()

// 判断当前路由是否激活
const isActive = (path: string | string[]) => {
  if (Array.isArray(path)) {
    return path.some(p => route.path.startsWith(p))
  }
  return route.path === path || route.path.startsWith(path + '/')
}

// 主菜单已路由化（/、/coins、/predictions），激活态直接看路由
const isTagActive = computed(() => {
  return route.name === 'home' || route.name === 'commerce'
})

const isCoinActive = computed(() => {
  return route.name === 'coins' || isActive(['/tag-detail', '/buy-sell'])
})

const isPredictionActive = computed(() => {
  return route.name === 'predictions' || isActive('/predict')
})

const goToTag = () => {
  stateStore.setTagSubMenu('tweets')
}

</script>

<template>
  <div class="relative h-14 bg-surface">
    <div class="w-full h-full flex justify-between items-center px-6 relative z-10">
      <router-link to="/" class="flex flex-col items-center justify-center cursor-pointer p-1 gap-0.5 min-w-[44px]" @click="goToTag">
        <img v-if="isTagActive" class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
        <span class="text-[10px] leading-none" :class="isTagActive ? 'text-orange-normal font-semibold' : 'text-grey-normal'">{{ $t('home') }}</span>
      </router-link>
      <router-link to="/coins" class="flex flex-col items-center justify-center cursor-pointer p-1 gap-0.5 min-w-[44px]">
        <img v-if="isCoinActive" class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="">
        <span class="text-[10px] leading-none" :class="isCoinActive ? 'text-orange-normal font-semibold' : 'text-grey-normal'">{{ $t('coin') }}</span>
      </router-link>
      <router-link v-if="predictionEnabled" to="/predictions" class="flex flex-col items-center justify-center cursor-pointer p-1 gap-0.5 min-w-[44px]">
        <img v-if="isPredictionActive" class="w-6 h-6" src="~@/assets/icons/icon-pie-chart.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-pie-chart.svg" alt="">
        <span class="text-[10px] leading-none" :class="isPredictionActive ? 'text-orange-normal font-semibold' : 'text-grey-normal'">{{ $t('prediction') }}</span>
      </router-link>
      <router-link to="/wallet/" class="flex flex-col items-center justify-center cursor-pointer p-1 gap-0.5 min-w-[44px]">
        <img v-if="$route.name==='wallet'" class="w-6 h-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-wallet.svg" alt="">
        <span class="text-[10px] leading-none" :class="$route.name==='wallet' ? 'text-orange-normal font-semibold' : 'text-grey-normal'">{{ $t('wallet') }}</span>
      </router-link>
      <ProfileBtn class="flex flex-col items-center justify-center cursor-pointer p-1 gap-0.5 min-w-[44px]" />
    </div>
  </div>
</template>

<style scoped>

</style>
