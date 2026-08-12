<script setup lang="ts">
import ProfileBtn from '@/layout/ProfileBtn.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import emitter from '@/utils/emitter'

const route = useRoute()
const isToken = computed(() => ['home', 'baskets', 'basket-detail', 'basket-fees', 'tag-detail', 'buy-sell'].includes(String(route.name)))
const isHome = computed(() => route.name === 'feed' || route.name === 'commerce')
const isBuidler = computed(() => route.name === 'buidler')
const activeFilter = 'filter: brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg)'
const leaveFeedOverlays = () => emitter.emit('mainTabNavigate')
</script>

<template>
  <div class="relative bg-surface" style="height: calc(3.5rem + var(--safe-area-bottom));">
    <div class="native-safe-tabbar-content relative z-10 flex h-14 w-full items-center justify-between px-6">
      <router-link to="/feed" class="tab-item" @click="leaveFeedOverlays">
        <img v-if="isHome" class="h-6 w-6" src="~@/assets/icons/icon-tabbar-home-active.svg" alt="">
        <img v-else class="h-6 w-6" src="~@/assets/icons/icon-tabbar-home.svg" alt="">
        <span :class="isHome ? 'text-orange-normal font-semibold' : 'text-grey-normal'">Home</span>
      </router-link>
      <router-link to="/" class="tab-item" @click="leaveFeedOverlays">
        <img class="h-6 w-6" src="~@/assets/icons/icon-coin.svg" alt="" :style="isToken ? activeFilter : ''">
        <span :class="isToken ? 'text-orange-normal font-semibold' : 'text-grey-normal'">Token</span>
      </router-link>
      <router-link to="/buidler" class="tab-item" @click="leaveFeedOverlays">
        <img class="h-6 w-6" src="~@/assets/icons/icon-pie-chart.svg" alt="" :style="isBuidler ? activeFilter : ''">
        <span :class="isBuidler ? 'text-orange-normal font-semibold' : 'text-grey-normal'">BUIDLer</span>
      </router-link>
      <router-link to="/wallet/" class="tab-item" @click="leaveFeedOverlays">
        <img v-if="$route.name==='wallet'" class="h-6 w-6" src="~@/assets/icons/icon-tabbar-wallet-active.svg" alt="">
        <img v-else class="h-6 w-6" src="~@/assets/icons/icon-wallet.svg" alt="">
        <span :class="$route.name==='wallet' ? 'text-orange-normal font-semibold' : 'text-grey-normal'">{{ $t('wallet') }}</span>
      </router-link>
      <ProfileBtn class="tab-item" @click="leaveFeedOverlays" />
    </div>
  </div>
</template>

<style scoped>
.tab-item { display:flex; min-width:44px; cursor:pointer; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:4px; }
.tab-item span { font-size:10px; line-height:1; }
</style>
