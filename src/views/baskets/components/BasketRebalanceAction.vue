<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getAddress, isAddress } from 'viem'
import type { BasketDetail } from '@/utils/baskets/types'
import { BASKET_CHAIN_ID, BASKET_CONTRACTS } from '@/config/baskets'
import { rebalanceExecutorAbi } from '@/utils/baskets/abis'
import { friendlyBasketError } from '@/utils/baskets/trade'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useI18n } from 'vue-i18n'
import { buildRebalanceLimits } from '@/utils/baskets/rebalance'

const props = defineProps<{ detail: BasketDetail }>()
const emit = defineEmits<{ rebalanced: [] }>()
const accountStore = useAccountStore()
const chainStore = useChainStore()
const { t } = useI18n()
const now = ref(Date.now())
const state = ref<'idle' | 'quoting' | 'submitting' | 'success' | 'error'>('idle')
const errorMessage = ref('')
const slippagePct = ref('1.00')
const callerControlledSlippage = ref(false)
const capabilityLoaded = ref(false)
const timer = window.setInterval(() => { now.value = Date.now() }, 1_000)
onBeforeUnmount(() => window.clearInterval(timer))

const account = computed(() => isAddress(accountStore.ethConnectAddress)
  ? getAddress(accountStore.ethConnectAddress)
  : undefined)
const isCreator = computed(() => !!account.value && !!props.detail.deployer
  && account.value.toLowerCase() === props.detail.deployer.toLowerCase())
const maxDeviationBps = computed(() => props.detail.holdings.reduce((maximum, holding) => {
  const live = props.detail.aumUsd > 0 ? holding.valueUsd / props.detail.aumUsd * 100 : 0
  return Math.max(maximum, Math.round(Math.abs(live - holding.targetWeightPct) * 100))
}, 0))
const requiresRebalance = computed(() => maxDeviationBps.value > 300)
// The deployed executor derives its minimum from the fee-exclusive reference price
// and permits only 3% slippage. A >=3% venue fee therefore cannot satisfy that minimum.
const incompatibleHoldings = computed(() => props.detail.holdings.filter((holding) => {
  const fee = holding.route.venue === 2 ? 0 : holding.route.venue === 0 ? holding.route.v4Pool.fee : holding.route.v3Fee
  const live = props.detail.aumUsd > 0 ? holding.valueUsd / props.detail.aumUsd * 100 : 0
  return !callerControlledSlippage.value && fee >= 30_000 && Math.abs(live - holding.targetWeightPct) > 0.0001
}))
const cooldownEnd = computed(() => (props.detail.lastRebalanceAt + 3_600) * 1_000)
const cooldownRemaining = computed(() => Math.max(0, Math.ceil((cooldownEnd.value - now.value) / 1_000)))
const canRebalance = computed(() => isCreator.value && requiresRebalance.value && cooldownRemaining.value === 0
  && props.detail.fullyPriced && (props.detail.effectiveSupply ?? 0) > 0
  && capabilityLoaded.value
  && incompatibleHoldings.value.length === 0
  && chainStore.activeChainId === BASKET_CHAIN_ID && state.value !== 'quoting' && state.value !== 'submitting')

const rebalanceError = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error)
  if (/SlippageExceeded|0x8199f5f3/i.test(text)) return t('baskets.rebalanceSlippageError')
  if (/RebalanceCooldown|0xccfe2c65/i.test(text)) return t('baskets.rebalanceCooldownError')
  if (/RebalanceNotNeeded/i.test(text)) return t('baskets.rebalanceNotNeededError')
  if (/RebalanceOutOfTolerance/i.test(text)) return t('baskets.rebalanceToleranceError')
  if (/RebalanceNavLoss/i.test(text)) return t('baskets.rebalanceNavLossError')
  if (/OnlyBasketCreator/i.test(text)) return t('baskets.rebalanceCreatorError')
  return friendlyBasketError(error)
}

const rebalance = async () => {
  if (!account.value || !canRebalance.value) return
  state.value = 'quoting'
  errorMessage.value = ''
  try {
    const slippageBps = Math.min(10_000, Math.max(0, Math.round(Number(slippagePct.value || 0) * 100)))
    const { minWethOut, minAssetOut } = await buildRebalanceLimits(props.detail, slippageBps)
    state.value = 'submitting'
    const client = getReadOnlyClient(BASKET_CHAIN_ID)
    const wallet = getWalletClient()
    if (!wallet) throw new Error('Wallet not connected')
    const { request } = await client.simulateContract({
      account: account.value,
      address: BASKET_CONTRACTS.rebalanceExecutor,
      abi: rebalanceExecutorAbi,
      functionName: 'rebalance',
      args: [props.detail.address, minWethOut, minAssetOut],
    })
    const hash = await wallet.writeContract(request)
    if (!await waitForTx(hash)) throw new Error('Rebalance failed')
    state.value = 'success'
    emit('rebalanced')
  } catch (error) {
    state.value = 'error'
    errorMessage.value = rebalanceError(error)
  }
}

const onSlippageInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value.replace(/[^\d.]/g, '')
  const [whole = '', ...fraction] = value.split('.')
  slippagePct.value = fraction.length ? `${whole}.${fraction.join('').slice(0, 2)}` : whole
}

onMounted(async () => {
  try {
    callerControlledSlippage.value = await getReadOnlyClient(BASKET_CHAIN_ID).readContract({
      address: BASKET_CONTRACTS.rebalanceExecutor,
      abi: rebalanceExecutorAbi,
      functionName: 'CALLER_CONTROLLED_SLIPPAGE',
    })
  } catch {
    callerControlledSlippage.value = false
  } finally {
    capabilityLoaded.value = true
  }
})
</script>

<template>
  <div v-if="isCreator" class="rebalance-status" :class="{ alert: requiresRebalance }">
    <div>
      <span>{{ $t('baskets.maxWeightDeviation') }}</span>
      <strong>{{ (maxDeviationBps / 100).toFixed(2) }}%</strong>
      <small v-if="incompatibleHoldings.length">
        {{ $t('baskets.rebalanceHighFeeBlocked', { assets: incompatibleHoldings.map((item) => item.symbol).join(', ') }) }}
      </small>
      <small v-else>{{ requiresRebalance ? $t('baskets.rebalanceAvailable') : $t('baskets.weightsHealthy') }}</small>
    </div>
    <button v-if="isCreator && requiresRebalance" type="button" :disabled="!canRebalance" @click="rebalance">
      <template v-if="state === 'quoting'">{{ $t('baskets.rebalanceQuoting') }}</template>
      <template v-else-if="state === 'submitting'">{{ $t('baskets.rebalancing') }}</template>
      <template v-else-if="incompatibleHoldings.length">{{ $t('baskets.rebalanceUnavailable') }}</template>
      <template v-else-if="cooldownRemaining">{{ $t('baskets.rebalanceCooldown', { minutes: Math.ceil(cooldownRemaining / 60) }) }}</template>
      <template v-else>{{ $t('baskets.rebalance') }}</template>
    </button>
    <label v-if="isCreator && requiresRebalance && callerControlledSlippage" class="slippage-input">
      <span>{{ $t('baskets.rebalanceSlippage') }}</span>
      <input :value="slippagePct" inputmode="decimal" @input="onSlippageInput"><b>%</b>
    </label>
    <p v-if="errorMessage">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.rebalance-status { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 24px 18px; padding:13px 14px; border:1px solid var(--border-base); border-radius:15px; background:var(--surface-2); }
.rebalance-status > div { display:grid; grid-template-columns:auto auto; gap:2px 9px; align-items:center; }
.rebalance-status span,.rebalance-status small { color:var(--text-muted); font-size:10px; }
.rebalance-status strong { font-size:13px; color:var(--text-base); }
.rebalance-status small { grid-column:1/-1; }
.rebalance-status.alert { border-color:rgba(239,123,69,.35); background:rgba(239,123,69,.07); }
.rebalance-status button { flex-shrink:0; padding:9px 13px; border-radius:11px; background:linear-gradient(135deg,#7d67ef,#31b9cf); color:#fff; font-size:11px; font-weight:700; }
.rebalance-status button:disabled { cursor:not-allowed; opacity:.48; }
.rebalance-status > p { width:100%; color:var(--color-red,#ef596f); font-size:10px; }
.slippage-input { display:flex; align-items:center; gap:6px; margin-left:auto; color:var(--text-muted); font-size:9px; }
.slippage-input input { width:55px; padding:7px 6px; border:1px solid var(--border-base); border-radius:9px; background:var(--surface); color:var(--text-base); text-align:right; font-size:10px; }
@media(max-width:600px){.rebalance-status{margin:0 20px 16px;align-items:flex-start;flex-wrap:wrap}.rebalance-status button{margin-left:auto}}
</style>
