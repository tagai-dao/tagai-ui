<script setup lang="ts">
/**
 * Basket 买卖面板
 */
import { computed, toRef, watch } from 'vue'
import { formatUnits } from 'viem'
import { useI18n } from 'vue-i18n'
import type { BasketDetail } from '@/utils/spectrum/basket-data'
import { useBasketTrade } from '@/composables/baskets/useBasketTrade'
import { useLoginStore, LoginStepType } from '@/stores/login'
import { SPECTRUM_USDC_DECIMALS, SPECTRUM_MAX_SLIPPAGE_BPS } from '@/config/spectrum'
import { ROBINHOOD_CHAIN } from '@/config/chains'

const props = defineProps<{
  detail: BasketDetail
}>()

const emit = defineEmits<{
  traded: []
}>()

const { t } = useI18n()
const loginStore = useLoginStore()
const detailRef = toRef(props, 'detail')

const {
  side,
  amountInput,
  slippageBps,
  step,
  txHash,
  errorMessage,
  usdcBalance,
  basketBalance,
  quote,
  needsApproval,
  allLegsPriced,
  isOnRh,
  canTradeConfig,
  account,
  setMax,
  runTrade,
  resetStep,
} = useBasketTrade(detailRef)

const explorerTx = computed(() => {
  if (!txHash.value) return ''
  const base = ROBINHOOD_CHAIN.browser.replace(/\/$/, '')
  return `${base}/tx/${txHash.value}`
})

const balanceLabel = computed(() => {
  if (side.value === 'buy') {
    return `${formatUnits(usdcBalance.value, SPECTRUM_USDC_DECIMALS)} USDC`
  }
  return `${formatUnits(basketBalance.value, props.detail.decimals)} ${props.detail.symbol}`
})

const estimatedLabel = computed(() => {
  const q = quote.value
  if (!q) return '—'
  if (side.value === 'buy') return `~${q.estimatedOut.toFixed(6)} ${props.detail.symbol}`
  return `~$${q.estimatedOut.toFixed(4)} USDC`
})

const isBusy = computed(() => step.value === 'approving' || step.value === 'swapping')

const tradeDisabled = computed(() => {
  if (isBusy.value) return true
  if (!isOnRh.value || !canTradeConfig.value) return true
  if (!account.value) return true
  if (!quote.value) return true
  if (side.value === 'buy' && !allLegsPriced.value) return true
  return false
})

const primaryLabel = computed(() => {
  if (!account.value) return t('connect')
  if (step.value === 'approving') return t('baskets.approving')
  if (step.value === 'swapping') return t('baskets.swapping')
  if (needsApproval.value) return t('baskets.approveAndTrade')
  return side.value === 'buy' ? t('buy') : t('sell')
})

const onPrimary = async () => {
  if (!account.value) {
    loginStore.setLoginStep(LoginStepType.AuthTwitter)
    return
  }
  await runTrade()
  if (step.value === 'success') emit('traded')
}

watch(side, () => resetStep())
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-surface p-4">
    <div class="flex gap-2 mb-4">
      <button
        type="button"
        class="flex-1 h-9 rounded-lg text-sm font-semibold transition-colors"
        :class="side === 'buy' ? 'bg-orange-normal text-white' : 'bg-surface-2 text-content'"
        @click="side = 'buy'"
      >
        {{ $t('buy') }}
      </button>
      <button
        type="button"
        class="flex-1 h-9 rounded-lg text-sm font-semibold transition-colors"
        :class="side === 'sell' ? 'bg-red-normal text-white' : 'bg-surface-2 text-content'"
        @click="side = 'sell'"
      >
        {{ $t('sell') }}
      </button>
    </div>

    <div class="flex items-center justify-between text-xs text-grey-64 mb-1">
      <span>{{ $t('amount') }}</span>
      <button type="button" class="text-orange-normal font-medium" @click="setMax">
        {{ $t('max') }}: {{ balanceLabel }}
      </button>
    </div>
    <div class="flex items-center gap-2 mb-3">
      <input
        v-model="amountInput"
        type="number"
        min="0"
        step="any"
        class="flex-1 h-11 px-3 rounded-lg border border-gray-200 bg-surface-2 text-content text-base outline-none focus:border-orange-normal"
        :placeholder="side === 'buy' ? 'USDC' : detail.symbol"
        :disabled="isBusy"
      >
    </div>

    <div class="space-y-1.5 text-xs text-grey-64 mb-4">
      <div class="flex justify-between">
        <span>{{ $t('baskets.estimatedOut') }}</span>
        <span class="text-content">{{ estimatedLabel }}</span>
      </div>
      <div class="flex justify-between items-center gap-2">
        <span>{{ $t('baskets.slippage') }}</span>
        <div class="flex items-center gap-1">
          <input
            v-model.number="slippageBps"
            type="number"
            min="1"
            :max="SPECTRUM_MAX_SLIPPAGE_BPS"
            class="w-16 h-7 px-2 rounded border border-gray-200 bg-surface-2 text-content text-right"
            :disabled="isBusy"
          >
          <span>bps</span>
        </div>
      </div>
      <div v-if="side === 'buy' && !allLegsPriced" class="text-red-normal">
        {{ $t('baskets.legsUnpriced') }}
      </div>
      <div v-if="!isOnRh" class="text-orange-normal">
        {{ $t('baskets.switchChainHint') }}
      </div>
    </div>

    <button
      type="button"
      class="w-full h-11 rounded-lg text-sm font-semibold text-white transition-opacity"
      :class="tradeDisabled && account ? 'bg-grey-normal opacity-60' : 'bg-orange-normal hover:opacity-90'"
      :disabled="tradeDisabled && !!account"
      @click="onPrimary"
    >
      {{ primaryLabel }}
    </button>

    <p v-if="errorMessage" class="mt-3 text-xs text-red-normal break-words">{{ errorMessage }}</p>
    <a
      v-if="txHash && explorerTx"
      :href="explorerTx"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-2 inline-block text-xs text-orange-normal underline"
    >
      {{ $t('baskets.viewTx') }}
    </a>
  </div>
</template>
