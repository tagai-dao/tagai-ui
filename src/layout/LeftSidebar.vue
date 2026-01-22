<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccountStore } from '@/stores/web3'
import { useModalStore, useStateStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { useLoginStore, LoginStepType } from '@/stores/login'

const router = useRouter()
const route = useRoute()
const accStore = useAccountStore()
const modalStore = useModalStore()
const stateStore = useStateStore()
const loginStore = useLoginStore()

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

// 判断 Coin 是否激活（仅在 tag-detail 或 buy-sell 路由，或明确选择了 Coin 子菜单时）
const isCoinActive = computed(() => {
  // 如果不在首页，检查是否是 tag-detail 或 buy-sell 路由
  if (!isActive('/')) {
    return isActive(['/tag-detail', '/buy-sell'])
  }
  // 在首页时，只有当 activeTab 是 tagCoin 或 ip 时才激活 Coin
  return stateStore.activeHomeTab === 'tagCoin' || stateStore.activeHomeTab === 'ip'
})

// 判断 Home 是否激活（在首页且 activeTab 是 tweets 或 prediction，且 Coin 未激活）
const isHomeActive = computed(() => {
  if (!isActive('/')) {
    return false
  }
  // 如果 Coin 激活了，Home 不激活
  if (isCoinActive.value) {
    return false
  }
  // 在首页时，只有当 activeTab 是 tweets 或 prediction 时才激活 Home
  const activeTab = stateStore.activeHomeTab
  return activeTab === 'tweets' || activeTab === 'prediction'
})

// 导航到首页
const goToHome = () => {
  router.push('/')
  // 确保切换到 tweets，这样 Home 会激活
  stateStore.setActiveHomeTab('tweets')
}

// 导航到 Coin
const goToCoin = () => {
  router.push('/')
  // 如果 coinSubMenu 还没有值，默认设置为 tagCoin
  if (!coinSubMenu.value || coinSubMenu.value === 'tagCoin') {
    stateStore.setActiveHomeTab('tagCoin')
  } else {
    stateStore.setActiveHomeTab('ip')
  }
}

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
  <div class="hidden web:flex flex-col h-full w-[260px] border-r border-gray-200 bg-white">
    <!-- Logo -->
    <div class="h-16 flex items-center px-4">
      <img 
        class="h-8 cursor-pointer" 
        src="~@/assets/logo.png" 
        alt="TagAI"
        @click="router.push('/')"
      >
    </div>

    <!-- 菜单项 -->
    <nav class="flex-1 px-2 py-4 space-y-1">
      <!-- 1. 首页 -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isHomeActive ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="goToHome"
      >
        <img 
          v-if="isHomeActive" 
          class="w-6 h-6 mr-3 transition-all" 
          src="~@/assets/icons/icon-tabbar-home-active.svg" 
          alt=""
        >
        <img 
          v-else 
          class="w-6 h-6 mr-3 transition-all" 
          src="~@/assets/icons/icon-tabbar-home.svg" 
          alt=""
        >
        <span class="text-h4 text-black">{{ $t('home') || 'Home' }}</span>
      </div>

      <!-- 2. Coin -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isCoinActive ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="goToCoin"
      >
        <img 
          class="w-6 h-6 mr-3 transition-all"
          :style="isCoinActive ? { filter: 'brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)' } : ''"
          src="~@/assets/icons/icon-coin.svg" 
          alt="Coin"
        >
        <span class="text-h4 text-black">{{ $t('coin') || 'Coin' }}</span>
      </div>

      <!-- 3. MindShare -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/mindshare') ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="router.push('/mindshare')"
      >
        <img 
          class="w-6 h-6 mr-3 transition-all"
          :style="isActive('/mindshare') ? { filter: 'brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)' } : ''"
          src="~@/assets/icons/icon-mindshare.svg" 
          alt=""
        >
        <span class="text-h4 text-black">{{ $t('mindshare') || 'MindShare' }}</span>
      </div>

      <!-- 4. 通知 -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2 relative"
        :class="isActive('/notification') ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="router.push('/notification')"
      >
        <div class="relative">
          <img 
            class="w-6 h-6 mr-3 transition-all"
            :style="isActive('/notification') ? { filter: 'brightness(0) saturate(100%) invert(58%) sepia(95%) saturate(2000%) hue-rotate(0deg) brightness(1.1) contrast(1.1)' } : ''"
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
        <span class="text-h4 text-black">{{ $t('notification') || 'Notification' }}</span>
      </div>

      <!-- 5. 钱包 -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/wallet') ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="handleWalletClick"
      >
        <img 
          v-if="isActive('/wallet')" 
          class="w-6 h-6 mr-3 transition-all" 
          src="~@/assets/icons/icon-tabbar-wallet-active.svg" 
          alt=""
        >
        <img 
          v-else 
          class="w-6 h-6 mr-3 transition-all" 
          src="~@/assets/icons/icon-wallet.svg" 
          alt=""
        >
        <span class="text-h4 text-black">{{ $t('wallet') || 'Wallet' }}</span>
      </div>

      <!-- 6. 我的主页 -->
      <div 
        class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors mb-2"
        :class="isActive('/profile') ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
        @click="handleProfileClick"
      >
        <div class="w-6 h-6 mr-3 flex items-center justify-center">
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
            src="~@/assets/icons/icon-tabbar-profile.svg" 
            alt=""
          >
        </div>
        <span class="text-h4 text-black">{{ $t('profile') || 'Profile' }}</span>
      </div>

      <!-- 7. More -->
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
            class="flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors"
            :class="moreMenuVisible ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'"
          >
            <span class="text-h4 mr-3">⋯</span>
            <span class="text-h4">{{ $t('more') || 'More' }}</span>
          </div>
        </template>
        <template #default>
          <div class="p-2 flex flex-col gap-2">
            <!-- Docs -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-gray-50"
              @click="moreMenuRef.hide()"
              href="https://coincidence-labs.gitbook.io/tagai/" 
              target="_blank"
            >
              <img class="w-4" src="~@/assets/icons/icon-docs.svg" alt="">
              <span>{{ $t('docs') || 'Docs' }}</span>
            </a>
            
            <!-- Audit Report -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-gray-50"
              @click="moreMenuRef.hide()"
              href="https://scalebit.xyz/reports/TagAI-Audit-Report.pdf" 
              target="_blank"
            >
              <img class="w-4" src="~@/assets/icons/icon-warning.svg" alt="">
              <span>{{ $t('auditReport') || 'Audit Report' }}</span>
            </a>
            
            <!-- Twitter -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-gray-50"
              @click="moreMenuRef.hide()"
              href="https://x.com/tagaidao" 
              target="_blank"
            >
              <img class="w-4" src="~@/assets/icons/icon-link-x.svg" alt="">
              <span>{{ $t('Twitter') || 'Twitter' }}</span>
            </a>
            
            <!-- Telegram -->
            <a 
              class="flex gap-2 items-center cursor-pointer px-3 py-2 rounded hover:bg-gray-50"
              @click="moreMenuRef.hide()"
              href="https://t.me/tagaidotfun" 
              target="_blank"
            >
              <img class="w-4" src="~@/assets/icons/icon-link-tg.svg" alt="">
              <span>{{ $t('Telegram') || 'Telegram' }}</span>
            </a>
          </div>
        </template>
      </el-popover>
    </nav>

    <!-- 8. Create TagCoin 按钮 -->
    <div class="p-4">
      <button 
        class="w-full bg-gradient-primary text-white rounded-full py-3 px-4 font-bold text-h4 hover:opacity-90 transition-opacity"
        @click="createTagCoin"
      >
        {{ $t('createTagCoin') || 'Create TagCoin' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
