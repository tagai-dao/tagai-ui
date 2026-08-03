<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccountStore } from '@/stores/web3'
import { useModalStore, useStateStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { useLoginStore, LoginStepType } from '@/stores/login'
import { useChainStore } from '@/stores/chain'

const router = useRouter()
const route = useRoute()
const accStore = useAccountStore()
const modalStore = useModalStore()
const stateStore = useStateStore()
const loginStore = useLoginStore()
const chainStore = useChainStore()
const predictionMainEntryEnabled = computed(() => (
  chainStore.deployment.features.prediction
  && chainStore.deployment.features.predictionMainEntry
))

const moreMenuVisible = ref(false)
const moreMenuRef = ref()

// 使用 store 中的状态
const coinSubMenu = computed({
  get: () => stateStore.coinSubMenu,
  set: (val) => {
    stateStore.coinSubMenu = val
    stateStore.setActiveHomeTab(val)
  }
})

// 判断当前路由是否激活
const isActive = (path: string | string[]) => {
  if (Array.isArray(path)) {
    return path.some(p => route.path.startsWith(p))
  }
  return route.path === path || route.path.startsWith(path + '/')
}

// 主菜单已路由化（/、/coins、/predictions），激活态直接看路由
const isCoinActive = computed(() => {
  return route.name === 'coins' || isActive(['/tag-detail', '/buy-sell'])
})

const isTagActive = computed(() => {
  return route.name === 'home' || route.name === 'commerce'
})

const isPredictionActive = computed(() => {
  return route.name === 'predictions' || isActive('/predict')
})

const isBasketsActive = computed(() => {
  return route.name === 'baskets' || route.name === 'basket-detail' || isActive('/baskets')
})

/** 选中态：图标染成品牌橙 */
const activeIconFilter = {
  filter: 'brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)',
} as const

/** 未选中：暗色下 invert，避免深色 SVG 融进侧栏 */
const inactiveIconCls = 'dark:invert dark:opacity-80'

// 创建 TagCoin
const createTagCoin = () => {
  modalStore.setModalVisible(true, GlobalModalType.CreateCoin)
}

// 处理 Profile 点击
const handleProfileClick = (e?: Event) => {
  e?.preventDefault()
  e?.stopPropagation()
  
  if (accStore.getAccountInfo) {
    // 已登录，跳转到 profile 页面
    router.push('/profile')
  } else {
    // 未登录，显示登录框
    loginStore.setLoginStep(LoginStepType.AuthTwitter)
  }
}

// 处理 Wallet 点击
const handleWalletClick = (e?: Event) => {
  e?.preventDefault()
  e?.stopPropagation()
  
  if (accStore.getAccountInfo) {
    // 已登录，跳转到 wallet 页面
    router.push('/wallet')
  } else {
    // 未登录，显示登录框
    loginStore.setLoginStep(LoginStepType.AuthTwitter)
  }
}
</script>

<template>
  <div class="hidden web:flex flex-col h-full w-[72px] desk:w-[240px] border-r border-gray-200 bg-surface">
    <!-- Logo（中间档缩小居中） -->
    <div class="h-16 flex items-center justify-center desk:justify-start px-2 desk:px-4">
      <img
        class="h-5 desk:h-8 cursor-pointer"
        src="~@/assets/logo.png"
        alt="TagAI"
        @click="router.push('/')"
      >
    </div>

    <!-- 菜单项 -->
    <nav class="flex-1 px-2 py-4 space-y-1">
      <!-- 1. Tag 菜单 -->
      <router-link
        to="/"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isTagActive ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
        @click="stateStore.setTagSubMenu('tweets')"
      >
        <img 
          v-if="isTagActive" 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all" 
          src="~@/assets/icons/icon-tabbar-home-active.svg" 
          alt=""
        >
        <img 
          v-else 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="inactiveIconCls"
          src="~@/assets/icons/icon-tabbar-home.svg" 
          alt=""
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('home') || 'Home' }}</span>
      </router-link>

      <!-- 2. Coin -->
      <router-link
        to="/coins"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isCoinActive ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
      >
        <img 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="isCoinActive ? '' : inactiveIconCls"
          :style="isCoinActive ? activeIconFilter : undefined"
          src="~@/assets/icons/icon-coin.svg" 
          alt="Coin"
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('coin') || 'Coin' }}</span>
      </router-link>

      <!-- 3. Prediction -->
      <router-link
        v-if="predictionMainEntryEnabled"
        to="/predictions"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isPredictionActive ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
      >
        <img 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="isPredictionActive ? '' : inactiveIconCls"
          :style="isPredictionActive ? activeIconFilter : undefined"
          src="~@/assets/icons/icon-pie-chart.svg" 
          alt="Prediction"
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('prediction') || 'Prediction' }}</span>
      </router-link>

      <!-- Baskets -->
      <router-link
        to="/baskets"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isBasketsActive ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
      >
        <img
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="isBasketsActive ? '' : inactiveIconCls"
          :style="isBasketsActive ? activeIconFilter : undefined"
          src="~@/assets/icons/icon-pie-chart.svg"
          alt="Baskets"
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('baskets.menu') || 'Baskets' }}</span>
      </router-link>

      <!-- 4. 通知 -->
      <router-link
        to="/notification"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2 relative"
        :class="isActive('/notification') ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
      >
        <div class="relative">
          <img 
            class="w-6 h-6 mr-0 desk:mr-3 transition-all"
            :class="isActive('/notification') ? '' : inactiveIconCls"
            :style="isActive('/notification') ? activeIconFilter : undefined"
            src="~@/assets/icons/icon-notification.svg" 
            alt=""
          >
          <div 
            v-if="accStore.unreadMessageCount > 0" 
            class="absolute top-0 right-0 bg-red-500 h-4 w-4 min-w-4 rounded-full text-[10px] text-white flex justify-center items-center"
          >
            {{ accStore.unreadMessageCount }}
          </div>
        </div>
        <span class="hidden desk:inline text-h4 text-content">{{ $t('notification') || 'Notification' }}</span>
      </router-link>

      <!-- 5. 钱包 -->
      <div 
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/wallet') ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
        @click="handleWalletClick"
      >
        <img 
          v-if="isActive('/wallet')" 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all" 
          src="~@/assets/icons/icon-tabbar-wallet-active.svg" 
          alt=""
        >
        <img 
          v-else 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="inactiveIconCls"
          src="~@/assets/icons/icon-wallet.svg" 
          alt=""
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('wallet') || 'Wallet' }}</span>
      </div>

      <!-- 6. 我的主页 -->
      <div 
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/profile') ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
        @click="handleProfileClick"
      >
        <div class="w-6 h-6 mr-0 desk:mr-3 flex items-center justify-center">
          <img 
            v-if="accStore.getAccountInfo?.profile" 
            class="w-6 h-6 rounded-full transition-all" 
            :src="accStore.getAccountInfo.profile.replace('normal', '200x200')" 
            alt=""
          >
          <img 
            v-else-if="isActive('/profile')"
            class="w-6 h-6 transition-all" 
            src="~@/assets/icons/icon-tabbar-profile-active.svg" 
            alt=""
          >
          <img 
            v-else
            class="w-6 h-6 transition-all"
            :class="inactiveIconCls"
            src="~@/assets/icons/icon-tabbar-profile.svg" 
            alt=""
          >
        </div>
        <!-- 未登录时显示「登录」，点击进入原有 Twitter 授权流程 -->
        <span class="hidden desk:inline text-h4 text-content">{{ accStore.getAccountInfo ? ($t('profile') || 'Profile') : ($t('login') || 'Log in') }}</span>
      </div>

      <!-- 7. About -->
      <router-link
        to="/about"
        class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/about') ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
      >
        <img 
          class="w-6 h-6 mr-0 desk:mr-3 transition-all"
          :class="isActive('/about') ? '' : inactiveIconCls"
          :style="isActive('/about') ? activeIconFilter : undefined"
          src="~@/assets/icons/icon-docs.svg" 
          alt=""
        >
        <span class="hidden desk:inline text-h4 text-content">{{ $t('about') || 'About' }}</span>
      </router-link>

      <!-- 8. More -->
      <el-popover 
        popper-class="c-select-popper" 
        ref="moreMenuRef"
        trigger="click" 
        width="200" 
        :teleported="true" 
        :persistent="false"
        placement="top-start"
        @show="moreMenuVisible = true"
        @hide="moreMenuVisible = false"
      >
        <template #reference>
          <div 
            class="flex items-center justify-center desk:justify-start px-0 desk:px-4 py-3 rounded-lg cursor-pointer transition-colors text-content"
            :class="moreMenuVisible ? 'bg-surface-2 font-semibold' : 'hover:bg-surface-2'"
          >
            <span class="text-h4 mr-0 desk:mr-3">⋯</span>
            <span class="hidden desk:inline text-h4">{{ $t('more') || 'More' }}</span>
          </div>
        </template>
        <template #default>
          <div class="p-2 flex flex-col gap-2">
            <!-- Docs -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-surface-2"
              @click="moreMenuRef.hide()"
              href="https://coincidence-labs.gitbook.io/tagai/" 
              target="_blank"
            >
              <img class="w-4" :class="inactiveIconCls" src="~@/assets/icons/icon-docs.svg" alt="">
              <span>{{ $t('docs') || 'Docs' }}</span>
            </a>
            
            <!-- Audit Report -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-surface-2"
              @click="moreMenuRef.hide()"
              href="https://scalebit.xyz/reports/TagAI-Audit-Report.pdf" 
              target="_blank"
            >
              <img class="w-4" :class="inactiveIconCls" src="~@/assets/icons/icon-warning.svg" alt="">
              <span>{{ $t('auditReport') || 'Audit Report' }}</span>
            </a>
            
            <!-- Twitter -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-surface-2"
              @click="moreMenuRef.hide()"
              href="https://x.com/tagaidao" 
              target="_blank"
            >
              <img class="w-4" :class="inactiveIconCls" src="~@/assets/icons/icon-link-x.svg" alt="">
              <span>{{ $t('Twitter') || 'Twitter' }}</span>
            </a>
            
            <!-- Telegram -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-surface-2"
              @click="moreMenuRef.hide()"
              href="https://t.me/tagaidotfun" 
              target="_blank"
            >
              <img class="w-4" :class="inactiveIconCls" src="~@/assets/icons/icon-link-tg.svg" alt="">
              <span>{{ $t('Telegram') || 'Telegram' }}</span>
            </a>
          </div>
        </template>
      </el-popover>
    </nav>

    <!-- 8. Create TagCoin 按钮（中间档显示圆形 + 图标） -->
    <div class="p-2 desk:p-4 flex justify-center">
      <button
        class="hidden desk:block w-full bg-gradient-primary text-white rounded-full py-3 px-4 font-bold text-h4 hover:opacity-90 transition-opacity"
        @click="createTagCoin"
      >
        {{ $t('createTagCoin') || 'Create TagCoin' }}
      </button>
      <button
        class="desk:hidden w-11 h-11 bg-gradient-primary text-white rounded-full text-2xl font-bold leading-none hover:opacity-90 transition-opacity"
        :title="$t('createTagCoin')"
        :aria-label="$t('createTagCoin')"
        @click="createTagCoin"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
</style>
