<template>
  <div class="social-host-wrapper">
    <!-- 右上角账号连接状态 -->
    <div
      class="account-status"
      :title="accountStatusTitle"
      @click="goProfile"
    >
      <span v-if="accountStore.getAccountInfo?.twitterId" class="status-dot connected"></span>
      <span v-else class="status-dot disconnected"></span>
      <span class="status-text">{{ accountStatusText }}</span>
    </div>

    <MiniAppHost
      :app-url="'/mainnet-social'"
      :fullscreen="false"
      @app-loaded="handleAppLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';
import { useAccountStore } from '@/stores/web3';
import { useModalStore } from '@/stores/common';
import { GlobalModalType } from '@/types';

const router = useRouter();
const accountStore = useAccountStore();
const modalStore = useModalStore();

const accountStatusText = computed(() => {
  const account = accountStore.getAccountInfo;
  if (account?.twitterId) {
    const username = account.twitterUsername || account.twitterId;
    const steemId = account.steemId ? ` · ${account.steemId}` : '';
    return `@${username}${steemId}`;
  }
  return '未登录';
});

const accountStatusTitle = computed(() => {
  const account = accountStore.getAccountInfo;
  if (account?.twitterId) {
    return `已登录 · Twitter: @${account.twitterUsername || account.twitterId}${account.steemId ? ' · Steem: ' + account.steemId : ''}`;
  }
  return '点击登录 Twitter 账号';
});

function goProfile() {
  if (accountStore.getAccountInfo?.twitterId) {
    router.push('/profile');
  } else {
    // Mini App 内登录：登录后留在当前 Mini App 页面
    localStorage.setItem('current-route', router.currentRoute.value.fullPath);
    modalStore.setModalVisible(true, GlobalModalType.Login);
  }
}

function handleAppLoaded() {
  console.log('[Social Host] ✅ Mini App loaded successfully');
}

onMounted(async () => {
  console.log('[Social Host] 🚀 Component mounted');
  console.log('[Social Host] Testing mode: Twitter & Steem Mainnet');

  // 检查是否已登录
  const account = accountStore.getAccountInfo;
  if (account?.twitterId) {
    console.log('[Social Host] ✅ User logged in:', {
      twitter: account.twitterUsername || account.twitterId,
      steem: account.steemId
    });
  } else {
    console.log('[Social Host] ⚠️ User not logged in');
  }
});
</script>

<style scoped>
.social-host-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

.account-status {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 10px;
  color: #374151;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.account-status:hover {
  background: #fff;
  border-color: #d1d5db;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected {
  background: #1d9bf0;
  box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.3);
}

.status-dot.disconnected {
  background: #94a3b8;
}

.status-text {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
