<template>
  <div class="sdk-test-host">
    <!-- Header -->
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
          <button class="action-btn" :class="{ active: showVerify }" @click="showVerify = !showVerify" title="验证服务">
            ✓ 验证
          </button>
          <button class="action-btn" @click="reloadIframe">🔄</button>
        </div>
      </div>
    </div>

    <!-- 验证服务面板 -->
    <div v-if="showVerify" class="verify-panel">
      <div class="verify-tabs">
        <button
          v-for="t in verifyTabs"
          :key="t.id"
          :class="['verify-tab', { active: verifyTab === t.id }]"
          @click="verifyTab = t.id"
        >
          {{ t.icon }} {{ t.name }}
        </button>
      </div>

      <!-- 1. 推送订阅流程 -->
      <div v-show="verifyTab === 'push'" class="verify-body">
        <div class="verify-section">
          <h4>1️⃣ 查看当前订阅</h4>
          <p class="hint">先确认当前用户是否有推送订阅记录。</p>
          <button class="btn primary" :disabled="!canCallApi" @click="fetchSubscriptions">
            {{ loading.subscriptions ? '请求中…' : '查看当前订阅' }}
          </button>
          <div v-if="result.subscriptions !== null" class="result-box" :class="result.subscriptions.error ? 'error' : 'ok'">
            <pre>{{ formatResult(result.subscriptions) }}</pre>
          </div>
        </div>
        <div class="verify-section">
          <h4>2️⃣ 在下方 Mini App 内完成订阅</h4>
          <p class="hint">切换到「通知」标签，点击「订阅通知」。完成后再次点击「查看当前订阅」确认。</p>
        </div>
      </div>

      <!-- 2. 通知发送与接收 -->
      <div v-show="verifyTab === 'send'" class="verify-body">
        <div class="verify-section">
          <h4>发送测试通知</h4>
          <p class="hint">向当前用户已订阅的端点发送一条测试推送；需先在「推送订阅」中完成订阅。</p>
          <button class="btn primary" :disabled="!canCallApi" @click="sendTestNotification">
            {{ loading.test ? '发送中…' : '发送测试通知' }}
          </button>
          <div v-if="result.test !== null" class="result-box" :class="result.test.error ? 'error' : 'ok'">
            <pre>{{ formatResult(result.test) }}</pre>
          </div>
        </div>
        <div class="verify-section">
          <h4>发送自定义通知</h4>
          <input v-model="customTitle" class="input" placeholder="标题" />
          <input v-model="customBody" class="input" placeholder="正文" />
          <button class="btn secondary" :disabled="!canCallApi" @click="sendCustomNotification">
            {{ loading.custom ? '发送中…' : '发送自定义通知' }}
          </button>
          <div v-if="result.custom !== null" class="result-box" :class="result.custom.error ? 'error' : 'ok'">
            <pre>{{ formatResult(result.custom) }}</pre>
          </div>
        </div>
      </div>

      <!-- 3. 速率限制 -->
      <div v-show="verifyTab === 'ratelimit'" class="verify-body">
        <div class="verify-section">
          <h4>速率限制测试</h4>
          <p class="hint">同一用户同一 type 每小时最多 10 条。连续发送 11 次，第 11 次应返回限流错误。</p>
          <button class="btn warning" :disabled="!canCallApi || loading.ratelimit" @click="runRateLimitTest">
            {{ loading.ratelimit ? `发送中 ${rateLimitCount }/11…` : '连续发送 11 次' }}
          </button>
          <div v-if="result.ratelimit.length" class="result-box">
            <pre>{{ result.ratelimit.map((r, i) => `#${i + 1}: ${r.error ? '限流/错误' : '成功'}`).join('\n') }}</pre>
          </div>
        </div>
      </div>

      <!-- 4. Twitter 删除 -->
      <div v-show="verifyTab === 'twitter'" class="verify-body">
        <div class="verify-section">
          <h4>Twitter 删除推文</h4>
          <p class="hint">仅能删除当前登录用户自己发布的推文；需填写真实 tweetId。</p>
          <input v-model="deleteTweetId" class="input" placeholder="推文 ID (tweetId)" />
          <button class="btn danger" :disabled="!canCallApi || !deleteTweetId.trim()" @click="deleteTweet">
            {{ loading.deleteTweet ? '删除中…' : '删除推文' }}
          </button>
          <div v-if="result.deleteTweet !== null" class="result-box" :class="result.deleteTweet.error ? 'error' : 'ok'">
            <pre>{{ formatResult(result.deleteTweet) }}</pre>
          </div>
        </div>
      </div>

      <!-- 5. 浏览器兼容性 -->
      <div v-show="verifyTab === 'compat'" class="verify-body">
        <div class="verify-section">
          <h4>浏览器兼容性</h4>
          <p class="hint">检查当前环境是否支持 Web Push 与通知能力。</p>
          <button class="btn secondary" @click="runCompatCheck">重新检测</button>
          <div v-if="compatResult" class="result-box ok">
            <pre>{{ compatResult }}</pre>
          </div>
        </div>
      </div>

      <div class="verify-footer">
        <span v-if="!account?.twitterId" class="warn">请先登录以使用需鉴权的接口</span>
        <span v-else class="muted">当前用户: {{ account.twitterId }}</span>
      </div>
    </div>

    <!-- Mini App Host -->
    <div class="host-content">
      <MiniAppHost
        v-if="showHost"
        :app-url="appUrl"
        :app-domain="appDomain"
        :fullscreen="false"
        @close="handleClose"
        @error="handleError"
      />
    </div>

    <div v-if="primaryButton.visible" class="primary-button-container">
      <button
        class="primary-button"
        :disabled="primaryButton.disabled || primaryButton.loading"
        @click="handlePrimaryButtonClick"
      >
        <span v-if="primaryButton.loading" class="loading-spinner"></span>
        {{ primaryButton.text }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MiniAppHost from '@/components/MiniApp/MiniAppHost.vue';
import { useAccountStore } from '@/stores/web3';
import { get, post } from '@/apis/axios';
import { deleteTweet as apiDeleteTweet } from '@/apis/api';
import { BACKEND_API_URL } from '@/config';

const router = useRouter();
const accountStore = useAccountStore();

const API_NOTIFY = `${BACKEND_API_URL}/api/notifications`;

const showVerify = ref(true);
const verifyTab = ref('push');
const verifyTabs = [
  { id: 'push', name: '推送订阅', icon: '🔔' },
  { id: 'send', name: '通知发送', icon: '📤' },
  { id: 'ratelimit', name: '速率限制', icon: '⏱️' },
  { id: 'twitter', name: 'Twitter 删除', icon: '🐦' },
  { id: 'compat', name: '浏览器兼容', icon: '🌐' },
];

const account = computed(() => accountStore.getAccountInfo);
const canCallApi = computed(() => !!account.value?.twitterId && !!account.value?.accessToken);

const loading = ref({
  subscriptions: false,
  test: false,
  custom: false,
  ratelimit: false,
  deleteTweet: false,
});
const rateLimitCount = ref(0);

const result = ref<{
  subscriptions: any;
  test: any;
  custom: any;
  ratelimit: Array<{ error?: boolean; message?: string }>;
  deleteTweet: any;
}>({
  subscriptions: null,
  test: null,
  custom: null,
  ratelimit: [],
  deleteTweet: null,
});

const customTitle = ref('TagAI 验证');
const customBody = ref('这是一条自定义推送测试');
const deleteTweetId = ref('');
const compatResult = ref('');

const appUrl = ref(`${window.location.origin}/sdk-test`);
const appDomain = ref(window.location.hostname);
const showHost = ref(true);
const primaryButton = ref({
  visible: false,
  text: '',
  disabled: false,
  loading: false,
});

function formatResult(obj: any): string {
  if (obj == null) return '';
  if (obj.error) return typeof obj.message === 'string' ? obj.message : JSON.stringify(obj, null, 2);
  return typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
}

async function fetchSubscriptions() {
  if (!account.value?.twitterId) return;
  loading.value.subscriptions = true;
  result.value.subscriptions = null;
  try {
    const data = await get(`${API_NOTIFY}/subscriptions`, { twitterId: account.value.twitterId });
    result.value.subscriptions = data;
  } catch (e: any) {
    result.value.subscriptions = { error: true, message: e?.message || e?.data?.message || String(e) };
  } finally {
    loading.value.subscriptions = false;
  }
}

async function sendTestNotification() {
  if (!account.value?.twitterId) return;
  loading.value.test = true;
  result.value.test = null;
  try {
    const data = await post(`${API_NOTIFY}/test`, {
      twitterId: account.value.twitterId,
      message: 'TagAI 验证服务 · 测试推送',
    });
    result.value.test = data;
  } catch (e: any) {
    result.value.test = { error: true, message: e?.message || e?.data?.message || String(e) };
  } finally {
    loading.value.test = false;
  }
}

async function sendCustomNotification() {
  if (!account.value?.twitterId) return;
  loading.value.custom = true;
  result.value.custom = null;
  try {
    const data = await post(`${API_NOTIFY}/send`, {
      twitterId: account.value.twitterId,
      notification: {
        type: 'custom',
        title: customTitle.value || 'TagAI',
        body: customBody.value || '自定义通知',
        data: { url: '/sdk-test-host', ts: Date.now() },
      },
    });
    result.value.custom = data;
  } catch (e: any) {
    result.value.custom = { error: true, message: e?.message || e?.data?.message || String(e) };
  } finally {
    loading.value.custom = false;
  }
}

async function runRateLimitTest() {
  if (!account.value?.twitterId) return;
  loading.value.ratelimit = true;
  result.value.ratelimit = [];
  rateLimitCount.value = 0;
  for (let i = 0; i < 11; i++) {
    rateLimitCount.value = i + 1;
    try {
      await post(`${API_NOTIFY}/send`, {
        twitterId: account.value.twitterId,
        notification: {
          type: 'custom',
          title: `限流测试 #${i + 1}`,
          body: `Rate limit test ${i + 1}/11`,
        },
      });
      result.value.ratelimit.push({ error: false });
    } catch (e: any) {
      result.value.ratelimit.push({
        error: true,
        message: e?.message || e?.data?.message || String(e),
      });
    }
  }
  loading.value.ratelimit = false;
}

async function deleteTweet() {
  const tid = deleteTweetId.value.trim();
  if (!tid || !account.value?.twitterId) return;
  loading.value.deleteTweet = true;
  result.value.deleteTweet = null;
  try {
    await apiDeleteTweet(tid, account.value.twitterId);
    result.value.deleteTweet = { success: true, message: '推文已删除' };
  } catch (e: any) {
    result.value.deleteTweet = {
      error: true,
      message: e?.message || e?.data?.message || e?.status || String(e),
    };
  } finally {
    loading.value.deleteTweet = false;
  }
}

function runCompatCheck() {
  const sw = 'serviceWorker' in navigator;
  const push = sw && 'PushManager' in window;
  const notif = 'Notification' in window;
  const perm = notif ? Notification.permission : 'unknown';
  compatResult.value = [
    `Service Worker: ${sw ? '✅' : '❌'}`,
    `PushManager: ${push ? '✅' : '❌'}`,
    `Notification: ${notif ? '✅' : '❌'}`,
    `Notification.permission: ${perm}`,
    `HTTPS/localhost: ${location.protocol === 'https:' || location.hostname === 'localhost' ? '✅' : '❌'}`,
    `UserAgent: ${navigator.userAgent.slice(0, 60)}...`,
  ].join('\n');
}

onMounted(() => {
  runCompatCheck();
});

function goBack() {
  router.back();
}

function reloadIframe() {
  showHost.value = false;
  setTimeout(() => {
    showHost.value = true;
  }, 100);
}

function handleClose() {
  router.back();
}

function handleError(error: Error) {
  console.error('[SDKTestHost] Mini App error:', error);
}

function handlePrimaryButtonClick() {
  // Mini App 主按钮
}
</script>

<style scoped>
.sdk-test-host {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
  overflow: hidden;
}

.host-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
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
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
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

/* 登录状态框 */
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
  transition: all 0.2s;
}

.status-box.connected {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
}

.status-icon {
  font-size: 16px;
  line-height: 1;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label {
  font-size: 9px;
  opacity: 0.8;
  line-height: 1;
  font-weight: 500;
}

.status-value {
  font-size: 11px;
  line-height: 1;
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
  transition: background 0.2s;
}

.action-btn:hover,
.action-btn.active {
  background: rgba(255, 255, 255, 0.35);
}

.action-btn:last-of-type {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 验证面板 */
.verify-panel {
  background: #fff;
  border-bottom: 1px solid #eee;
  max-height: 42vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 9;
  flex-shrink: 0;
}

.verify-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.verify-tab {
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  background: #eee;
  font-size: 12px;
  cursor: pointer;
}

.verify-tab.active {
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
}

.verify-body {
  overflow-y: auto;
  padding: 12px;
  flex: 1;
}

.verify-section {
  margin-bottom: 16px;
}

.verify-section h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: #333;
}

.hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: #666;
}

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  margin-bottom: 6px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
}

.btn.secondary {
  background: #e0e0e0;
  color: #333;
}

.btn.warning {
  background: #ff9800;
  color: white;
}

.btn.danger {
  background: #f44336;
  color: white;
}

.input {
  display: block;
  width: 100%;
  max-width: 320px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 12px;
}

.result-box {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  font-size: 11px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-box.ok {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
}

.result-box.error {
  background: #ffebee;
  border: 1px solid #ffcdd2;
}

.result-box pre {
  margin: 0;
}

.verify-footer {
  padding: 6px 12px;
  font-size: 11px;
  color: #999;
  border-top: 1px solid #eee;
}

.verify-footer .warn {
  color: #f57c00;
}

.verify-footer .muted {
  color: #999;
}

.host-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 强制覆盖 MiniAppHost 的样式 - 防止其占据整个视口 */
.sdk-test-host :deep(.miniapp-host) {
  position: static !important;
  min-height: auto !important;
  height: 100% !important;
  width: 100% !important;
  max-height: 100% !important;
}

.sdk-test-host :deep(.miniapp-host.fullscreen) {
  position: static !important;
}

.sdk-test-host :deep(.miniapp-iframe) {
  position: static !important;
  min-height: auto !important;
  height: 100% !important;
  width: 100% !important;
}

.primary-button-container {
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #eee;
}

.primary-button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(254, 145, 63, 0.4);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .host-header {
    flex-wrap: wrap;
  }

  .header-right {
    width: 100%;
    margin-left: 0;
    margin-top: 8px;
    justify-content: space-between;
  }

  .status-boxes {
    flex: 1;
    gap: 6px;
  }

  .status-box {
    padding: 4px 8px;
    gap: 6px;
  }

  .status-icon {
    font-size: 14px;
  }

  .status-label {
    font-size: 8px;
  }

  .status-value {
    font-size: 10px;
  }

  .header-actions {
    gap: 6px;
  }

  .action-btn {
    padding: 6px 10px;
    font-size: 11px;
  }
}
</style>
