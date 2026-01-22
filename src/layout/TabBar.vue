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
  <div class="relative h-[76px] bg-white">
<!--    <div class="absolute h-[76px] left-0 right-0 bottom-0 flex items-center justify-center rounded-md overflow-hidden">-->
<!--      <div class="flex-1 h-full bg-gradient-tab"></div>-->
<!--      <img class="h-full object-cover object-center" src="~@/assets/images/tabbar-bg.svg" alt="">-->
<!--      <div class="flex-1 h-full bg-gradient-tab"></div>-->
<!--    </div>-->
    <div class="w-full flex justify-between items-end px-8 py-4 relative z-10">
      <router-link to="/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2" @click="goToTag">
        <template v-if="isTagActive">
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
          <span class="text-gradient bg-gradient-primary text-h5">{{$t('home')}}</span>
        </template>
        <template v-else>
          <img class="w-6 h-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
          <span class="text-h5 text-grey-normal">{{$t('home')}}</span>
        </template>
      </router-link>
      <router-link to="/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2" @click="goToCoin">
        <template v-if="isCoinActive">
          <img class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="" style="filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)">
          <span class="text-gradient bg-gradient-primary text-h5">{{$t('coin')}}</span>
        </template>
        <template v-else>
          <img class="w-6 h-6" src="~@/assets/icons/icon-coin.svg" alt="">
          <span class="text-h5 text-grey-normal">{{$t('coin')}}</span>
        </template>
      </router-link>
      <router-link to="/wallet/" class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
        <template v-if="$route.name==='wallet'">
          <img  class="w-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
          <span class="text-gradient bg-gradient-primary text-h5">{{$t('wallet')}}</span>
        </template>
        <template v-else>
          <img class="w-6" src="~@/assets/icons/icon-wallet.svg" alt="">
          <span class="text-h5 text-grey-normal">{{$t('wallet')}}</span>
        </template>
      </router-link>
<!--      <CreateBtn/>-->
      <ProfileBtn class="w-16 flex flex-col items-center cursor-pointer gap-0.5 px-2">
      </ProfileBtn>
    </div>
  </div>
</template>

<style scoped>

</style>
