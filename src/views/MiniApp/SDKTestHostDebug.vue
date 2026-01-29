<template>
  <div class="sdk-test-host-debug">
    <h1>Debug Info for SDKTestHost</h1>

    <div class="debug-section">
      <h2>1. Account Store Data</h2>
      <pre>{{ JSON.stringify(account, null, 2) }}</pre>
    </div>

    <div class="debug-section">
      <h2>2. Computed Values</h2>
      <p>Has Twitter ID: {{ !!account?.twitterId }}</p>
      <p>Twitter Username: {{ account?.twitterUsername || 'N/A' }}</p>
      <p>Has ETH Address: {{ !!account?.ethAddr }}</p>
      <p>ETH Address: {{ account?.ethAddr || 'N/A' }}</p>
    </div>

    <div class="debug-section">
      <h2>3. Preview Status Boxes</h2>
      <div class="status-boxes-preview">
        <!-- Twitter 登录状态 -->
        <div class="status-box" :class="{ connected: account?.twitterId }">
          <span class="status-icon">🐦</span>
          <div class="status-info">
            <div class="status-label">Twitter</div>
            <div class="status-value">
              {{ account?.twitterId ? `@${account.twitterUsername || account.twitterId}` : '未登录' }}
            </div>
          </div>
        </div>

        <!-- Privy 钱包登录状态 -->
        <div class="status-box" :class="{ connected: account?.ethAddr }">
          <span class="status-icon">💳</span>
          <div class="status-info">
            <div class="status-label">Privy Wallet</div>
            <div class="status-value">
              {{ account?.ethAddr ? `${account.ethAddr.slice(0, 6)}...${account.ethAddr.slice(-4)}` : '未连接' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <h2>4. Navigation Test</h2>
      <button @click="goToActualPage" class="nav-button">
        Go to Actual SDK Test Host
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAccountStore } from '@/stores/web3';

const router = useRouter();
const accountStore = useAccountStore();
const account = computed(() => accountStore.getAccountInfo);

function goToActualPage() {
  router.push('/sdk-test-host');
}
</script>

<style scoped>
.sdk-test-host-debug {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  font-family: monospace;
}

h1 {
  color: #FE913F;
  border-bottom: 3px solid #FE913F;
  padding-bottom: 10px;
}

h2 {
  color: #666;
  font-size: 16px;
  margin-top: 20px;
}

.debug-section {
  background: #f5f5f5;
  padding: 15px;
  margin: 15px 0;
  border-radius: 8px;
  border-left: 4px solid #FE913F;
}

pre {
  background: #fff;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

.status-boxes-preview {
  display: flex;
  gap: 12px;
  padding: 15px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  border-radius: 8px;
}

.status-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
}

.status-box.connected {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
}

.status-icon {
  font-size: 20px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 10px;
  opacity: 0.9;
  font-weight: 500;
}

.status-value {
  font-size: 12px;
  font-weight: 600;
}

.nav-button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.nav-button:hover {
  transform: translateY(-2px);
}

p {
  margin: 5px 0;
  font-size: 14px;
}
</style>
