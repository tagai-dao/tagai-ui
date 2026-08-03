<script setup lang="ts">
/** Basket 买卖面板：交易状态机与原实现保持一致，仅调整呈现 */
import { computed, toRef, watch } from 'vue'
import { formatUnits } from 'viem'
import { useI18n } from 'vue-i18n'
import type { BasketDetail } from '@/utils/baskets/types'
import { useBasketTrade } from '@/composables/baskets/useBasketTrade'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import { BASKET_MAX_SLIPPAGE_BPS, getBasketDeployment } from '@/config/baskets'
import { getChainDeployment } from '@/config/chains'

const props = defineProps<{ detail: BasketDetail }>()
const emit = defineEmits<{ traded: [] }>()
const { t } = useI18n()
const modalStore = useModalStore()
const detailRef = toRef(props, 'detail')

const {
  side, amountInput, slippageBps, step, txHash, errorMessage,
  usdgBalance, basketBalance, quote, needsApproval,
  isOnBasketChain, canTradeConfig, account, setMax, setAmountInput, runTrade, resetStep,
} = useBasketTrade(detailRef)
const deployment = computed(() => getBasketDeployment(props.detail.chainId))
const switchChainHint = computed(() => props.detail.chainId === 4663
  ? t('baskets.switchChainHint')
  : `Please switch to ${deployment.value.networkLabel} to continue.`)

const explorerTx = computed(() => {
  if (!txHash.value) return ''
  return `${getChainDeployment(props.detail.chainId).browser.replace(/\/$/, '')}/tx/${txHash.value}`
})

const balanceLabel = computed(() => {
  if (side.value === 'buy') return `${formatUnits(usdgBalance.value, deployment.value.settlementDecimals)} ${deployment.value.settlementSymbol}`
  return `${formatUnits(basketBalance.value, props.detail.decimals)} ${props.detail.symbol}`
})

const inputToken = computed(() => side.value === 'buy' ? deployment.value.settlementSymbol : props.detail.symbol)
const outputToken = computed(() => side.value === 'buy' ? props.detail.symbol : deployment.value.settlementSymbol)

const estimatedLabel = computed(() => {
  const q = quote.value
  if (!q) return '—'
  if (side.value === 'buy') return `~${q.estimatedOut.toFixed(6)} ${props.detail.symbol}`
  return `~$${q.estimatedOut.toFixed(4)} ${deployment.value.settlementSymbol}`
})

const isBusy = computed(() => step.value === 'approving' || step.value === 'swapping')
const isQuoting = computed(() => step.value === 'quoting')
const showButtonSpinner = computed(() => isBusy.value || isQuoting.value)
const tradeDisabled = computed(() => {
  if (isBusy.value || !isOnBasketChain.value || !canTradeConfig.value || !account.value || !quote.value) return true
  return false
})

const primaryLabel = computed(() => {
  if (!account.value) return t('connect')
  if (step.value === 'quoting') return t('baskets.quoting')
  if (step.value === 'approving') return t('baskets.approving')
  if (step.value === 'swapping') return t('baskets.swapping')
  if (needsApproval.value) return t('baskets.approveAndTrade')
  return side.value === 'buy' ? t('buy') : t('sell')
})

const onPrimary = async () => {
  if (!account.value) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return
  }
  await runTrade()
  if (step.value === 'success') emit('traded')
}

const onAmountInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  setAmountInput(input.value)
  input.value = String(amountInput.value)
}

watch(side, () => resetStep())
</script>

<template>
  <div class="trade-card" :class="`trade-card--${side}`">
    <div class="trade-card__glow" aria-hidden="true" />
    <div class="trade-card__header">
      <div>
        <span>{{ $t('baskets.trade') }}</span>
        <h2>{{ detail.symbol }}</h2>
      </div>
      <span class="network-pill"><i /> {{ deployment.networkLabel }}</span>
    </div>

    <div class="trade-tabs">
      <button type="button" :class="{ active: side === 'buy' }" @click="side = 'buy'">
        {{ $t('buy') }}
      </button>
      <button type="button" :class="{ active: side === 'sell' }" @click="side = 'sell'">
        {{ $t('sell') }}
      </button>
    </div>

    <div class="amount-box">
      <div class="amount-box__label">
        <span>{{ $t('amount') }}</span>
        <button type="button" @click="setMax">{{ $t('max') }}</button>
      </div>
      <div class="amount-box__input">
        <input
          :value="amountInput"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          :disabled="isBusy"
          @input="onAmountInput"
        >
        <span>{{ inputToken }}</span>
      </div>
      <div class="amount-box__balance">
        <span>{{ balanceLabel }}</span>
      </div>
    </div>

    <div class="swap-direction" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M10 4v12m0 0-4-4m4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="receive-box">
      <span>{{ $t('baskets.estimatedOut') }}</span>
      <div>
        <strong>{{ estimatedLabel }}</strong>
        <em>{{ outputToken }}</em>
      </div>
    </div>

    <div class="trade-settings">
      <span>{{ $t('baskets.slippage') }}</span>
      <label>
        <input
          v-model.number="slippageBps"
          type="number"
          min="1"
          :max="BASKET_MAX_SLIPPAGE_BPS"
          :disabled="isBusy"
        >
        <span>bps</span>
      </label>
    </div>

    <div v-if="!isOnBasketChain" class="trade-alert">
      {{ switchChainHint }}
    </div>

    <button
      type="button"
      class="trade-primary"
      :class="{ disabled: tradeDisabled && !!account, quoting: isQuoting }"
      :disabled="tradeDisabled && !!account"
      @click="onPrimary"
    >
      <span>{{ primaryLabel }}</span>
      <svg v-if="!showButtonSpinner" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span v-else class="button-spinner" />
    </button>

    <p v-if="errorMessage" class="trade-error">{{ errorMessage }}</p>
    <a
      v-if="txHash && explorerTx"
      :href="explorerTx"
      target="_blank"
      rel="noopener noreferrer"
      class="tx-link"
    >
      {{ $t('baskets.viewTx') }} ↗
    </a>

    <div class="trade-note">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" stroke="currentColor" stroke-width="1.4" />
        <path d="M10 9.2v4M10 6.5v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span>{{ (detail.basketFeeBps / 100).toFixed(2) }}% {{ $t('baskets.fee') }}</span>
    </div>
  </div>
</template>

<style scoped>
.trade-card { position: relative; overflow: hidden; padding: 22px; border: 1px solid var(--border-base); border-radius: 24px; background: var(--surface); box-shadow: 0 20px 60px rgba(10,12,20,.08); }
.trade-card__glow { position: absolute; top: -100px; right: -80px; width: 220px; height: 220px; border-radius: 50%; background: #8d67e8; filter: blur(75px); opacity: .09; pointer-events: none; }
.trade-card--sell .trade-card__glow { background: #ff3d55; }
.trade-card__header { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.trade-card__header > div > span { color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.trade-card__header h2 { margin-top: 3px; color: var(--text-base); font-size: 22px; font-weight: 750; letter-spacing: -.04em; }
.network-pill { display: inline-flex; height: 27px; align-items: center; gap: 6px; padding: 0 9px; border: 1px solid rgba(167,218,0,.3); border-radius: 999px; background: rgba(169,230,0,.07); color: #8eaf00; font-size: 9px; font-weight: 800; letter-spacing: .1em; }
.network-pill i { width: 6px; height: 6px; border-radius: 50%; background: #b5ec13; box-shadow: 0 0 8px rgba(181,236,19,.65); }

.trade-tabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 20px; padding: 4px; border-radius: 13px; background: var(--surface-2); }
.trade-tabs button { height: 38px; border-radius: 10px; color: var(--text-muted); font-size: 12px; font-weight: 700; transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease; }
.trade-tabs button.active { background: var(--surface); color: var(--text-base); box-shadow: 0 5px 18px rgba(10,12,20,.08); }
.trade-card--buy .trade-tabs button:first-child.active { color: #e77a27; }
.trade-card--sell .trade-tabs button:last-child.active { color: var(--color-down); }

.amount-box { margin-top: 14px; padding: 14px; border: 1px solid var(--border-base); border-radius: 17px; background: color-mix(in srgb, var(--surface-2) 62%, transparent); transition: border-color 160ms ease; }
.amount-box:focus-within { border-color: #8d67e8; }
.amount-box__label, .amount-box__balance { display: flex; align-items: center; justify-content: space-between; color: var(--text-muted); font-size: 10px; }
.amount-box__label button { color: #e77a27; font-weight: 700; }
.amount-box__input { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
.amount-box__input input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 25px; font-weight: 650; letter-spacing: -.03em; }
.amount-box__input input::placeholder { color: var(--text-faint); }
.amount-box__input span { flex-shrink: 0; padding: 5px 8px; border: 1px solid var(--border-base); border-radius: 9px; background: var(--surface); color: var(--text-base); font-size: 10px; font-weight: 750; }

.swap-direction { position: relative; z-index: 2; display: grid; width: 30px; height: 30px; margin: -5px auto; place-items: center; border: 4px solid var(--surface); border-radius: 50%; background: var(--surface-2); color: var(--text-muted); }
.swap-direction svg { width: 15px; height: 15px; }
.receive-box { padding: 13px 14px; border: 1px solid var(--border-base); border-radius: 17px; background: var(--surface); }
.receive-box > span { color: var(--text-muted); font-size: 10px; }
.receive-box > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.receive-box strong { overflow: hidden; color: var(--text-base); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.receive-box em { color: var(--text-muted); font-size: 9px; font-style: normal; }

.trade-settings { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; color: var(--text-muted); font-size: 10px; }
.trade-settings label { display: inline-flex; height: 30px; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--border-base); border-radius: 9px; background: var(--surface-2); }
.trade-settings input { width: 45px; border: 0; outline: 0; background: transparent; color: var(--text-base); text-align: right; }
.trade-alert { margin-top: 12px; padding: 9px 10px; border: 1px solid rgba(254,145,63,.25); border-radius: 10px; background: rgba(254,145,63,.06); color: #e77a27; font-size: 10px; line-height: 15px; }
.trade-alert--error { border-color: rgba(255,61,85,.25); background: rgba(255,61,85,.05); color: var(--color-down); }

.trade-primary { display: flex; width: 100%; height: 48px; align-items: center; justify-content: center; gap: 8px; margin-top: 17px; border-radius: 14px; background: linear-gradient(115deg, #f39745, #f0782a); color: #fff; font-size: 13px; font-weight: 750; box-shadow: 0 12px 28px rgba(240,120,42,.22); transition: transform 160ms ease, opacity 160ms ease; }
.trade-card--sell .trade-primary { background: linear-gradient(115deg, #ff5c70, #e6374d); box-shadow: 0 12px 28px rgba(230,55,77,.2); }
.trade-primary:hover:not(:disabled) { transform: translateY(-1px); }
.trade-primary.disabled { background: var(--grey-normal); box-shadow: none; opacity: .55; }
.trade-primary.quoting { opacity: .78; cursor: wait; }
.trade-primary svg { width: 18px; height: 18px; }
.button-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%; animation: button-spin 700ms linear infinite; }
.trade-error { margin-top: 10px; color: var(--color-down); font-size: 10px; line-height: 15px; word-break: break-word; }
.tx-link { display: inline-block; margin-top: 10px; color: #e77a27; font-size: 10px; font-weight: 700; }
.trade-note { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; color: var(--text-muted); font-size: 9px; }
.trade-note svg { width: 14px; height: 14px; }
@keyframes button-spin { to { transform: rotate(360deg); } }
</style>
