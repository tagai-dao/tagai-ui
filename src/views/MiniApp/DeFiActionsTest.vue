<template>
  <div class="defi-test-container">
    <div class="test-card">
      <h1>🚀 DeFi Actions 测试</h1>
      <p class="subtitle">TagAI Mini App SDK - P1-1 功能测试</p>

      <div :class="['status', statusClass]">{{ statusText }}</div>

      <!-- SwapToken Section - 移到最上面便于测试 -->
      <div class="section">
        <div class="section-title">1️⃣ SwapToken - 交换代币 🔥</div>
        <div class="button-group">
          <button class="success" @click="testSwapBNBtoUSDT">交换 BNB → USDT</button>
          <button class="success" @click="testSwapUSDTtoBNB">交换 USDT → BNB</button>
        </div>
      </div>

      <!-- SendToken Section -->
      <div class="section">
        <div class="section-title">2️⃣ SendToken - 发送代币</div>
        <div class="button-group">
          <button class="secondary" @click="testSendBNB">发送 0.001 BNB</button>
          <button class="secondary" @click="testSendUSDT">发送 1 USDT (ERC20)</button>
        </div>
      </div>

      <!-- ViewToken Section -->
      <div class="section">
        <div class="section-title">3️⃣ ViewToken - 查看代币</div>
        <div class="button-group">
          <button @click="testViewBNB">查看 BNB</button>
          <button @click="testViewUSDT">查看 USDT</button>
        </div>
      </div>

      <!-- Log Section -->
      <div class="log-container">
        <div class="log-title">📝 执行日志</div>
        <div class="log-entries">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-entry', log.type]"
          >
            [{{ log.time }}] {{ log.message }}
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
  type: 'info' | 'success' | 'error';
}

const statusText = ref('正在初始化 SDK...');
const statusClass = ref('loading');
const logs = ref<LogEntry[]>([]);

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
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

      // 通知 Host 页面已就绪
      await sdk.actions.ready();
    } else {
      statusText.value = '❌ 未在 Mini App 环境中';
      statusClass.value = 'error';
      log('❌ 请在 TagAI Mini App Host 中打开此页面', 'error');
    }
  } catch (error: any) {
    statusText.value = '❌ 初始化失败';
    statusClass.value = 'error';
    log(`❌ SDK 初始化错误: ${error.message}`, 'error');
  }
});

// Test Functions
async function testViewBNB() {
  console.log('[Test] testViewBNB clicked');
  log('调用 viewToken(BNB)...');
  try {
    console.log('[Test] Calling sdk.actions.viewToken');
    await sdk.actions.viewToken({ token: 'eip155:56/native' });
    console.log('[Test] viewToken returned successfully');
    log('✅ viewToken(BNB) 调用成功', 'success');
  } catch (error: any) {
    console.error('[Test] viewToken error:', error);
    log(`❌ viewToken(BNB) 失败: ${error.message}`, 'error');
  }
}

async function testViewUSDT() {
  log('调用 viewToken(USDT)...');
  try {
    await sdk.actions.viewToken({
      token: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955'
    });
    log('✅ viewToken(USDT) 调用成功', 'success');
  } catch (error: any) {
    log(`❌ viewToken(USDT) 失败: ${error.message}`, 'error');
  }
}

async function testViewETH() {
  log('调用 viewToken(ETH)...');
  try {
    await sdk.actions.viewToken({ token: 'eip155:1/native' });
    log('✅ viewToken(ETH) 调用成功', 'success');
  } catch (error: any) {
    log(`❌ viewToken(ETH) 失败: ${error.message}`, 'error');
  }
}

async function testSendBNB() {
  log('调用 sendToken(0.001 BNB)...');
  try {
    const result = await sdk.actions.sendToken({
      token: 'eip155:56/native',
      amount: '1000000000000000',
      recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
    });

    console.log('[Test] sendToken result:', result);
    if (result.success) {
      log(`✅ 发送成功! 交易哈希: ${result.send.transaction}`, 'success');
    } else {
      log(`❌ 发送失败: ${result.reason}`, 'error');
      if (result.error) {
        console.error('[Test] Error details:', result.error);
        log(`错误详情: ${result.error.message}`, 'error');
      }
    }
  } catch (error: any) {
    console.error('[Test] sendToken exception:', error);
    log(`❌ sendToken 错误: ${error.message}`, 'error');
  }
}

async function testSendUSDT() {
  log('调用 sendToken(1 USDT)...');
  try {
    const result = await sdk.actions.sendToken({
      token: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
      amount: '1000000000000000000',
      recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
    });

    if (result.success) {
      log(`✅ 发送成功! 交易哈希: ${result.send.transaction}`, 'success');
    } else {
      log(`❌ 发送失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ sendToken 错误: ${error.message}`, 'error');
  }
}

async function testSendByTwitter() {
  log('调用 sendToken(通过 Twitter ID)...');
  try {
    const result = await sdk.actions.sendToken({
      token: 'eip155:56/native',
      amount: '1000000000000000',
      recipientTwitterId: 'test_user'
    });

    if (result.success) {
      log(`✅ 发送成功! 交易哈希: ${result.send.transaction}`, 'success');
    } else {
      log(`❌ 发送失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ sendToken 错误: ${error.message}`, 'error');
  }
}

async function testSwapBNBtoUSDT() {
  log('调用 swapToken(BNB → USDT)...');
  try {
    const result = await sdk.actions.swapToken({
      sellToken: 'eip155:56/native',
      buyToken: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '10000000000000000'
    });

    console.log('[Test] swapToken result:', result);
    if (result.success) {
      log(`✅ 交换成功! 交易数: ${result.swap.transactions.length}`, 'success');
      result.swap.transactions.forEach((tx, i) => {
        log(`交易 ${i + 1}: ${tx}`, 'success');
      });
    } else {
      log(`❌ 交换失败: ${result.reason}`, 'error');
      if (result.error) {
        console.error('[Test] Swap error details:', result.error);
        log(`错误详情: ${result.error.message}`, 'error');
      }
    }
  } catch (error: any) {
    console.error('[Test] swapToken exception:', error);
    log(`❌ swapToken 错误: ${error.message}`, 'error');
  }
}

async function testSwapUSDTtoBNB() {
  log('调用 swapToken(USDT → BNB)...');
  try {
    const result = await sdk.actions.swapToken({
      sellToken: 'eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955',
      buyToken: 'eip155:56/native',
      sellAmount: '1000000000000000000'
    });

    if (result.success) {
      log(`✅ 交换成功! 交易: ${result.swap.transactions.join(', ')}`, 'success');
    } else {
      log(`❌ 交换失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ swapToken 错误: ${error.message}`, 'error');
  }
}

async function testSwapETH() {
  log('调用 swapToken(ETH → USDC on Ethereum)...');
  try {
    const result = await sdk.actions.swapToken({
      sellToken: 'eip155:1/native',
      buyToken: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      sellAmount: '10000000000000000'
    });

    if (result.success) {
      log(`✅ 交换成功! 交易: ${result.swap.transactions.join(', ')}`, 'success');
    } else {
      log(`❌ 交换失败: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    log(`❌ swapToken 错误: ${error.message}`, 'error');
  }
}
</script>

<style scoped>
.defi-test-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
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
  font-size: 20px;
}

.subtitle {
  color: #666;
  margin-bottom: 12px;
  font-size: 12px;
}

.status {
  display: inline-block;
  padding: 6px 12px;
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

.status.error {
  background: #f8d7da;
  color: #721c24;
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
  border-bottom: 2px solid #667eea;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

button.secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

button.success {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.log-container {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.log-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.log-entries {
  max-height: 150px;
  overflow-y: auto;
}

.log-entry {
  padding: 6px 10px;
  margin-bottom: 6px;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  font-family: 'Monaco', 'Courier New', monospace;
  border-left: 3px solid #667eea;
}

.log-entry.error {
  border-left-color: #f5576c;
  background: #fff5f5;
}

.log-entry.success {
  border-left-color: #00f2fe;
  background: #f0fcff;
}
</style>
