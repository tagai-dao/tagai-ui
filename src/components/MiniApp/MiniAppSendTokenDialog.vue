<template>
  <div v-if="visible" class="send-dialog-overlay" @click.self="handleClose">
    <div class="send-dialog">
      <!-- Header -->
      <div class="send-header">
        <button class="close-btn" @click="handleClose">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <h2 class="send-title">发送代币</h2>
        <div style="width: 40px;"></div>
      </div>

      <!-- Content -->
      <div class="send-content">
        <!-- Token Info -->
        <div class="token-section">
          <div class="section-label">代币</div>
          <div class="token-info">
            <div class="token-symbol">{{ tokenSymbol }}</div>
            <div class="token-chain">{{ chainName }}</div>
          </div>
        </div>

        <!-- Amount -->
        <div class="amount-section">
          <div class="section-label">金额</div>
          <div class="amount-display">{{ formattedAmount }} {{ tokenSymbol }}</div>
        </div>

        <!-- Recipient -->
        <div class="recipient-section">
          <div class="section-label">接收方</div>
          <div class="recipient-info">
            <div v-if="recipientTwitterId" class="recipient-twitter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @{{ recipientTwitterId }}
            </div>
            <div class="recipient-address">{{ shortAddress }}</div>
          </div>
        </div>

        <!-- Network Fee Estimate (optional) -->
        <div v-if="estimatedGas" class="fee-section">
          <div class="section-label">预估网络费用</div>
          <div class="fee-amount">~{{ estimatedGas }} {{ nativeSymbol }}</div>
        </div>

        <!-- Warning -->
        <div class="warning-box">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
          <span>请确认接收地址正确，交易一旦发送将无法撤销</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="send-footer">
        <button class="cancel-btn" @click="handleClose" :disabled="props.submitting">
          取消
        </button>
        <button
          class="confirm-btn"
          @click="handleConfirm"
          :disabled="props.submitting"
        >
          <span v-if="props.submitting" class="loading-spinner"></span>
          <span v-else>确认发送</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getChainName } from '@/utils/privy';
import type { Address } from 'viem';

interface TokenInfo {
  chainId: number;
  symbol: string;
  address?: Address;
  isNative: boolean;
}

interface Props {
  visible: boolean;
  tokenInfo?: TokenInfo;
  amount?: string;
  recipientAddress?: Address;
  recipientTwitterId?: string;
  estimatedGas?: string;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  submitting: false,
});

const emit = defineEmits<{
  close: [];
  confirm: [];
  reject: [];
}>();

// Computed properties
const tokenSymbol = computed(() => props.tokenInfo?.symbol || 'TOKEN');
const chainName = computed(() => {
  if (!props.tokenInfo) return 'Unknown Chain';
  return getChainName(props.tokenInfo.chainId);
});

const nativeSymbol = computed(() => {
  if (!props.tokenInfo) return 'ETH';
  const chainId = props.tokenInfo.chainId;
  const symbols: Record<number, string> = {
    1: 'ETH',
    56: 'BNB',
    8453: 'ETH',
    10: 'ETH',
    42161: 'ETH',
  };
  return symbols[chainId] || 'ETH';
});

const formattedAmount = computed(() => {
  if (!props.amount) return '0';
  // Convert from wei to token units (assuming 18 decimals)
  const decimals = 18;
  const value = BigInt(props.amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmed = fractionalStr.replace(/0+$/, '');
  return `${wholePart}.${trimmed}`;
});

const shortAddress = computed(() => {
  if (!props.recipientAddress) return '';
  const addr = props.recipientAddress;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
});

function handleClose() {
  if (props.submitting) return;
  emit('reject');
  emit('close');
}

function handleConfirm() {
  if (props.submitting) return;
  emit('confirm');
}
</script>

<style scoped>
.send-dialog-overlay {
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

.send-dialog {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.send-header {
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

.send-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  flex: 1;
  text-align: center;
}

.send-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.token-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 12px;
}

.token-symbol {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.token-chain {
  font-size: 14px;
  color: #6b7280;
  padding: 4px 8px;
  background: white;
  border-radius: 6px;
}

.amount-section {
}

.amount-display {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  word-break: break-all;
}

.recipient-section {
}

.recipient-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 12px;
}

.recipient-twitter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #1DA1F2;
}

.recipient-address {
  font-size: 14px;
  font-family: monospace;
  color: #6b7280;
}

.fee-section {
}

.fee-amount {
  font-size: 14px;
  color: #6b7280;
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

.send-footer {
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
