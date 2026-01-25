<template>
  <div v-if="visible" class="swap-dialog-overlay" @click.self="handleClose">
    <div class="swap-dialog">
      <!-- Header -->
      <div class="swap-header">
        <button class="close-btn" @click="handleClose">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <h2 class="swap-title">兑换代币</h2>
        <div style="width: 40px;"></div>
      </div>

      <!-- Content -->
      <div class="swap-content">
        <!-- Sell Token Section -->
        <div class="token-section">
          <div class="section-label">卖出</div>
          <div class="token-card">
            <div class="token-header">
              <div class="token-symbol">{{ sellTokenSymbol }}</div>
              <div class="token-amount">{{ formattedSellAmount }}</div>
            </div>
            <div class="token-footer">
              <div class="token-chain">{{ sellChainName }}</div>
              <div v-if="sellTokenUsdValue" class="token-usd">≈ ${{ sellTokenUsdValue }}</div>
            </div>
          </div>
        </div>

        <!-- Swap Arrow -->
        <div class="swap-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>

        <!-- Buy Token Section -->
        <div class="token-section">
          <div class="section-label">买入</div>
          <div class="token-card">
            <div class="token-header">
              <div class="token-symbol">{{ buyTokenSymbol }}</div>
              <div class="token-amount">{{ formattedBuyAmount || '~' }}</div>
            </div>
            <div class="token-footer">
              <div class="token-chain">{{ buyChainName }}</div>
              <div v-if="buyTokenUsdValue" class="token-usd">≈ ${{ buyTokenUsdValue }}</div>
            </div>
          </div>
        </div>

        <!-- Quote Details -->
        <div v-if="quote" class="quote-section">
          <div class="quote-row">
            <span class="quote-label">汇率</span>
            <span class="quote-value">1 {{ sellTokenSymbol }} ≈ {{ quote.rate }} {{ buyTokenSymbol }}</span>
          </div>
          <div v-if="quote.priceImpact" class="quote-row">
            <span class="quote-label">价格影响</span>
            <span class="quote-value" :class="{ warning: parseFloat(quote.priceImpact) > 5 }">
              {{ quote.priceImpact }}%
            </span>
          </div>
          <div v-if="quote.minimumReceived" class="quote-row">
            <span class="quote-label">最少获得</span>
            <span class="quote-value">{{ quote.minimumReceived }} {{ buyTokenSymbol }}</span>
          </div>
          <div v-if="quote.route" class="quote-row">
            <span class="quote-label">路由</span>
            <span class="quote-value route">{{ quote.route }}</span>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-section">
          <div class="loading-spinner"></div>
          <span>正在获取最佳报价...</span>
        </div>

        <!-- Network Fee Estimate -->
        <div v-if="estimatedGas" class="fee-section">
          <div class="section-label">预估网络费用</div>
          <div class="fee-amount">~{{ estimatedGas }} {{ nativeSymbol }}</div>
        </div>

        <!-- Warning -->
        <div v-if="needsApproval" class="info-box">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <span>此交易需要先授权代币使用，将分两步完成</span>
        </div>

        <div class="warning-box">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
          <span>请确认交易信息正确，兑换后无法撤销</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="swap-footer">
        <button class="cancel-btn" @click="handleClose" :disabled="submitting">
          取消
        </button>
        <button
          class="confirm-btn"
          @click="handleConfirm"
          :disabled="submitting || !quote"
        >
          <span v-if="submitting" class="loading-spinner"></span>
          <span v-else>{{ needsApproval ? '授权并兑换' : '确认兑换' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getChainName } from '@/utils/privy';
import { formatTokenAmount } from '@/utils/token';
import type { Address } from 'viem';

interface TokenInfo {
  chainId: number;
  symbol: string;
  decimals: number;
  address?: Address;
  isNative: boolean;
}

interface SwapQuote {
  buyAmount: string;
  rate: string;
  priceImpact?: string;
  minimumReceived?: string;
  route?: string;
}

interface Props {
  visible: boolean;
  sellTokenInfo?: TokenInfo;
  buyTokenInfo?: TokenInfo;
  sellAmount?: string;
  quote?: SwapQuote;
  estimatedGas?: string;
  needsApproval?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  needsApproval: false,
  loading: false,
});

const emit = defineEmits<{
  close: [];
  confirm: [];
  reject: [];
}>();

const submitting = ref(false);

// Computed properties
const sellTokenSymbol = computed(() => props.sellTokenInfo?.symbol || 'TOKEN');
const buyTokenSymbol = computed(() => props.buyTokenInfo?.symbol || 'TOKEN');

const sellChainName = computed(() => {
  if (!props.sellTokenInfo) return 'Unknown Chain';
  return getChainName(props.sellTokenInfo.chainId);
});

const buyChainName = computed(() => {
  if (!props.buyTokenInfo) return 'Unknown Chain';
  return getChainName(props.buyTokenInfo.chainId);
});

const nativeSymbol = computed(() => {
  if (!props.sellTokenInfo) return 'ETH';
  const chainId = props.sellTokenInfo.chainId;
  const symbols: Record<number, string> = {
    1: 'ETH',
    56: 'BNB',
    8453: 'ETH',
    10: 'ETH',
    42161: 'ETH',
  };
  return symbols[chainId] || 'ETH';
});

const formattedSellAmount = computed(() => {
  if (!props.sellAmount || !props.sellTokenInfo) return '0';
  return formatTokenAmount(props.sellAmount, props.sellTokenInfo.decimals);
});

const formattedBuyAmount = computed(() => {
  if (!props.quote?.buyAmount || !props.buyTokenInfo) return null;
  return formatTokenAmount(props.quote.buyAmount, props.buyTokenInfo.decimals);
});

// TODO: 集成价格 API 获取 USD 价值
const sellTokenUsdValue = computed(() => null);
const buyTokenUsdValue = computed(() => null);

function handleClose() {
  if (submitting.value) return;
  emit('reject');
  emit('close');
}

async function handleConfirm() {
  if (submitting.value) return;
  submitting.value = true;

  try {
    emit('confirm');
  } catch (error) {
    console.error('Confirm error:', error);
    submitting.value = false;
  }
}
</script>

<style scoped>
.swap-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.swap-dialog {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.swap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #111827;
}

.swap-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  flex: 1;
  text-align: center;
}

.swap-content {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.token-section {
}

.token-card {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.token-symbol {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.token-amount {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  word-break: break-all;
}

.token-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.token-chain {
  font-size: 13px;
  color: #6b7280;
  padding: 3px 8px;
  background: white;
  border-radius: 6px;
}

.token-usd {
  font-size: 13px;
  color: #6b7280;
}

.swap-arrow {
  display: flex;
  justify-content: center;
  color: #9ca3af;
  margin: -8px 0;
}

.quote-section {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.quote-label {
  color: #6b7280;
}

.quote-value {
  color: #111827;
  font-weight: 500;
  text-align: right;
}

.quote-value.warning {
  color: #ef4444;
}

.quote-value.route {
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}

.fee-section {
}

.fee-amount {
  font-size: 14px;
  color: #6b7280;
}

.info-box {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #dbeafe;
  border: 1px solid #3b82f6;
  border-radius: 12px;
  color: #1e40af;
  font-size: 13px;
  line-height: 1.5;
}

.info-box svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #3b82f6;
}

.warning-box {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 12px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.5;
}

.warning-box svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #f59e0b;
}

.swap-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.cancel-btn {
  background: #f3f4f6;
  color: #374151;
}

.cancel-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn {
  background: linear-gradient(213.44deg, #FCA454 -14.77%, #FF7A00 116.22%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(213.44deg, #FF7A00 -14.77%, #FCA454 116.22%);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.loading-section .loading-spinner {
  border: 3px solid rgba(107, 114, 128, 0.3);
  border-top-color: #6b7280;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
