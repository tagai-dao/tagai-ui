<script setup lang="ts">
import {useModalStore, useStateStore} from "@/stores/common";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import ProfileBtn from "@/layout/ProfileBtn.vue";
import CreateBtn from "@/layout/CreateBtn.vue";
import { useRoute } from "vue-router";
import { computed } from "vue";

const accStore = useAccountStore()
const modalStore = useModalStore()
const stateStore = useStateStore()
const route = useRoute()

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
  <div class="relative h-14 bg-white">
    <div class="w-full h-full flex justify-between items-center px-8 relative z-10">
      <router-link to="/" class="flex items-center justify-center cursor-pointer p-2" @click="goToTag">
        <img v-if="isTagActive" class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
      </router-link>
      <router-link to="/coins" class="flex items-center justify-center cursor-pointer p-2">
        <img v-if="isCoinActive" class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="">
      </router-link>
      <router-link to="/predictions" class="flex items-center justify-center cursor-pointer p-2">
        <img v-if="isPredictionActive" class="w-6 h-6" src="~@/assets/icons/icon-pie-chart.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-pie-chart.svg" alt="">
      </router-link>
      <router-link to="/wallet/" class="flex items-center justify-center cursor-pointer p-2">
        <img v-if="$route.name==='wallet'" class="w-6 h-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-wallet.svg" alt="">
      </router-link>
      <ProfileBtn class="flex items-center justify-center cursor-pointer p-2" />
    </div>
  </div>
</template>

<style scoped>

</style>
