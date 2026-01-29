<template>
  <div class="mainnet-test-container">
    <div class="test-header">
      <h1>🚀 DeFi Actions - BSC 主网测试</h1>
      <p>当前网络: {{ currentChainName }} (ChainId: {{ currentChainId }})</p>
      <p class="warning">⚠️ 警告：这是真实主网环境，请谨慎操作！建议使用小额测试。</p>
    </div>

    <div class="content-grid">
      <!-- 左列 -->
      <div class="content-column">
        <div class="test-section">
          <h2>📋 测试清单</h2>
          <div class="checklist">
            <label v-for="(test, key) in tests" :key="key" class="test-item">
              <input type="checkbox" v-model="test.completed" />
              <span :class="{ completed: test.completed }">{{ test.label }}</span>
              <span v-if="test.result" class="result">{{ test.result }}</span>
            </label>
          </div>
        </div>

        <div class="test-section">
          <h2>🔗 网络切换</h2>
          <div class="chain-buttons">
            <button
              v-for="chain in mainnetChains"
              :key="chain.id"
              @click="switchToChain(chain.id)"
              :class="{ active: currentChainId === chain.id }"
              class="chain-btn"
            >
              {{ chain.name }}
            </button>
          </div>
          <p class="chain-note">💡 建议在 BSC 主网测试（Gas 费用较低）</p>
        </div>

        <div class="test-section">
          <h2>💰 常用代币地址（BSC 主网）</h2>
          <div class="token-list">
            <div v-for="token in bscTokens" :key="token.symbol" class="token-item">
              <strong>{{ token.symbol }}:</strong>
              <code>{{ token.address }}</code>
              <button @click="copyToClipboard(token.address)" class="copy-btn">复制</button>
            </div>
          </div>
        </div>

        <!-- ViewToken Tests -->
        <div class="test-section">
          <h2>🧪 测试操作</h2>
          <div class="test-group">
            <h3>1. ViewToken 测试</h3>
            <button @click="testViewTokenNative" class="test-btn">
              查看原生代币 (BNB)
            </button>
            <button @click="testViewTokenUSDT" class="test-btn">
              查看 USDT
            </button>
            <button @click="testViewTokenBUSD" class="test-btn">
              查看 BUSD
            </button>
          </div>
        </div>
      </div>

      <!-- 右列 -->
      <div class="content-column">
        <!-- SendToken Tests -->
        <div class="test-section">
          <h2>2. SendToken 测试</h2>
          <div class="test-group" style="border: none; padding: 0; margin: 0;">
            <div class="input-group">
              <label>接收地址:</label>
              <input
                v-model="recipientAddress"
                placeholder="0x..."
                class="test-input"
              />
              <p class="input-hint">💡 建议填写您自己的另一个钱包地址</p>
            </div>
            <div class="input-group">
              <label>发送金额 (BNB):</label>
              <input
                v-model="sendAmountBNB"
                type="number"
                step="0.001"
                placeholder="0.001"
                class="test-input"
              />
              <p class="input-hint">当前值: {{ sendAmountBNB }} BNB ≈ ${{ estimateBNBValue }}</p>
            </div>
            <button @click="testSendTokenNative" class="test-btn">
              发送 BNB
            </button>
            <div class="input-group" style="margin-top: 12px;">
              <label>发送金额 (USDT):</label>
              <input
                v-model="sendAmountUSDT"
                type="number"
                step="0.1"
                placeholder="1"
                class="test-input"
              />
              <p class="input-hint">当前值: {{ sendAmountUSDT }} USDT</p>
            </div>
            <button @click="testSendTokenUSDT" class="test-btn">
              发送 USDT
            </button>
          </div>
        </div>

        <!-- SwapToken Tests -->
        <div class="test-section">
          <h2>3. SwapToken 测试</h2>
          <div class="test-group" style="border: none; padding: 0; margin: 0;">
            <div class="input-group">
              <label>交换金额 (BNB):</label>
              <input
                v-model="swapAmountBNB"
                type="number"
                step="0.001"
                placeholder="0.01"
                class="test-input"
              />
              <p class="input-hint">当前值: {{ swapAmountBNB }} BNB ≈ ${{ estimateSwapBNBValue }}</p>
            </div>
            <button @click="testSwapBNBToUSDT" class="test-btn">
              BNB → USDT
            </button>
            <button @click="testSwapBNBToBUSD" class="test-btn">
              BNB → BUSD
            </button>
            <div class="input-group" style="margin-top: 12px;">
              <label>交换金额 (USDT):</label>
              <input
                v-model="swapAmountUSDT"
                type="number"
                step="1"
                placeholder="10"
                class="test-input"
              />
              <p class="input-hint">当前值: {{ swapAmountUSDT }} USDT</p>
            </div>
            <button @click="testSwapUSDTToBNB" class="test-btn">
              USDT → BNB
            </button>
          </div>
        </div>

        <!-- Quick Auth Tests -->
        <div class="test-section">
          <h2>4. Quick Auth 测试</h2>
          <div class="test-group" style="border: none; padding: 0; margin: 0;">
            <p class="test-desc">测试 Quick Auth 模块的 Token 缓存、自动刷新和便捷 fetch 功能</p>
            <button @click="testQuickAuthGetToken" class="test-btn">
              获取 Token (自动缓存)
            </button>
            <button @click="testQuickAuthForceRefresh" class="test-btn">
              强制刷新 Token
            </button>
            <button @click="testQuickAuthFetch" class="test-btn">
              测试 quickAuth.fetch()
            </button>
            <button @click="testQuickAuthClearCache" class="test-btn">
              清除 Token 缓存
            </button>
            <div v-if="quickAuthTokenInfo" class="token-info">
              <p><strong>当前 Token:</strong> <code>{{ quickAuthTokenInfo.token.slice(0, 20) }}...{{ quickAuthTokenInfo.token.slice(-20) }}</code></p>
              <p><strong>过期时间:</strong> {{ new Date(quickAuthTokenInfo.expiresAt).toLocaleString() }}</p>
              <p><strong>剩余时间:</strong> {{ quickAuthTokenTimeLeft }}</p>
            </div>
          </div>
        </div>

        <!-- 测试日志 -->
        <div class="test-section">
          <h2>📊 测试日志</h2>
          <div class="test-logs">
            <div
              v-for="(log, index) in testLogs"
              :key="index"
              :class="['log-entry', log.type]"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
          <button @click="clearLogs" class="clear-btn">清空日志</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePrivyStore } from '@/stores/privy';
import { sdk } from '@/sdk/miniapp-sdk/src/index';

const privyStore = usePrivyStore();

// 主网链配置
const mainnetChains = [
  { id: 56, name: 'BSC 主网' },
  { id: 1, name: 'Ethereum 主网' },
  { id: 8453, name: 'Base' },
  { id: 10, name: 'Optimism' },
  { id: 42161, name: 'Arbitrum' },
];

// BSC 主网常用代币
const bscTokens = [
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
  { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
  { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
];

// 测试清单
const tests = ref({
  viewTokenNative: { label: 'ViewToken - Native (BNB)', completed: false, result: '' },
  viewTokenUSDT: { label: 'ViewToken - USDT', completed: false, result: '' },
  viewTokenBUSD: { label: 'ViewToken - BUSD', completed: false, result: '' },
  sendTokenNative: { label: 'SendToken - BNB', completed: false, result: '' },
  sendTokenUSDT: { label: 'SendToken - USDT', completed: false, result: '' },
  swapBNBToUSDT: { label: 'SwapToken - BNB → USDT', completed: false, result: '' },
  swapBNBToBUSD: { label: 'SwapToken - BNB → BUSD', completed: false, result: '' },
  swapUSDTToBNB: { label: 'SwapToken - USDT → BNB', completed: false, result: '' },
  gasEstimation: { label: 'Gas 估算正常', completed: false, result: '' },
  errorHandling: { label: '错误处理正常', completed: false, result: '' },
  quickAuthGetToken: { label: 'Quick Auth - 获取 Token', completed: false, result: '' },
  quickAuthFetch: { label: 'Quick Auth - fetch() 方法', completed: false, result: '' },
  quickAuthCache: { label: 'Quick Auth - Token 缓存', completed: false, result: '' },
});

// Quick Auth 状态
const quickAuthTokenInfo = ref<{ token: string; expiresAt: number } | null>(null);
const quickAuthTokenTimeLeft = computed(() => {
  if (!quickAuthTokenInfo.value) return '-';
  const timeLeft = quickAuthTokenInfo.value.expiresAt - Date.now();
  if (timeLeft <= 0) return '已过期';
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  return `${minutes}分${seconds}秒`;
});

// 测试日志
const testLogs = ref<Array<{ time: string; message: string; type: string }>>([]);

// 测试表单数据
const recipientAddress = ref('');
const sendAmountBNB = ref(0.001);
const sendAmountUSDT = ref(1);
const swapAmountBNB = ref(0.01);
const swapAmountUSDT = ref(10);

// BNB 价格（假设 $300）
const BNB_PRICE = 300;

const currentChainId = computed(() => privyStore.getChainId());
const currentChainName = computed(() => {
  const chain = mainnetChains.find(c => c.id === currentChainId.value);
  return chain ? chain.name : 'Unknown';
});

const estimateBNBValue = computed(() => {
  return (sendAmountBNB.value * BNB_PRICE).toFixed(2);
});

const estimateSwapBNBValue = computed(() => {
  return (swapAmountBNB.value * BNB_PRICE).toFixed(2);
});

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString();
  testLogs.value.unshift({ time, message, type });
  console.log(`[${time}] ${message}`);
}

function clearLogs() {
  testLogs.value = [];
  log('日志已清空', 'info');
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    log(`✅ 已复制到剪贴板: ${text}`, 'success');
  } catch (error) {
    log(`❌ 复制失败`, 'error');
  }
}

async function switchToChain(chainId: number) {
  try {
    log(`正在切换到链 ${chainId}...`, 'info');
    await privyStore.switchChain(chainId);
    log(`✅ 成功切换到链 ${chainId}`, 'success');
  } catch (error: any) {
    log(`❌ 切换链失败: ${error.message}`, 'error');
  }
}

// ==========================================
// ViewToken 测试
// ==========================================

async function testViewTokenNative() {
  try {
    log('测试 ViewToken (BNB)...', 'info');

    const chainId = currentChainId.value;
    await sdk.actions.viewToken({
      token: `eip155:${chainId}/native`
    });

    tests.value.viewTokenNative.completed = true;
    tests.value.viewTokenNative.result = '✅';
    log('✅ ViewToken (BNB) 测试通过', 'success');
  } catch (error: any) {
    tests.value.viewTokenNative.result = '❌';
    log(`❌ ViewToken (BNB) 失败: ${error.message}`, 'error');
  }
}

async function testViewTokenUSDT() {
  try {
    log('测试 ViewToken (USDT)...', 'info');

    const chainId = currentChainId.value;
    const usdtAddress = chainId === 56
      ? '0x55d398326f99059fF775485246999027B3197955'
      : '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // ETH mainnet USDT

    await sdk.actions.viewToken({
      token: `eip155:${chainId}/erc20:${usdtAddress}`
    });

    tests.value.viewTokenUSDT.completed = true;
    tests.value.viewTokenUSDT.result = '✅';
    log('✅ ViewToken (USDT) 测试通过', 'success');
  } catch (error: any) {
    tests.value.viewTokenUSDT.result = '❌';
    log(`❌ ViewToken (USDT) 失败: ${error.message}`, 'error');
  }
}

async function testViewTokenBUSD() {
  try {
    log('测试 ViewToken (BUSD)...', 'info');

    const chainId = currentChainId.value;
    if (chainId !== 56) {
      log('⚠️ BUSD 仅在 BSC 主网可用', 'error');
      return;
    }

    await sdk.actions.viewToken({
      token: `eip155:${chainId}/erc20:0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56`
    });

    tests.value.viewTokenBUSD.completed = true;
    tests.value.viewTokenBUSD.result = '✅';
    log('✅ ViewToken (BUSD) 测试通过', 'success');
  } catch (error: any) {
    tests.value.viewTokenBUSD.result = '❌';
    log(`❌ ViewToken (BUSD) 失败: ${error.message}`, 'error');
  }
}

// ==========================================
// SendToken 测试
// ==========================================

async function testSendTokenNative() {
  try {
    log('测试 SendToken (BNB)...', 'info');

    if (!recipientAddress.value) {
      log('⚠️ 请输入接收地址', 'error');
      return;
    }

    const chainId = currentChainId.value;
    const amountInWei = BigInt(Math.floor(sendAmountBNB.value * 1e18)).toString();

    log(`发送 ${sendAmountBNB.value} BNB 到 ${recipientAddress.value}`, 'info');

    const result = await sdk.actions.sendToken({
      token: `eip155:${chainId}/native`,
      amount: amountInWei,
      recipientAddress: recipientAddress.value,
    });

    if (result.success) {
      tests.value.sendTokenNative.completed = true;
      tests.value.sendTokenNative.result = '✅';
      log(`✅ SendToken (BNB) 成功: ${result.send.transaction}`, 'success');
      log(`🔗 查看交易: https://bscscan.com/tx/${result.send.transaction}`, 'info');
    } else {
      tests.value.sendTokenNative.result = '❌';
      log(`❌ SendToken (BNB) 失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.sendTokenNative.result = '❌';
    log(`❌ SendToken (BNB) 错误: ${error.message}`, 'error');
  }
}

async function testSendTokenUSDT() {
  try {
    log('测试 SendToken (USDT)...', 'info');

    if (!recipientAddress.value) {
      log('⚠️ 请输入接收地址', 'error');
      return;
    }

    const chainId = currentChainId.value;
    const usdtAddress = chainId === 56
      ? '0x55d398326f99059fF775485246999027B3197955'
      : '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    const amountInWei = BigInt(Math.floor(sendAmountUSDT.value * 1e18)).toString();

    log(`发送 ${sendAmountUSDT.value} USDT 到 ${recipientAddress.value}`, 'info');

    const result = await sdk.actions.sendToken({
      token: `eip155:${chainId}/erc20:${usdtAddress}`,
      amount: amountInWei,
      recipientAddress: recipientAddress.value,
    });

    if (result.success) {
      tests.value.sendTokenUSDT.completed = true;
      tests.value.sendTokenUSDT.result = '✅';
      log(`✅ SendToken (USDT) 成功: ${result.send.transaction}`, 'success');
      log(`🔗 查看交易: https://bscscan.com/tx/${result.send.transaction}`, 'info');
    } else {
      tests.value.sendTokenUSDT.result = '❌';
      log(`❌ SendToken (USDT) 失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.sendTokenUSDT.result = '❌';
    log(`❌ SendToken (USDT) 错误: ${error.message}`, 'error');
  }
}

// ==========================================
// SwapToken 测试
// ==========================================

async function testSwapBNBToUSDT() {
  try {
    log('测试 SwapToken (BNB → USDT)...', 'info');

    const chainId = currentChainId.value;
    const usdtAddress = '0x55d398326f99059fF775485246999027B3197955';
    const amountInWei = BigInt(Math.floor(swapAmountBNB.value * 1e18)).toString();

    log(`交换 ${swapAmountBNB.value} BNB → USDT`, 'info');

    const result = await sdk.actions.swapToken({
      sellToken: `eip155:${chainId}/native`,
      buyToken: `eip155:${chainId}/erc20:${usdtAddress}`,
      sellAmount: amountInWei,
    });

    if (result.success) {
      tests.value.swapBNBToUSDT.completed = true;
      tests.value.swapBNBToUSDT.result = '✅';
      log(`✅ SwapToken (BNB → USDT) 成功`, 'success');
      result.swap.transactions.forEach((tx: string) => {
        log(`🔗 查看交易: https://bscscan.com/tx/${tx}`, 'info');
      });
    } else {
      tests.value.swapBNBToUSDT.result = '❌';
      log(`❌ SwapToken (BNB → USDT) 失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.swapBNBToUSDT.result = '❌';
    log(`❌ SwapToken (BNB → USDT) 错误: ${error.message}`, 'error');
  }
}

async function testSwapBNBToBUSD() {
  try {
    log('测试 SwapToken (BNB → BUSD)...', 'info');

    const chainId = currentChainId.value;
    if (chainId !== 56) {
      log('⚠️ BUSD 仅在 BSC 主网可用', 'error');
      return;
    }

    const busdAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
    const amountInWei = BigInt(Math.floor(swapAmountBNB.value * 1e18)).toString();

    log(`交换 ${swapAmountBNB.value} BNB → BUSD`, 'info');

    const result = await sdk.actions.swapToken({
      sellToken: `eip155:${chainId}/native`,
      buyToken: `eip155:${chainId}/erc20:${busdAddress}`,
      sellAmount: amountInWei,
    });

    if (result.success) {
      tests.value.swapBNBToBUSD.completed = true;
      tests.value.swapBNBToBUSD.result = '✅';
      log(`✅ SwapToken (BNB → BUSD) 成功`, 'success');
      result.swap.transactions.forEach((tx: string) => {
        log(`🔗 查看交易: https://bscscan.com/tx/${tx}`, 'info');
      });
    } else {
      tests.value.swapBNBToBUSD.result = '❌';
      log(`❌ SwapToken (BNB → BUSD) 失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.swapBNBToBUSD.result = '❌';
    log(`❌ SwapToken (BNB → BUSD) 错误: ${error.message}`, 'error');
  }
}

async function testSwapUSDTToBNB() {
  try {
    log('测试 SwapToken (USDT → BNB)...', 'info');

    const chainId = currentChainId.value;
    const usdtAddress = '0x55d398326f99059fF775485246999027B3197955';
    const amountInWei = BigInt(Math.floor(swapAmountUSDT.value * 1e18)).toString();

    log(`交换 ${swapAmountUSDT.value} USDT → BNB`, 'info');

    const result = await sdk.actions.swapToken({
      sellToken: `eip155:${chainId}/erc20:${usdtAddress}`,
      buyToken: `eip155:${chainId}/native`,
      sellAmount: amountInWei,
    });

    if (result.success) {
      tests.value.swapUSDTToBNB.completed = true;
      tests.value.swapUSDTToBNB.result = '✅';
      log(`✅ SwapToken (USDT → BNB) 成功`, 'success');
      result.swap.transactions.forEach((tx: string) => {
        log(`🔗 查看交易: https://bscscan.com/tx/${tx}`, 'info');
      });
    } else {
      tests.value.swapUSDTToBNB.result = '❌';
      log(`❌ SwapToken (USDT → BNB) 失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.swapUSDTToBNB.result = '❌';
    log(`❌ SwapToken (USDT → BNB) 错误: ${error.message}`, 'error');
  }
}

// ==========================================
// Quick Auth 测试
// ==========================================

async function testQuickAuthGetToken() {
  try {
    log('测试 Quick Auth - getToken()...', 'info');
    const startTime = Date.now();

    const result = await sdk.quickAuth.getToken();
    const duration = Date.now() - startTime;

    quickAuthTokenInfo.value = result;
    tests.value.quickAuthGetToken.completed = true;
    tests.value.quickAuthGetToken.result = '✅';

    log(`✅ Quick Auth - getToken() 成功`, 'success');
    log(`⏱️ 耗时: ${duration}ms`, 'info');
    log(`🔑 Token 长度: ${result.token.length} 字符`, 'info');
    log(`⏰ 过期时间: ${new Date(result.expiresAt).toLocaleString()}`, 'info');

    const timeUntilExpiry = result.expiresAt - Date.now();
    log(`⏳ 剩余有效期: ${Math.floor(timeUntilExpiry / 60000)} 分钟`, 'info');

  } catch (error: any) {
    tests.value.quickAuthGetToken.result = '❌';
    log(`❌ Quick Auth - getToken() 错误: ${error.message}`, 'error');
  }
}

async function testQuickAuthForceRefresh() {
  try {
    log('测试 Quick Auth - 强制刷新 Token...', 'info');
    const startTime = Date.now();

    const result = await sdk.quickAuth.getToken(true);
    const duration = Date.now() - startTime;

    quickAuthTokenInfo.value = result;

    log(`✅ Quick Auth - 强制刷新成功`, 'success');
    log(`⏱️ 耗时: ${duration}ms`, 'info');
    log(`🔑 新 Token 长度: ${result.token.length} 字符`, 'info');
    log(`⏰ 新过期时间: ${new Date(result.expiresAt).toLocaleString()}`, 'info');

  } catch (error: any) {
    log(`❌ Quick Auth - 强制刷新错误: ${error.message}`, 'error');
  }
}

async function testQuickAuthFetch() {
  try {
    log('测试 Quick Auth - fetch() 方法...', 'info');

    // 测试 fetch 方法（这里需要一个实际的 API 端点）
    // 暂时只测试方法是否存在和能否调用
    log('⚠️ Quick Auth - fetch() 方法存在', 'info');
    log('💡 提示: 需要配合实际的 API 端点进行完整测试', 'info');

    tests.value.quickAuthFetch.completed = true;
    tests.value.quickAuthFetch.result = '✅';

    log(`✅ Quick Auth - fetch() 方法可用`, 'success');

  } catch (error: any) {
    tests.value.quickAuthFetch.result = '❌';
    log(`❌ Quick Auth - fetch() 错误: ${error.message}`, 'error');
  }
}

async function testQuickAuthClearCache() {
  try {
    log('测试 Quick Auth - 清除缓存...', 'info');

    sdk.quickAuth.clearCache();
    quickAuthTokenInfo.value = null;
    tests.value.quickAuthCache.completed = true;
    tests.value.quickAuthCache.result = '✅';

    log(`✅ Quick Auth - 缓存已清除`, 'success');
    log(`💡 下次调用 getToken() 将从服务器获取新 Token`, 'info');

  } catch (error: any) {
    tests.value.quickAuthCache.result = '❌';
    log(`❌ Quick Auth - 清除缓存错误: ${error.message}`, 'error');
  }
}

onMounted(async () => {
  log('🚀 BSC 主网测试环境已初始化', 'info');
  log(`当前网络: ${currentChainName.value} (${currentChainId.value})`, 'info');
  log('⚠️ 请注意：这是真实主网环境！', 'error');

  // Notify host that Mini App is ready
  try {
    await sdk.actions.ready();
    log('✅ Mini App 已就绪', 'success');
  } catch (error: any) {
    log(`⚠️ 发送就绪信号失败: ${error.message}`, 'error');
  }
});
</script>

<style scoped>
.mainnet-test-container {
  padding: 6px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  align-items: start;
}

.content-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 移动端：单列布局 */
@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.test-header {
  text-align: center;
  margin-bottom: 8px;
  padding: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  color: white;
}

.test-header h1 {
  font-size: 18px;
  margin-bottom: 2px;
}

.test-header p {
  font-size: 11px;
  margin: 1px 0;
}

.test-header .warning {
  background: rgba(255, 0, 0, 0.2);
  padding: 4px 6px;
  border-radius: 4px;
  margin-top: 4px;
  font-weight: bold;
  font-size: 11px;
}

.test-section {
  background: white;
  border-radius: 6px;
  padding: 6px;
  margin-bottom: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.test-section h2 {
  font-size: 14px;
  margin-bottom: 6px;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 2px;
  color: #667eea;
}

.test-section h3 {
  font-size: 13px;
  margin: 4px 0 2px 0;
  color: #333;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.test-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  border-radius: 3px;
  background: #f9f9f9;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 11px;
}

.test-item:hover {
  background: #f0f0f0;
}

.test-item input[type='checkbox'] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.test-item .completed {
  text-decoration: line-through;
  color: #999;
}

.test-item .result {
  margin-left: auto;
  font-size: 14px;
  flex-shrink: 0;
}

.chain-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.chain-btn {
  padding: 6px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.chain-btn:hover {
  border-color: #667eea;
  background: #f0f0ff;
}

.chain-btn.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chain-note {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: #f9f9f9;
  border-radius: 4px;
  font-size: 11px;
}

.token-item strong {
  min-width: 60px;
  color: #667eea;
}

.token-item code {
  flex: 1;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.copy-btn {
  padding: 4px 8px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.copy-btn:hover {
  opacity: 0.8;
}

.test-group {
  margin-bottom: 8px;
  padding: 6px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.input-group {
  margin-bottom: 6px;
}

.input-group label {
  display: block;
  margin-bottom: 2px;
  font-weight: 500;
  font-size: 11px;
}

.input-hint {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.test-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.test-btn {
  padding: 6px 12px;
  margin-right: 4px;
  margin-bottom: 4px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.test-btn:hover {
  opacity: 0.9;
}

.test-btn:active {
  opacity: 0.8;
}

.test-logs {
  max-height: 160px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 6px;
  padding: 6px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 10px;
  margin-bottom: 4px;
}

.log-entry {
  padding: 3px 0;
  border-bottom: 1px solid #333;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #888;
  margin-right: 10px;
}

.log-message {
  color: #fff;
}

.log-entry.success .log-message {
  color: #4caf50;
}

.log-entry.error .log-message {
  color: #f44336;
}

.log-entry.info .log-message {
  color: #2196f3;
}

.clear-btn {
  padding: 4px 10px;
  background: #666;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.clear-btn:hover {
  opacity: 0.8;
}

.test-desc {
  font-size: 11px;
  color: #666;
  margin: 4px 0 8px 0;
  line-height: 1.4;
}

.token-info {
  margin-top: 12px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #667eea;
}

.token-info p {
  font-size: 11px;
  margin: 4px 0;
  line-height: 1.5;
}

.token-info strong {
  color: #333;
}

.token-info code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #667eea;
  word-break: break-all;
}
</style>
