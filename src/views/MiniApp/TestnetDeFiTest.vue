<template>
  <div class="testnet-test-container">
    <div class="test-header">
      <h1>🧪 DeFi Actions - Testnet Testing</h1>
      <p>Testing on: {{ currentChainName }}</p>
    </div>

    <div class="test-section">
      <h2>📋 Test Checklist</h2>
      <div class="checklist">
        <label v-for="(test, key) in tests" :key="key" class="test-item">
          <input type="checkbox" v-model="test.completed" />
          <span :class="{ completed: test.completed }">{{ test.label }}</span>
          <span v-if="test.result" class="result">{{ test.result }}</span>
        </label>
      </div>
    </div>

    <div class="test-section">
      <h2>🔗 Chain Selection</h2>
      <div class="chain-buttons">
        <button
          v-for="chain in testnetChains"
          :key="chain.id"
          @click="switchToChain(chain.id)"
          :class="{ active: currentChainId === chain.id }"
          class="chain-btn"
        >
          {{ chain.name }}
        </button>
      </div>
    </div>

    <div class="test-section">
      <h2>💰 Test Tokens (Get from Faucets)</h2>
      <div class="faucet-links">
        <div v-for="faucet in faucets" :key="faucet.name" class="faucet-item">
          <strong>{{ faucet.name }}:</strong>
          <a :href="faucet.url" target="_blank">{{ faucet.url }}</a>
        </div>
      </div>
    </div>

    <div class="test-section">
      <h2>🧪 Test Actions</h2>

      <!-- ViewToken Tests -->
      <div class="test-group">
        <h3>1. ViewToken Tests</h3>
        <button @click="testViewTokenNative" class="test-btn">
          Test ViewToken (Native)
        </button>
        <button @click="testViewTokenERC20" class="test-btn">
          Test ViewToken (ERC20 USDT)
        </button>
      </div>

      <!-- SendToken Tests -->
      <div class="test-group">
        <h3>2. SendToken Tests</h3>
        <div class="input-group">
          <label>Recipient Address:</label>
          <input
            v-model="recipientAddress"
            placeholder="0x..."
            class="test-input"
          />
        </div>
        <button @click="testSendTokenNative" class="test-btn">
          Send Native Token (0.001)
        </button>
        <button @click="testSendTokenERC20" class="test-btn">
          Send ERC20 USDT (1 USDT)
        </button>
      </div>

      <!-- SwapToken Tests -->
      <div class="test-group">
        <h3>3. SwapToken Tests</h3>
        <button @click="testSwapNativeToUSDT" class="test-btn">
          Swap Native → USDT (0.01)
        </button>
        <button @click="testSwapUSDTToNative" class="test-btn">
          Swap USDT → Native (10 USDT)
        </button>
      </div>
    </div>

    <div class="test-section">
      <h2>📊 Test Results</h2>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePrivyStore } from '@/stores/privy';
import { sdk } from '@/sdk/miniapp-sdk/src/index';

const privyStore = usePrivyStore();

// Test chains
const testnetChains = [
  { id: 97, name: 'BSC Testnet' },
  { id: 11155111, name: 'Sepolia' },
];

// Faucets
const faucets = [
  {
    name: 'BSC Testnet Faucet',
    url: 'https://testnet.binance.org/faucet-smart',
  },
  {
    name: 'Sepolia Faucet',
    url: 'https://sepoliafaucet.com/',
  },
  {
    name: 'Sepolia Faucet 2',
    url: 'https://www.alchemy.com/faucets/ethereum-sepolia',
  },
];

// Test checklist
const tests = ref({
  viewTokenNative: { label: 'ViewToken - Native', completed: false, result: '' },
  viewTokenERC20: { label: 'ViewToken - ERC20', completed: false, result: '' },
  sendTokenNative: { label: 'SendToken - Native', completed: false, result: '' },
  sendTokenERC20: { label: 'SendToken - ERC20', completed: false, result: '' },
  swapNativeToERC20: { label: 'SwapToken - Native → ERC20', completed: false, result: '' },
  swapERC20ToNative: { label: 'SwapToken - ERC20 → Native', completed: false, result: '' },
  gasEstimation: { label: 'Gas Estimation Working', completed: false, result: '' },
  nonceHandling: { label: 'Nonce Handling (No Conflicts)', completed: false, result: '' },
  buttonDisabling: { label: 'Button Disabling During TX', completed: false, result: '' },
  errorHandling: { label: 'Error Handling', completed: false, result: '' },
});

// Test logs
const testLogs = ref<Array<{ time: string; message: string; type: string }>>([]);

// Test form data
// Use a valid test address - this is a well-known test address
const recipientAddress = ref('0x000000000000000000000000000000000000dEaD');

const currentChainId = computed(() => privyStore.getChainId());
const currentChainName = computed(() => {
  const chain = testnetChains.find(c => c.id === currentChainId.value);
  return chain ? chain.name : 'Unknown';
});

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString();
  testLogs.value.unshift({ time, message, type });
  console.log(`[${time}] ${message}`);
}

async function switchToChain(chainId: number) {
  try {
    log(`Switching to chain ${chainId}...`, 'info');
    await privyStore.switchChain(chainId);
    log(`✅ Switched to chain ${chainId}`, 'success');
  } catch (error: any) {
    log(`❌ Failed to switch chain: ${error.message}`, 'error');
  }
}

async function testViewTokenNative() {
  try {
    log('Testing ViewToken (Native)...', 'info');

    // Get SDK from window
    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    await sdk.actions.viewToken({
      token: `eip155:${chainId}/native`
    });

    tests.value.viewTokenNative.completed = true;
    tests.value.viewTokenNative.result = '✅';
    log('✅ ViewToken (Native) test passed', 'success');
  } catch (error: any) {
    tests.value.viewTokenNative.result = '❌';
    log(`❌ ViewToken (Native) failed: ${error.message}`, 'error');
  }
}

async function testViewTokenERC20() {
  try {
    log('Testing ViewToken (ERC20)...', 'info');

    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    // BSC Testnet USDT: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd
    // Sepolia USDT: Use a known test token
    const usdtAddress = chainId === 97
      ? '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
      : '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'; // Sepolia test token

    await sdk.actions.viewToken({
      token: `eip155:${chainId}/erc20:${usdtAddress}`
    });

    tests.value.viewTokenERC20.completed = true;
    tests.value.viewTokenERC20.result = '✅';
    log('✅ ViewToken (ERC20) test passed', 'success');
  } catch (error: any) {
    tests.value.viewTokenERC20.result = '❌';
    log(`❌ ViewToken (ERC20) failed: ${error.message}`, 'error');
  }
}

async function testSendTokenNative() {
  try {
    log('Testing SendToken (Native)...', 'info');

    if (!recipientAddress.value) {
      throw new Error('Please enter recipient address');
    }

    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    const result = await sdk.actions.sendToken({
      token: `eip155:${chainId}/native`,
      amount: '1000000000000000', // 0.001
      recipientAddress: recipientAddress.value,
    });

    if (result.success) {
      tests.value.sendTokenNative.completed = true;
      tests.value.sendTokenNative.result = '✅';
      log(`✅ SendToken (Native) succeeded: ${result.send.transaction}`, 'success');
    } else {
      tests.value.sendTokenNative.result = '❌';
      log(`❌ SendToken (Native) failed: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.sendTokenNative.result = '❌';
    log(`❌ SendToken (Native) error: ${error.message}`, 'error');
  }
}

async function testSendTokenERC20() {
  try {
    log('Testing SendToken (ERC20)...', 'info');

    if (!recipientAddress.value) {
      throw new Error('Please enter recipient address');
    }

    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    const usdtAddress = chainId === 97
      ? '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
      : '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

    const result = await sdk.actions.sendToken({
      token: `eip155:${chainId}/erc20:${usdtAddress}`,
      amount: '1000000000000000000', // 1 token
      recipientAddress: recipientAddress.value,
    });

    if (result.success) {
      tests.value.sendTokenERC20.completed = true;
      tests.value.sendTokenERC20.result = '✅';
      log(`✅ SendToken (ERC20) succeeded: ${result.send.transaction}`, 'success');
    } else {
      tests.value.sendTokenERC20.result = '❌';
      log(`❌ SendToken (ERC20) failed: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.sendTokenERC20.result = '❌';
    log(`❌ SendToken (ERC20) error: ${error.message}`, 'error');
  }
}

async function testSwapNativeToUSDT() {
  try {
    log('Testing SwapToken (Native → USDT)...', 'info');

    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    const usdtAddress = chainId === 97
      ? '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
      : '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

    const result = await sdk.actions.swapToken({
      sellToken: `eip155:${chainId}/native`,
      buyToken: `eip155:${chainId}/erc20:${usdtAddress}`,
      sellAmount: '10000000000000000', // 0.01
    });

    if (result.success) {
      tests.value.swapNativeToERC20.completed = true;
      tests.value.swapNativeToERC20.result = '✅';
      log(`✅ SwapToken (Native → USDT) succeeded`, 'success');
    } else {
      tests.value.swapNativeToERC20.result = '❌';
      log(`❌ SwapToken (Native → USDT) failed: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.swapNativeToERC20.result = '❌';
    log(`❌ SwapToken (Native → USDT) error: ${error.message}`, 'error');
  }
}

async function testSwapUSDTToNative() {
  try {
    log('Testing SwapToken (USDT → Native)...', 'info');

    // Using imported sdk
    if (false) { // SDK is imported
      throw new Error('SDK not found');
    }

    const chainId = currentChainId.value;
    const usdtAddress = chainId === 97
      ? '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
      : '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

    const result = await sdk.actions.swapToken({
      sellToken: `eip155:${chainId}/erc20:${usdtAddress}`,
      buyToken: `eip155:${chainId}/native`,
      sellAmount: '10000000000000000000', // 10 tokens
    });

    if (result.success) {
      tests.value.swapERC20ToNative.completed = true;
      tests.value.swapERC20ToNative.result = '✅';
      log(`✅ SwapToken (USDT → Native) succeeded`, 'success');
    } else {
      tests.value.swapERC20ToNative.result = '❌';
      log(`❌ SwapToken (USDT → Native) failed: ${result.reason}`, 'error');
    }
  } catch (error: any) {
    tests.value.swapERC20ToNative.result = '❌';
    log(`❌ SwapToken (USDT → Native) error: ${error.message}`, 'error');
  }
}

onMounted(async () => {
  log('🧪 Testnet Testing Environment Initialized', 'info');
  log(`Current Chain: ${currentChainName.value} (${currentChainId.value})`, 'info');

  // Notify host that Mini App is ready
  try {
    await sdk.actions.ready();
    log('✅ Mini App ready signal sent to host', 'success');
  } catch (error: any) {
    log(`⚠️ Failed to send ready signal: ${error.message}`, 'error');
  }
});
</script>

<style scoped>
.testnet-test-container {
  padding: 6px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.test-header {
  text-align: center;
  margin-bottom: 6px;
}

.test-header h1 {
  font-size: 18px;
  margin-bottom: 2px;
}

.test-header p {
  color: #666;
  font-size: 12px;
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
  margin-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 2px;
}

.test-section h3 {
  font-size: 13px;
  margin: 4px 0 3px 0;
  color: #333;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.test-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
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
  width: 12px;
  height: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.test-item .completed {
  text-decoration: line-through;
  color: #999;
}

.test-item .result {
  margin-left: auto;
  font-size: 13px;
  flex-shrink: 0;
}

.chain-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chain-btn {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.chain-btn:hover {
  border-color: #FF7A00;
  background: #fff5f0;
}

.chain-btn.active {
  border-color: #FF7A00;
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
  color: white;
}

.faucet-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.faucet-item {
  padding: 4px 8px;
  background: #f9f9f9;
  border-radius: 3px;
  font-size: 11px;
}

.faucet-item a {
  color: #FF7A00;
  text-decoration: none;
  margin-left: 6px;
  font-size: 10px;
}

.faucet-item a:hover {
  text-decoration: underline;
}

.test-group {
  margin-bottom: 6px;
  padding: 6px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
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

.test-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  font-size: 10px;
  font-family: monospace;
}

.test-btn {
  padding: 6px 12px;
  margin-right: 4px;
  margin-bottom: 4px;
  border: none;
  border-radius: 4px;
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
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
  max-height: 200px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 6px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 10px;
}

.log-entry {
  padding: 2px 0;
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
</style>
