<template>
  <div class="sdk-test-container">
    <div class="test-card">
      <h1>🧪 TagAI Mini App SDK 完整测试</h1>
      <p class="subtitle">测试所有 SDK 功能模块</p>

      <div :class="['status', statusClass]">{{ statusText }}</div>

      <!-- Tab Navigation -->
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.icon }} {{ tab.name }}
        </button>
      </div>

      <!-- Context Tab -->
      <div v-if="activeTab === 'context'" class="tab-content">
        <div class="section">
          <div class="section-title">📋 上下文信息</div>
          <button @click="getContextInfo">获取上下文</button>
          <div v-if="contextInfo" class="info-box">
            <pre>{{ JSON.stringify(contextInfo, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Auth Tab -->
      <div v-if="activeTab === 'auth'" class="tab-content">
        <div class="section">
          <div class="section-title">🔐 认证模块</div>
          <div class="button-group">
            <button @click="testGetToken">获取 JWT Token</button>
            <button @click="testSignIn">Sign In (SIWE)</button>
          </div>
        </div>
      </div>

      <!-- Twitter Tab -->
      <div v-if="activeTab === 'twitter'" class="tab-content">
        <div class="section">
          <div class="section-title">🐦 Twitter 模块</div>
          <div class="button-group">
            <button @click="testTwitterIsConnected">检查 Twitter 连接</button>
            <button @click="testTwitterGetUser">获取 Twitter 用户信息</button>
            <button class="primary" @click="testTwitterPost">发布推文</button>
            <button class="secondary" @click="testTwitterShare">分享到 Twitter</button>
          </div>
        </div>
      </div>

      <!-- Steem Tab -->
      <div v-if="activeTab === 'steem'" class="tab-content">
        <div class="section">
          <div class="section-title">📝 Steem 模块</div>
          <div class="button-group">
            <button class="primary" @click="testSteemPost">发布 Steem 帖子</button>
            <button @click="testSteemVote">点赞帖子</button>
            <button @click="testSteemComment">评论帖子</button>
            <button @click="testSteemReblog">转发帖子</button>
          </div>
        </div>
      </div>

      <!-- Wallet Tab -->
      <div v-if="activeTab === 'wallet'" class="tab-content">
        <div class="section">
          <div class="section-title">💰 钱包模块</div>
          <div class="button-group">
            <button @click="testGetAddress">获取钱包地址</button>
            <button @click="testGetBalance">获取余额</button>
            <button @click="testSignMessage">签名消息</button>
          </div>
        </div>
      </div>

      <!-- DeFi Tab -->
      <div v-if="activeTab === 'defi'" class="tab-content">
        <div class="section">
          <div class="section-title">🔄 DeFi Actions</div>
          <div class="button-group">
            <button @click="testViewToken">查看 USDT</button>
            <button class="primary" @click="testSwapToken">交换 BNB → USDT</button>
            <button class="secondary" @click="testSendToken">发送 BNB</button>
          </div>
        </div>
      </div>

      <!-- Actions Tab -->
      <div v-if="activeTab === 'actions'" class="tab-content">
        <div class="section">
          <div class="section-title">⚡ 应用操作</div>
          <div class="button-group">
            <button @click="testCompose">打开发帖对话框</button>
            <button @click="testShare">分享内容</button>
            <button @click="testViewProfile">查看用户资料</button>
            <button @click="testSetPrimaryButton">设置主按钮</button>
            <button @click="testAddMiniApp">添加 Mini App</button>
            <button class="danger" @click="testClose">关闭 Mini App</button>
          </div>
        </div>
      </div>

      <!-- Haptics Tab -->
      <div v-if="activeTab === 'haptics'" class="tab-content">
        <div class="section">
          <div class="section-title">📳 触觉反馈</div>
          <div class="button-group">
            <button @click="testImpactLight">轻触 (Light)</button>
            <button @click="testImpactMedium">中等 (Medium)</button>
            <button @click="testImpactHeavy">重击 (Heavy)</button>
            <button class="success" @click="testNotificationSuccess">成功通知</button>
            <button class="warning" @click="testNotificationWarning">警告通知</button>
            <button class="danger" @click="testNotificationError">错误通知</button>
          </div>
        </div>
      </div>

      <!-- Platform Tab -->
      <div v-if="activeTab === 'platform'" class="tab-content">
        <div class="section">
          <div class="section-title">🖥️ 平台信息</div>
          <div class="button-group">
            <button @click="testGetCapabilities">获取能力列表</button>
            <button @click="testGetChains">获取支持的链</button>
            <button @click="testGetPlatformType">获取平台类型</button>
            <button @click="testGetVersion">获取 SDK 版本</button>
          </div>
        </div>
      </div>

      <!-- Notifications Tab -->
      <div v-if="activeTab === 'notifications'" class="tab-content">
        <div class="section">
          <div class="section-title">🔔 通知系统</div>
          <div class="button-group">
            <button @click="testNotificationsIsEnabled">检查通知状态</button>
            <button class="primary" @click="testNotificationsSubscribe">订阅通知</button>
            <button class="danger" @click="testNotificationsUnsubscribe">取消订阅</button>
            <button class="secondary" @click="testLocalNotification">显示本地通知</button>
          </div>
        </div>
      </div>

      <!-- Back Tab -->
      <div v-if="activeTab === 'back'" class="tab-content">
        <div class="section">
          <div class="section-title">⬅️ 返回导航</div>
          <div class="button-group">
            <button @click="testBackEnable">启用返回按钮</button>
            <button @click="testBackDisable">禁用返回按钮</button>
            <button @click="testBackGoBack">触发返回</button>
          </div>
        </div>
      </div>

      <!-- Log Section -->
      <div class="log-container">
        <div class="log-header">
          <span class="log-title">📝 执行日志</span>
          <button class="clear-btn" @click="logs = []">清空</button>
        </div>
        <div class="log-entries">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-entry', log.type]"
          >
            <span class="log-time">[{{ log.time }}]</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { sdk } from '@/sdk/miniapp-sdk/src/index';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const tabs = [
  { id: 'context', name: '上下文', icon: '📋' },
  { id: 'auth', name: '认证', icon: '🔐' },
  { id: 'twitter', name: 'Twitter', icon: '🐦' },
  { id: 'steem', name: 'Steem', icon: '📝' },
  { id: 'wallet', name: '钱包', icon: '💰' },
  { id: 'defi', name: 'DeFi', icon: '🔄' },
  { id: 'actions', name: '操作', icon: '⚡' },
  { id: 'haptics', name: '触觉', icon: '📳' },
  { id: 'platform', name: '平台', icon: '🖥️' },
  { id: 'notifications', name: '通知', icon: '🔔' },
  { id: 'back', name: '返回', icon: '⬅️' },
];

const activeTab = ref('context');
const statusText = ref('正在初始化 SDK...');
const statusClass = ref('loading');
const logs = ref<LogEntry[]>([]);
const contextInfo = ref<any>(null);

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const time = new Date().toLocaleTimeString('zh-CN');
  logs.value.unshift({ time, message, type });
  console.log(`[${time}] ${message}`);
}

onMounted(async () => {
  try {
    const inMiniApp = await sdk.isInMiniApp(2000);

    if (inMiniApp) {
      statusText.value = '✅ SDK 已就绪';
      statusClass.value = 'ready';
      log('✅ SDK 初始化成功', 'success');

      const context = await sdk.context;
      log(`用户: ${context.user.twitterUsername || 'Unknown'}`, 'success');

      await sdk.actions.ready();
    } else {
      statusText.value = '⚠️ 未在 Mini App 环境中（部分功能可用）';
      statusClass.value = 'warning';
      log('⚠️ 请在 TagAI Mini App Host 中打开此页面以获得完整功能', 'warning');
    }
  } catch (error: any) {
    statusText.value = '❌ 初始化失败';
    statusClass.value = 'error';
    log(`❌ SDK 初始化错误: ${error.message}`, 'error');
  }
});

// ==========================================
// Context Tests
// ==========================================
async function getContextInfo() {
  log('获取上下文信息...');
  try {
    const context = await sdk.context;
    contextInfo.value = context;
    log('✅ 获取上下文成功', 'success');
  } catch (error: any) {
    log(`❌ 获取上下文失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Auth Tests
// ==========================================
async function testGetToken() {
  log('获取 JWT Token...');
  try {
    const result = await sdk.auth.getToken();
    log(`✅ Token 获取成功，过期时间: ${new Date(result.expiresAt).toLocaleString()}`, 'success');
  } catch (error: any) {
    log(`❌ 获取 Token 失败: ${error.message}`, 'error');
  }
}

async function testSignIn() {
  log('触发 Sign In...');
  try {
    const result = await sdk.auth.signIn();
    log(`✅ 登录成功: ${result.ethAddress}`, 'success');
  } catch (error: any) {
    log(`❌ 登录失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Twitter Tests
// ==========================================
async function testTwitterIsConnected() {
  log('检查 Twitter 连接状态...');
  try {
    const connected = await sdk.twitter.isConnected();
    log(`${connected ? '✅' : '❌'} Twitter ${connected ? '已连接' : '未连接'}`, connected ? 'success' : 'warning');
  } catch (error: any) {
    log(`❌ 检查失败: ${error.message}`, 'error');
  }
}

async function testTwitterGetUser() {
  log('获取 Twitter 用户信息...');
  try {
    const user = await sdk.twitter.getUser();
    if (user) {
      log(`✅ 用户: @${user.username} (${user.displayName})`, 'success');
    } else {
      log('⚠️ 未找到 Twitter 用户信息', 'warning');
    }
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testTwitterPost() {
  log('发布推文...');
  try {
    const result = await sdk.twitter.post({
      text: 'Hello from TagAI Mini App SDK Test! 🚀 #TagAI #Web3',
    });
    log(`✅ 推文发布成功: ${result.url}`, 'success');
  } catch (error: any) {
    log(`❌ 发布失败: ${error.message}`, 'error');
  }
}

async function testTwitterShare() {
  log('打开 Twitter 分享...');
  try {
    await sdk.twitter.share({
      url: 'https://tagai.app',
      text: 'Check out TagAI!',
      hashtags: ['TagAI', 'Web3'],
    });
    log('✅ 分享对话框已打开', 'success');
  } catch (error: any) {
    log(`❌ 分享失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Steem Tests
// ==========================================
async function testSteemPost() {
  log('发布 Steem 帖子...');
  try {
    const result = await sdk.steem.post({
      title: 'SDK 测试帖子',
      body: '这是一个来自 TagAI Mini App SDK 的测试帖子。',
      tags: ['tagai', 'test', 'sdk'],
      crossPostTwitter: false,
    });
    log(`✅ 帖子发布成功: ${result.url}`, 'success');
  } catch (error: any) {
    log(`❌ 发布失败: ${error.message}`, 'error');
  }
}

async function testSteemVote() {
  log('点赞帖子...');
  try {
    await sdk.steem.vote('testauthor', 'test-permlink', 10000);
    log('✅ 点赞成功', 'success');
  } catch (error: any) {
    log(`❌ 点赞失败: ${error.message}`, 'error');
  }
}

async function testSteemComment() {
  log('评论帖子...');
  try {
    const result = await sdk.steem.comment({
      parentAuthor: 'testauthor',
      parentPermlink: 'test-permlink',
      body: '这是一条测试评论！',
    });
    log(`✅ 评论成功: ${result.permlink}`, 'success');
  } catch (error: any) {
    log(`❌ 评论失败: ${error.message}`, 'error');
  }
}

async function testSteemReblog() {
  log('转发帖子...');
  try {
    await sdk.steem.reblog('testauthor', 'test-permlink');
    log('✅ 转发成功', 'success');
  } catch (error: any) {
    log(`❌ 转发失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Wallet Tests
// ==========================================
async function testGetAddress() {
  log('获取钱包地址...');
  try {
    const address = await sdk.wallet.getAddress();
    log(`✅ 地址: ${address}`, 'success');
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testGetBalance() {
  log('获取余额...');
  try {
    const balance = await sdk.wallet.getBalance();
    log(`✅ 余额: ${balance.formatted} ${balance.symbol}`, 'success');
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testSignMessage() {
  log('签名消息...');
  try {
    const signature = await sdk.wallet.signMessage('Hello, TagAI SDK Test!');
    log(`✅ 签名: ${signature.slice(0, 20)}...`, 'success');
  } catch (error: any) {
    log(`❌ 签名失败: ${error.message}`, 'error');
  }
}

// ==========================================
// DeFi Tests
// ==========================================
async function testViewToken() {
  log('查看 USDT 代币...');
  try {
    await sdk.actions.viewToken({
      token: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
    });
    log('✅ viewToken 调用成功', 'success');
  } catch (error: any) {
    log(`❌ 查看失败: ${error.message}`, 'error');
  }
}

async function testSwapToken() {
  log('交换 BNB → USDT...');
  try {
    const result = await sdk.actions.swapToken({
      sellToken: 'eip155:56/native',
      buyToken: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '10000000000000000', // 0.01 BNB
    });
    if (result.success) {
      log(`✅ 交换成功! 交易数: ${result.swap.transactions.length}`, 'success');
    } else {
      log(`❌ 交换失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ 交换失败: ${error.message}`, 'error');
  }
}

async function testSendToken() {
  log('发送 BNB...');
  try {
    const result = await sdk.actions.sendToken({
      token: 'eip155:56/native',
      amount: '1000000000000000', // 0.001 BNB
      recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    });
    if (result.success) {
      log(`✅ 发送成功! 交易: ${result.send.transaction}`, 'success');
    } else {
      log(`❌ 发送失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ 发送失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Actions Tests
// ==========================================
async function testCompose() {
  log('打开发帖对话框...');
  try {
    const result = await sdk.actions.compose({
      text: '这是预填的内容',
      tags: ['tagai', 'test'],
    });
    log(`${result.posted ? '✅ 已发布' : '❌ 已取消'}`, result.posted ? 'success' : 'warning');
  } catch (error: any) {
    log(`❌ 操作失败: ${error.message}`, 'error');
  }
}

async function testShare() {
  log('分享内容...');
  try {
    await sdk.actions.share({
      url: 'https://tagai.app',
      text: 'Check out TagAI!',
    });
    log('✅ 分享对话框已打开', 'success');
  } catch (error: any) {
    log(`❌ 分享失败: ${error.message}`, 'error');
  }
}

async function testViewProfile() {
  log('查看用户资料...');
  try {
    await sdk.actions.viewProfile('tagai');
    log('✅ 已打开用户资料', 'success');
  } catch (error: any) {
    log(`❌ 操作失败: ${error.message}`, 'error');
  }
}

async function testSetPrimaryButton() {
  log('设置主按钮...');
  try {
    await sdk.actions.setPrimaryButton({
      text: '测试按钮',
      enabled: true,
      loading: false,
    });
    log('✅ 主按钮已设置', 'success');
  } catch (error: any) {
    log(`❌ 设置失败: ${error.message}`, 'error');
  }
}

async function testAddMiniApp() {
  log('添加 Mini App...');
  try {
    const result = await sdk.actions.addMiniApp();
    log(`${result.added ? '✅ 已添加' : '❌ 用户拒绝'}`, result.added ? 'success' : 'warning');
  } catch (error: any) {
    log(`❌ 添加失败: ${error.message}`, 'error');
  }
}

async function testClose() {
  log('关闭 Mini App...');
  try {
    await sdk.actions.close();
    log('✅ 已请求关闭', 'success');
  } catch (error: any) {
    log(`❌ 关闭失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Haptics Tests
// ==========================================
async function testImpactLight() {
  log('触发轻触反馈...');
  try {
    await sdk.haptics.impactOccurred('light');
    log('✅ 轻触反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

async function testImpactMedium() {
  log('触发中等反馈...');
  try {
    await sdk.haptics.impactOccurred('medium');
    log('✅ 中等反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

async function testImpactHeavy() {
  log('触发重击反馈...');
  try {
    await sdk.haptics.impactOccurred('heavy');
    log('✅ 重击反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

async function testNotificationSuccess() {
  log('触发成功通知反馈...');
  try {
    await sdk.haptics.notificationOccurred('success');
    log('✅ 成功反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

async function testNotificationWarning() {
  log('触发警告通知反馈...');
  try {
    await sdk.haptics.notificationOccurred('warning');
    log('✅ 警告反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

async function testNotificationError() {
  log('触发错误通知反馈...');
  try {
    await sdk.haptics.notificationOccurred('error');
    log('✅ 错误反馈已触发', 'success');
  } catch (error: any) {
    log(`❌ 触发失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Platform Tests
// ==========================================
async function testGetCapabilities() {
  log('获取能力列表...');
  try {
    const capabilities = await sdk.platform.getCapabilities();
    log(`✅ 支持 ${capabilities.length} 项能力`, 'success');
    console.log('Capabilities:', capabilities);
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testGetChains() {
  log('获取支持的链...');
  try {
    const chains = await sdk.platform.getChains();
    log(`✅ 支持的链: ${chains.join(', ')}`, 'success');
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

async function testGetPlatformType() {
  log('获取平台类型...');
  try {
    const type = await sdk.platform.getPlatformType();
    log(`✅ 平台类型: ${type}`, 'success');
  } catch (error: any) {
    log(`❌ 获取失败: ${error.message}`, 'error');
  }
}

function testGetVersion() {
  const version = sdk.platform.getVersion();
  log(`✅ SDK 版本: ${version}`, 'success');
}

// ==========================================
// Notifications Tests
// ==========================================
async function testNotificationsIsEnabled() {
  log('检查通知状态...');
  try {
    const enabled = await sdk.notifications.isEnabled();
    log(`${enabled ? '✅ 通知已启用' : '❌ 通知未启用'}`, enabled ? 'success' : 'warning');
  } catch (error: any) {
    log(`❌ 检查失败: ${error.message}`, 'error');
  }
}

async function testNotificationsSubscribe() {
  log('订阅通知...');
  try {
    const token = await sdk.notifications.subscribe();
    log(`✅ 订阅成功，Token: ${token.slice(0, 20)}...`, 'success');
  } catch (error: any) {
    log(`❌ 订阅失败: ${error.message}`, 'error');
  }
}

async function testNotificationsUnsubscribe() {
  log('取消订阅通知...');
  try {
    await sdk.notifications.unsubscribe();
    log('✅ 已取消订阅', 'success');
  } catch (error: any) {
    log(`❌ 取消失败: ${error.message}`, 'error');
  }
}

async function testLocalNotification() {
  log('显示本地通知...');
  try {
    const notification = await sdk.notifications.showLocalNotification(
      'TagAI SDK 测试',
      '这是一条本地测试通知！',
      {
        icon: '/pwa-192x192.png',
      }
    );
    if (notification) {
      log('✅ 本地通知已显示', 'success');
    } else {
      log('⚠️ 无法显示通知（可能权限未授予）', 'warning');
    }
  } catch (error: any) {
    log(`❌ 显示失败: ${error.message}`, 'error');
  }
}

// ==========================================
// Back Navigation Tests
// ==========================================
async function testBackEnable() {
  log('启用返回按钮...');
  try {
    await sdk.back.enable(() => {
      log('🔙 返回按钮被点击！', 'info');
    });
    log('✅ 返回按钮已启用', 'success');
  } catch (error: any) {
    log(`❌ 启用失败: ${error.message}`, 'error');
  }
}

async function testBackDisable() {
  log('禁用返回按钮...');
  try {
    await sdk.back.disable();
    log('✅ 返回按钮已禁用', 'success');
  } catch (error: any) {
    log(`❌ 禁用失败: ${error.message}`, 'error');
  }
}

async function testBackGoBack() {
  log('触发返回...');
  try {
    await sdk.back.goBack();
    log('✅ 返回已触发', 'success');
  } catch (error: any) {
    log(`❌ 返回失败: ${error.message}`, 'error');
  }
}
</script>

<style scoped>
.sdk-test-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  padding: 16px;
  overflow-y: auto;
}

.test-card {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

h1 {
  color: #333;
  margin-bottom: 4px;
  font-size: 18px;
  text-align: center;
}

.subtitle {
  color: #666;
  margin-bottom: 12px;
  font-size: 12px;
  text-align: center;
}

.status {
  display: block;
  text-align: center;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.status.loading {
  background: #fff3cd;
  color: #856404;
}

.status.ready {
  background: #d4edda;
  color: #155724;
}

.status.warning {
  background: #fff3cd;
  color: #856404;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 8px;
}

.tab {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  background: white;
  color: #666;
  transition: all 0.2s;
}

.tab:hover {
  background: #FE913F20;
}

.tab.active {
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
  color: white;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 2px solid #FE913F;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  flex: 1;
  min-width: 120px;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

button.primary {
  background: linear-gradient(135deg, #FE913F 0%, #FF6B3D 100%);
}

button.secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

button.success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

button.warning {
  background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);
}

button.danger {
  background: linear-gradient(135deg, #cb2d3e 0%, #ef473a 100%);
}

.info-box {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 11px;
  overflow-x: auto;
}

.info-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-container {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.clear-btn {
  padding: 4px 8px;
  font-size: 10px;
  background: #dc3545;
  min-width: auto;
  flex: none;
}

.log-entries {
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  padding: 6px 10px;
  margin-bottom: 4px;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
  border-left: 3px solid #667eea;
  display: flex;
  gap: 8px;
}

.log-time {
  color: #999;
  flex-shrink: 0;
}

.log-message {
  word-break: break-all;
}

.log-entry.error {
  border-left-color: #ef473a;
  background: #fff5f5;
}

.log-entry.success {
  border-left-color: #38ef7d;
  background: #f0fff5;
}

.log-entry.warning {
  border-left-color: #ffd200;
  background: #fffef0;
}
</style>
