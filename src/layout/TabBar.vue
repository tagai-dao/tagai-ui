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

// 判断 Tag 是否激活
const isTagActive = computed(() => {
  if (!isActive('/')) {
    return false
  }
  return stateStore.activeMainMenu === 'tag'
})

// 判断 Coin 是否激活
const isCoinActive = computed(() => {
  if (!isActive('/')) {
    return isActive(['/tag-detail', '/buy-sell'])
  }
  return stateStore.activeMainMenu === 'coin'
})

// 导航到 Tag 菜单
const goToTag = (e?: Event) => {
  e?.preventDefault()
  stateStore.setActiveMainMenu('tag')
  stateStore.setTagSubMenu('tweets')
}

// 导航到 Coin 菜单
const goToCoin = (e?: Event) => {
  e?.preventDefault()
  stateStore.setActiveMainMenu('coin')
  stateStore.setCoinSubMenu('tagCoin')
}

</script>

<template>
  <div class="relative h-14 bg-white">
    <div class="w-full h-full flex justify-between items-center px-8 relative z-10">
      <router-link to="/" class="flex items-center justify-center cursor-pointer p-2" @click="goToTag">
        <img v-if="isTagActive" class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
      </router-link>
      <router-link to="/" class="flex items-center justify-center cursor-pointer p-2" @click="goToCoin">
        <img v-if="isCoinActive" class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="">
      </router-link>
      <router-link to="/miniapps" class="flex items-center justify-center cursor-pointer p-2">
        <img v-if="$route.name==='miniapps'" class="w-6 h-6" src="~@/assets/icons/icon-miniapp.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
        <img v-else class="w-6 h-6" src="~@/assets/icons/icon-miniapp.svg" alt="">
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
