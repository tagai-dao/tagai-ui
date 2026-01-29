<template>
  <div class="sdk-test-host-simple">
    <!-- 测试：这个导航栏应该可见 -->
    <div class="test-header">
      <h1>🔍 测试页面 - 如果你看到这个橙色导航栏，说明路由正常</h1>
      <p>当前路由: {{ $route.path }}</p>
      <p>组件: SDKTestHostSimple.vue</p>
    </div>

    <!-- 原始导航栏 -->
    <div class="host-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
      </button>
      <div class="header-title">
        <span class="title">SDK 功能测试</span>
        <span class="subtitle">TagAI Mini App SDK · 验证服务</span>
      </div>
      <div class="header-right">
        <!-- 登录状态框 -->
        <div class="status-boxes">
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

        <!-- 操作按钮 -->
        <div class="header-actions">
          <button class="action-btn">✓ 验证</button>
          <button class="action-btn">🔄</button>
        </div>
      </div>
    </div>

    <!-- iframe 内容区域（简化版） -->
    <div class="iframe-placeholder">
      <h2>iframe 内容区域</h2>
      <p>原本这里应该加载 MiniAppHost 组件</p>
      <iframe :src="appUrl" class="test-iframe"></iframe>
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
const appUrl = `${window.location.origin}/sdk-test`;

function goBack() {
  router.back();
}
</script>

<style scoped>
.sdk-test-host-simple {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

/* 测试导航栏 - 黄色背景 */
.test-header {
  background: #ffeb3b;
  padding: 20px;
  border-bottom: 3px solid #f44336;
  text-align: center;
  flex-shrink: 0;
}

.test-header h1 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.test-header p {
  margin: 5px 0 0;
  color: #666;
  font-size: 14px;
}

/* 原始导航栏样式 */
.host-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
  z-index: 100;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  margin-left: 12px;
}

.title {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  display: block;
  font-size: 11px;
  opacity: 0.8;
}

.header-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-left: 12px;
}

.status-boxes {
  display: flex;
  gap: 8px;
}

.status-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-box.connected {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
}

.status-icon {
  font-size: 16px;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 9px;
  opacity: 0.8;
  font-weight: 500;
}

.status-value {
  font-size: 11px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 12px;
  cursor: pointer;
}

/* iframe 区域 */
.iframe-placeholder {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
}

.test-iframe {
  flex: 1;
  border: 2px solid #ddd;
  border-radius: 8px;
  width: 100%;
}
</style>
