<template>
  <div class="mainnet-host-wrapper">
    <!-- 右上角账号连接状态 -->
    <div
      class="account-status"
      :title="accountStatusTitle"
      @click="goWallet"
    >
      <span v-if="accountStore.ethConnectAddress" class="status-dot connected"></span>
      <span v-else class="status-dot disconnected"></span>
      <span class="status-text">{{ accountStatusText }}</span>
    </div>

    <MiniAppHost
      :app-url="'/mainnet-defi'"
      :fullscreen="false"
      @app-loaded="handleAppLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';
import { useAccountStore, EthWalletState } from '@/stores/web3';
import { usePrivyStore } from '@/stores/privy';
import { useModalStore } from '@/stores/common';
import { GlobalModalType } from '@/types';
import { getChainName } from '@/utils/privy';
import { useAccount } from '@/composables/useAccount';
import { isAddress } from 'viem';

const router = useRouter();
const accountStore = useAccountStore();
const privyStore = usePrivyStore();
const modalStore = useModalStore();

const accountStatusText = computed(() => {
  const addr = accountStore.ethConnectAddress;
  if (addr) {
    const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const chain = getChainName(privyStore.getChainId());
    return `${short} · ${chain}`;
  }
  return '未连接';
});

const accountStatusTitle = computed(() => {
  const addr = accountStore.ethConnectAddress;
  if (addr) {
    return `已连接 · ${addr} · ${getChainName(privyStore.getChainId())}`;
  }
  return '点击打开 Twitter 授权登录';
});

function goWallet() {
  if (accountStore.ethConnectAddress) {
    router.push('/wallet');
  } else {
    // Mini App 内登录：保存当前路由，登录成功后返回此页面
    localStorage.setItem('current-route', router.currentRoute.value.fullPath);
    modalStore.setModalVisible(true, GlobalModalType.Login);
  }
}

function handleAppLoaded() {
  console.log('[Mainnet Host] Mini App loaded successfully');
}

onMounted(async () => {
  console.log('[Mainnet Host] Mounted - BSC Mainnet Testing Mode');

  // 检查是否已登录但钱包未连接
  const isLoggedIn = accountStore.getAccountInfo?.twitterId;
  const isWalletConnected = accountStore.ethConnectAddress;

  if (isLoggedIn && !isWalletConnected) {
    console.log('[Mainnet Host] User logged in, waiting for wallet provider...');

    // 等待 ethersProvider 初始化（最多等待 5 秒）
    let retries = 0;
    const maxRetries = 50; // 50 * 100ms = 5 seconds

    while (!privyStore.ethersProvider && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (privyStore.ethersProvider) {
      console.log('[Mainnet Host] Wallet provider ready, initializing wallet...');
      try {
        // 如果用户已经绑定了地址，直接使用绑定的地址
        if (accountStore.getAccountInfo.ethAddr && isAddress(accountStore.getAccountInfo.ethAddr)) {
          console.log('[Mainnet Host] Using bonded address:', accountStore.getAccountInfo.ethAddr);
          accountStore.ethConnectAddress = accountStore.getAccountInfo.ethAddr;
          accountStore.ethConnectState = EthWalletState.Connected;
          accountStore.ethWalletType = accountStore.getAccountInfo.walletType === 1 ? 'privy' : 'metamask';

          // 初始化 viem wallet client（用于后续交易）
          const { createWalletClient, custom } = await import('viem');
          const { customBsc } = await import('@/utils/privy');
          privyStore.viemWalletClient = createWalletClient({
            chain: customBsc,
            transport: custom(privyStore.ethersProvider)
          });
        } else {
          // 没有绑定地址，需要初始化和绑定
          console.log('[Mainnet Host] No bonded address, initializing wallet...');
          await privyStore.initWallet();
          console.log('[Mainnet Host] Wallet initialized:', accountStore.ethConnectAddress);
        }
      } catch (error) {
        console.error('[Mainnet Host] Failed to initialize wallet:', error);
      }
    } else {
      console.warn('[Mainnet Host] Wallet provider not available after timeout');
    }
  }
});
</script>

<style scoped>
.mainnet-host-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

.account-status {
  position: absolute;
  right: 12px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.account-status:hover {
  background: #fff;
  border-color: #d1d5db;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected {
  background: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

.status-dot.disconnected {
  background: #94a3b8;
}

.status-text {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
