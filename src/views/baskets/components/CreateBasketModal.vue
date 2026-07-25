<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatUnits, getAddress, isAddress, parseUnits, zeroAddress, type Address } from 'viem'
import { BASKET_ASSET_PRESETS, BASKET_CHAIN_ID, BASKET_MAX_SLIPPAGE_BPS, BASKET_USDG_DECIMALS } from '@/config/baskets'
import { ROBINHOOD_CHAIN, ROBINHOOD_TIPTAG_HOOK_FEE_PIPS } from '@/config/chains'
import {
  buildCustomRoute,
  createBasketAndBuy,
  getBasketUsdgBalance,
  presetCreateLeg,
  validateCustomBasketAsset,
  type CreateBasketLeg,
} from '@/utils/baskets/create'
import { discoverBasketPools, type BasketPoolCandidate } from '@/utils/baskets/pool-discovery'
import { invalidateBasketCache } from '@/utils/baskets/data'
import { registerBasketDeployment } from '@/utils/baskets/api'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [address: Address] }>()
const router = useRouter()
const { t } = useI18n()
const accountStore = useAccountStore()
const chainStore = useChainStore()
const modalStore = useModalStore()

const BASKET_DRAFT_KEY = `tagai-basket-create-draft-v1:${BASKET_CHAIN_ID}`

const name = ref('')
const symbol = ref('')
const basketFeeBps = ref(100)
const creatorShareBps = ref(3000)
const initialUsdg = ref('10')
const slippageBps = ref(100)
const selected = ref<CreateBasketLeg[]>([])
const advancedOpen = ref(false)
const customAssetOpen = ref(false)
const customAssetAddress = ref('')
const customPoolCandidates = ref<BasketPoolCandidate[]>([])
const selectedPoolId = ref('')
const searchingPools = ref(false)
const validatingAsset = ref(false)
const customAssetError = ref('')
const state = ref<'idle' | 'approving' | 'creating' | 'success'>('idle')
const errorMessage = ref('')
const draftReady = ref(false)
const usdgBalance = ref<bigint | null>(null)
const loadingUsdgBalance = ref(false)
let balanceRequestId = 0

const account = computed(() => isAddress(accountStore.ethConnectAddress) ? getAddress(accountStore.ethConnectAddress) : undefined)
const isOnRh = computed(() => chainStore.activeChainId === BASKET_CHAIN_ID)
const totalWeight = computed(() => selected.value.reduce((sum, leg) => sum + Number(leg.weightBps || 0), 0))
const isBusy = computed(() => state.value === 'approving' || state.value === 'creating')
const initialUsdgRaw = computed(() => {
  try {
    return parseUnits(initialUsdg.value || '0', BASKET_USDG_DECIMALS)
  } catch {
    return null
  }
})
const insufficientUsdg = computed(() =>
  usdgBalance.value !== null && initialUsdgRaw.value !== null && initialUsdgRaw.value > usdgBalance.value)
const formattedUsdgBalance = computed(() => {
  if (loadingUsdgBalance.value) return t('baskets.loadingUsdgBalance')
  if (usdgBalance.value === null) return '—'
  return Number(formatUnits(usdgBalance.value, BASKET_USDG_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: BASKET_USDG_DECIMALS,
  })
})
const platformAssets = computed(() => BASKET_ASSET_PRESETS.filter((asset) => asset.category === 'platform'))
const stockAssets = computed(() => BASKET_ASSET_PRESETS.filter((asset) => asset.category === 'stock'))
const canSubmit = computed(() =>
  !!account.value && isOnRh.value && name.value.trim().length >= 2 && symbol.value.trim().length >= 2 &&
  selected.value.length > 0 && totalWeight.value === 10_000 && Number(initialUsdg.value) > 1 &&
  !insufficientUsdg.value &&
  basketFeeBps.value >= 100 && basketFeeBps.value <= 300 && creatorShareBps.value >= 0 && creatorShareBps.value <= 3000,
)

const isSelected = (address: Address) => selected.value.some((leg) => leg.asset.address.toLowerCase() === address.toLowerCase())
const formatUsd = (value: number) => new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'USD',
}).format(value)
const formatPoolFee = (fee: number) => `${(fee / 10_000).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`
const effectiveV4PoolFee = (fee: number, hooks: Address) =>
  hooks.toLowerCase() === ROBINHOOD_CHAIN.contracts.tipTagSwapHook9.toLowerCase()
    ? ROBINHOOD_TIPTAG_HOOK_FEE_PIPS
    : fee
const presetPoolFee = (asset: typeof BASKET_ASSET_PRESETS[number]) => asset.route.venue === 0
  ? effectiveV4PoolFee(asset.route.v4Pool.fee, asset.route.v4Pool.hooks)
  : asset.route.v3Fee
const presetPoolLabel = (asset: typeof BASKET_ASSET_PRESETS[number]) =>
  asset.route.venue === 2
    ? 'WETH · 1:1'
    : `V${asset.route.venue === 0 ? '4' : '3'} · ${t('baskets.fee')} ${formatPoolFee(presetPoolFee(asset))}`
const candidatePoolFee = (pool: BasketPoolCandidate) => pool.venue === 0
  ? effectiveV4PoolFee(pool.fee, pool.hooks)
  : pool.fee
const shortPoolId = (value: string) => value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value
const shortAddress = (value: Address) => `${value.slice(0, 8)}…${value.slice(-6)}`
const formatPoolDate = (value: string) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp) : '—'
}
const legPoolFee = (leg: CreateBasketLeg) => {
  if (leg.route.venue === 2) return 0
  if (leg.route.venue !== 0) return leg.route.v3Fee
  return effectiveV4PoolFee(leg.route.v4Pool.fee, leg.route.v4Pool.hooks)
}

const rebalanceEqual = () => {
  const count = selected.value.length
  if (!count) return
  const base = Math.floor(10_000 / count)
  selected.value.forEach((leg, index) => {
    leg.weightBps = index === count - 1 ? 10_000 - base * (count - 1) : base
  })
}

const toggleAsset = (address: Address) => {
  if (isBusy.value) return
  const index = selected.value.findIndex((leg) => leg.asset.address.toLowerCase() === address.toLowerCase())
  if (index >= 0) selected.value.splice(index, 1)
  else {
    const asset = BASKET_ASSET_PRESETS.find((item) => item.address.toLowerCase() === address.toLowerCase())
    if (asset && selected.value.length < 10) selected.value.push(presetCreateLeg(asset))
  }
  rebalanceEqual()
}

const removeAsset = (address: Address) => {
  if (isBusy.value) return
  const index = selected.value.findIndex((leg) => leg.asset.address.toLowerCase() === address.toLowerCase())
  if (index < 0) return
  selected.value.splice(index, 1)
  rebalanceEqual()
}

const searchCustomPools = async () => {
  customAssetError.value = ''
  customPoolCandidates.value = []
  selectedPoolId.value = ''
  if (selected.value.length >= 10) {
    customAssetError.value = t('baskets.customAssetLimit')
    return
  }
  if (!isAddress(customAssetAddress.value)) {
    customAssetError.value = t('baskets.customAssetInvalid')
    return
  }
  const address = getAddress(customAssetAddress.value)
  if (isSelected(address)) {
    customAssetError.value = t('baskets.customAssetDuplicate')
    return
  }
  try {
    searchingPools.value = true
    customPoolCandidates.value = await discoverBasketPools(address, 2)
    selectedPoolId.value = customPoolCandidates.value[0]?.id ?? ''
    if (!customPoolCandidates.value.length) customAssetError.value = t('baskets.noCompatiblePools')
  } catch (error) {
    customAssetError.value = error instanceof Error ? error.message : String(error)
  } finally {
    searchingPools.value = false
  }
}

const addCustomAsset = async () => {
  customAssetError.value = ''
  if (!isAddress(customAssetAddress.value)) {
    customAssetError.value = t('baskets.customAssetInvalid')
    return
  }
  const address = getAddress(customAssetAddress.value)
  const candidate = customPoolCandidates.value.find((pool) => pool.id === selectedPoolId.value)
  if (!candidate) {
    customAssetError.value = t('baskets.selectPool')
    return
  }
  try {
    validatingAsset.value = true
    const asset = await validateCustomBasketAsset({ asset: address, route: candidate.route })
    selected.value.push({ asset, route: candidate.route, weightBps: 0 })
    rebalanceEqual()
    customAssetAddress.value = ''
    customPoolCandidates.value = []
    selectedPoolId.value = ''
  } catch (error) {
    customAssetError.value = error instanceof Error ? error.message : String(error)
  } finally {
    validatingAsset.value = false
  }
}

const draftNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const removeSavedDraft = () => {
  try {
    localStorage.removeItem(BASKET_DRAFT_KEY)
  } catch (error) {
    console.warn('Basket draft could not be removed', error)
  }
}

const restoreDraftLeg = (value: any): CreateBasketLeg | null => {
  if (!value || !isAddress(value.asset?.address) || typeof value.asset?.symbol !== 'string') return null
  const address = getAddress(value.asset.address)
  const preset = BASKET_ASSET_PRESETS.find(item => item.address.toLowerCase() === address.toLowerCase())
  let leg: CreateBasketLeg
  if (preset) {
    leg = presetCreateLeg(preset)
  } else if (value.route?.venue === 0 && value.route.v4Pool && isAddress(value.route.v4Pool.hooks)) {
    const fee = draftNumber(value.route.v4Pool.fee, -1)
    const tickSpacing = draftNumber(value.route.v4Pool.tickSpacing, 0)
    if (!Number.isInteger(fee) || fee < 0 || fee > 0xffffff ||
      !Number.isInteger(tickSpacing) || tickSpacing < -0x800000 || tickSpacing > 0x7fffff) return null
    leg = {
      asset: { address, symbol: value.asset.symbol.slice(0, 32) },
      route: buildCustomRoute({
        asset: address,
        venue: 0,
        fee,
        tickSpacing,
        hooks: getAddress(value.route.v4Pool.hooks),
      }),
      weightBps: 0,
    }
  } else if (value.route?.venue === 1) {
    const fee = draftNumber(value.route.v3Fee, -1)
    if (!Number.isInteger(fee) || fee <= 0 || fee > 0xffffff) return null
    leg = {
      asset: { address, symbol: value.asset.symbol.slice(0, 32) },
      route: buildCustomRoute({ asset: address, venue: 1, fee }),
      weightBps: 0,
    }
  } else return null
  leg.weightBps = draftNumber(value.weightBps, 0)
  if (value.slippageBps !== undefined) leg.slippageBps = draftNumber(value.slippageBps, slippageBps.value)
  return leg
}

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(BASKET_DRAFT_KEY)
    if (!raw) return
    const draft = JSON.parse(raw)
    name.value = typeof draft.name === 'string' ? draft.name.slice(0, 48) : ''
    symbol.value = typeof draft.symbol === 'string' ? draft.symbol.slice(0, 12).toUpperCase() : ''
    basketFeeBps.value = draftNumber(draft.basketFeeBps, 100)
    creatorShareBps.value = draftNumber(draft.creatorShareBps, 3000)
    initialUsdg.value = typeof draft.initialUsdg === 'string' || typeof draft.initialUsdg === 'number'
      ? String(draft.initialUsdg)
      : '10'
    slippageBps.value = draftNumber(draft.slippageBps, 100)
    selected.value = Array.isArray(draft.selected)
      ? draft.selected.map(restoreDraftLeg).filter((leg: CreateBasketLeg | null): leg is CreateBasketLeg => !!leg).slice(0, 10)
      : []
    advancedOpen.value = !!draft.advancedOpen
    customAssetOpen.value = !!draft.customAssetOpen
    customAssetAddress.value = typeof draft.customAssetAddress === 'string' ? draft.customAssetAddress.slice(0, 42) : ''
  } catch {
    removeSavedDraft()
  }
}

const persistDraft = () => {
  if (!draftReady.value) return
  try {
    localStorage.setItem(BASKET_DRAFT_KEY, JSON.stringify({
      name: name.value,
      symbol: symbol.value,
      basketFeeBps: basketFeeBps.value,
      creatorShareBps: creatorShareBps.value,
      initialUsdg: initialUsdg.value,
      slippageBps: slippageBps.value,
      selected: selected.value,
      advancedOpen: advancedOpen.value,
      customAssetOpen: customAssetOpen.value,
      customAssetAddress: customAssetAddress.value,
    }))
  } catch (error) {
    console.warn('Basket draft could not be saved', error)
  }
}

const clearDraftAfterSuccess = async () => {
  draftReady.value = false
  removeSavedDraft()
  name.value = ''
  symbol.value = ''
  basketFeeBps.value = 100
  creatorShareBps.value = 3000
  initialUsdg.value = '10'
  slippageBps.value = 100
  selected.value = []
  advancedOpen.value = false
  customAssetOpen.value = false
  customAssetAddress.value = ''
  customPoolCandidates.value = []
  selectedPoolId.value = ''
  await nextTick()
  removeSavedDraft()
  draftReady.value = true
}

const connectWallet = () => modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)

const updateInitialUsdg = (event: Event) => {
  initialUsdg.value = (event.target as HTMLInputElement).value
}

const loadUsdgBalance = async () => {
  const requestId = ++balanceRequestId
  if (!props.modelValue || !account.value || !isOnRh.value) {
    usdgBalance.value = null
    loadingUsdgBalance.value = false
    return
  }
  loadingUsdgBalance.value = true
  try {
    const balance = await getBasketUsdgBalance(account.value)
    if (requestId === balanceRequestId) usdgBalance.value = balance
  } catch {
    if (requestId === balanceRequestId) usdgBalance.value = null
  } finally {
    if (requestId === balanceRequestId) loadingUsdgBalance.value = false
  }
}

const close = () => {
  if (!isBusy.value) emit('update:modelValue', false)
}

const submit = async () => {
  errorMessage.value = ''
  if (!account.value) {
    connectWallet()
    return
  }
  if (!canSubmit.value) {
    errorMessage.value = insufficientUsdg.value ? t('baskets.insufficientUsdg') : t('baskets.createValidation')
    return
  }
  try {
    state.value = 'creating'
    const result = await createBasketAndBuy({
      name: name.value,
      symbol: symbol.value,
      basketFeeBps: basketFeeBps.value,
      creatorShareBps: creatorShareBps.value,
      initialUsdg: initialUsdg.value,
      slippageBps: slippageBps.value,
      legs: selected.value,
    }, account.value, () => {
      state.value = 'approving'
    }, () => {
      state.value = 'creating'
    })
    state.value = 'success'
    try {
      await registerBasketDeployment(result.basket, result.hash)
    } catch (error) {
      // The on-chain creation is already final. Keep the successful UX while
      // making the indexing failure visible to local/prod diagnostics.
      console.error('Basket was created on-chain but API registration failed', error)
    }
    invalidateBasketCache()
    await clearDraftAfterSuccess()
    emit('created', result.basket)
    emit('update:modelValue', false)
    await router.push(`/baskets/${result.basket}`)
  } catch (error) {
    state.value = 'idle'
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    draftReady.value = false
    loadDraft()
    await nextTick()
    draftReady.value = true
    errorMessage.value = ''
    state.value = 'idle'
  }
}, { immediate: true })

watch(customAssetAddress, () => {
  customPoolCandidates.value = []
  selectedPoolId.value = ''
  customAssetError.value = ''
})

watch([() => props.modelValue, account, isOnRh], loadUsdgBalance, { immediate: true })

watch([
  name, symbol, basketFeeBps, creatorShareBps, initialUsdg, slippageBps, selected,
  advancedOpen, customAssetOpen, customAssetAddress,
], persistDraft, { deep: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="basket-modal">
      <div v-if="modelValue" class="modal-backdrop" @mousedown.self="close">
        <section class="create-modal" role="dialog" aria-modal="true" :aria-label="$t('baskets.createTitle')">
          <header class="modal-header">
            <div>
              <span>ROBINHOOD · BASKET V1</span>
              <h2>{{ $t('baskets.createTitle') }}</h2>
              <p>{{ $t('baskets.createSubtitle') }}</p>
            </div>
            <button type="button" class="close-button" :disabled="isBusy" @click="close" aria-label="Close">
              <svg viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
            </button>
          </header>

          <div class="modal-body">
            <section class="form-section">
              <div class="section-title"><b>01</b><div><strong>{{ $t('baskets.createIdentity') }}</strong><span>{{ $t('baskets.createIdentityHint') }}</span></div></div>
              <div class="two-cols">
                <label class="field"><span>{{ $t('baskets.createName') }}</span><input v-model="name" maxlength="48" placeholder="Tech Momentum Basket" :disabled="isBusy"></label>
                <label class="field"><span>{{ $t('baskets.createSymbol') }}</span><input v-model="symbol" maxlength="12" placeholder="TECHX" :disabled="isBusy" @input="symbol = symbol.toUpperCase()"></label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-title"><b>02</b><div><strong>{{ $t('baskets.chooseAssets') }}</strong><span>{{ $t('baskets.chooseAssetsHint') }}</span></div><em>{{ selected.length }}/10</em></div>
              <div class="asset-group-label">{{ $t('baskets.platformAssets') }}</div>
              <div class="asset-grid asset-grid--platform">
                <button
                  v-for="asset in platformAssets"
                  :key="asset.address"
                  type="button"
                  class="asset-option"
                  :class="{ selected: isSelected(asset.address) }"
                  :disabled="isBusy"
                  @click="toggleAsset(asset.address)"
                >
                  <i :class="{ 'has-logo': asset.logoUrl, 'platform-logo': asset.symbol === 'TagAgent' }"><img v-if="asset.logoUrl" :src="asset.logoUrl" alt=""><template v-else>{{ asset.symbol.slice(0, 2) }}</template></i>
                  <span class="asset-option__copy"><span class="asset-option__title"><strong>{{ asset.symbol }}</strong><em>{{ presetPoolLabel(asset) }}</em></span><small>{{ asset.name }}</small></span>
                  <svg v-if="isSelected(asset.address)" viewBox="0 0 20 20" fill="none"><path d="m5 10 3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
              </div>
              <div class="asset-group-label asset-group-label--stocks">{{ $t('baskets.stockAssets') }}</div>
              <div class="asset-grid asset-grid--stocks">
                <button
                  v-for="asset in stockAssets"
                  :key="asset.address"
                  type="button"
                  class="asset-option"
                  :class="{ selected: isSelected(asset.address) }"
                  :disabled="isBusy"
                  @click="toggleAsset(asset.address)"
                >
                  <i :class="{ 'has-logo': asset.logoUrl }"><img v-if="asset.logoUrl" :src="asset.logoUrl" alt=""><template v-else>{{ asset.symbol.slice(0, 2) }}</template></i>
                  <span class="asset-option__copy"><span class="asset-option__title"><strong>{{ asset.symbol }}</strong><em>{{ presetPoolLabel(asset) }}</em></span><small>{{ asset.name }}</small></span>
                  <svg v-if="isSelected(asset.address)" viewBox="0 0 20 20" fill="none"><path d="m5 10 3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
              </div>

              <button type="button" class="advanced-toggle custom-toggle" :class="{ open: customAssetOpen }" :disabled="isBusy" @click="customAssetOpen = !customAssetOpen">
                <span>{{ $t('baskets.customAsset') }}</span>
                <svg viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <Transition name="advanced">
                <div v-if="customAssetOpen" class="advanced-panel custom-asset-panel">
                  <p>{{ $t('baskets.customAssetHint') }}</p>
                  <div class="custom-search-row">
                    <label class="field custom-address"><span>{{ $t('baskets.assetAddress') }}</span><input v-model.trim="customAssetAddress" placeholder="0x…" :disabled="isBusy || searchingPools || validatingAsset" @keyup.enter="searchCustomPools"></label>
                    <button type="button" class="pool-search" :disabled="isBusy || searchingPools || validatingAsset" @click="searchCustomPools">
                      <span v-if="searchingPools" class="spinner" />{{ searchingPools ? $t('baskets.searchingPools') : $t('baskets.searchPools') }}
                    </button>
                  </div>
                  <div v-if="customPoolCandidates.length" class="pool-candidates">
                    <button
                      v-for="pool in customPoolCandidates"
                      :key="pool.id"
                      type="button"
                      class="pool-candidate"
                      :class="{ selected: selectedPoolId === pool.id }"
                      @click="selectedPoolId = pool.id"
                    >
                      <span class="pool-candidate__head">
                        <span><b>{{ pool.label }} · {{ pool.pairLabel }}</b><em>{{ $t('baskets.fee') }} {{ formatPoolFee(candidatePoolFee(pool)) }}</em></span>
                        <i aria-hidden="true" />
                      </span>
                      <span class="pool-candidate__stats">
                        <span><small>{{ $t('baskets.poolLiquidity') }}</small><strong>{{ formatUsd(pool.liquidityUsd) }}</strong></span>
                        <span><small>{{ $t('baskets.poolVolume24h') }}</small><strong>{{ formatUsd(pool.volume24h) }}</strong></span>
                        <span><small>{{ $t('baskets.poolTransactions24h') }}</small><strong>{{ pool.txCount24h.toLocaleString() }}</strong></span>
                      </span>
                      <span class="pool-candidate__details">
                        <span><small>{{ pool.venue === 0 ? $t('baskets.poolId') : $t('baskets.poolAddress') }}</small><code :title="pool.id">{{ shortPoolId(pool.id) }}</code></span>
                        <span v-if="pool.venue === 0"><small>{{ $t('baskets.tickSpacing') }}</small><code>{{ pool.tickSpacing }}</code></span>
                        <span v-if="pool.venue === 0"><small>{{ $t('baskets.poolHookShort') }}</small><code :title="pool.hooks">{{ pool.hooks === zeroAddress ? $t('baskets.noHook') : shortAddress(pool.hooks) }}</code></span>
                        <span v-else><small>{{ $t('baskets.poolCreated') }}</small><code>{{ formatPoolDate(pool.createdAt) }}</code></span>
                      </span>
                    </button>
                  </div>
                  <p v-if="customAssetError" class="custom-error">{{ customAssetError }}</p>
                  <button v-if="customPoolCandidates.length" type="button" class="validate-route" :disabled="isBusy || validatingAsset || !selectedPoolId" @click="addCustomAsset">
                    <span v-if="validatingAsset" class="spinner" />{{ validatingAsset ? $t('baskets.validatingRoute') : $t('baskets.validateAndAdd') }}
                  </button>
                </div>
              </Transition>

              <div v-if="selected.length" class="weights-panel">
                <div class="weights-head"><span>{{ $t('baskets.targetWeights') }}</span><strong :class="{ invalid: totalWeight !== 10000 }">{{ (totalWeight / 100).toFixed(2) }}%</strong></div>
                <div v-for="leg in selected" :key="leg.asset.address" class="weight-row">
                  <strong>{{ leg.asset.symbol }}</strong>
                  <input v-model.number="leg.weightBps" type="number" min="1" max="10000" :disabled="isBusy">
                  <span>bps</span>
                  <button
                    type="button"
                    class="remove-asset-button"
                    :aria-label="`${$t('baskets.removeAsset')} ${leg.asset.symbol}`"
                    :title="`${$t('baskets.removeAsset')} ${leg.asset.symbol}`"
                    :disabled="isBusy"
                    @click="removeAsset(leg.asset.address)"
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
                    <span>{{ $t('baskets.removeAsset') }}</span>
                  </button>
                </div>
                <button type="button" class="equal-button" :disabled="isBusy" @click="rebalanceEqual">{{ $t('baskets.equalWeights') }}</button>
              </div>
            </section>

            <section class="form-section">
              <div class="section-title"><b>03</b><div><strong>{{ $t('baskets.feesAndLaunch') }}</strong><span>{{ $t('baskets.feesAndLaunchHint') }}</span></div></div>
              <div class="two-cols">
                <label class="field"><span>{{ $t('baskets.tradeFeeBps') }}</span><input v-model.number="basketFeeBps" type="number" min="100" max="300" :disabled="isBusy"><small>100–300 bps</small></label>
                <label class="field"><span>{{ $t('baskets.creatorShareBps') }}</span><input v-model.number="creatorShareBps" type="number" min="0" max="3000" :disabled="isBusy"><small>0–3000 bps</small></label>
                <label class="field" :class="{ 'balance-invalid': insufficientUsdg }"><span class="field-heading"><span>{{ $t('baskets.initialBuy') }}</span><em>{{ $t('baskets.usdgBalance') }}: {{ formattedUsdgBalance }}</em></span><input :value="initialUsdg" type="number" min="1.01" step="any" :disabled="isBusy" @input="updateInitialUsdg"><small>USDG</small></label>
                <label class="field"><span>{{ $t('baskets.slippage') }}</span><input v-model.number="slippageBps" type="number" min="1" :max="BASKET_MAX_SLIPPAGE_BPS" :disabled="isBusy"><small>bps</small></label>
              </div>
              <button type="button" class="advanced-toggle" :class="{ open: advancedOpen }" :disabled="isBusy || !selected.length" @click="advancedOpen = !advancedOpen">
                <span>{{ $t('baskets.advancedSlippage') }}</span>
                <svg viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <Transition name="advanced">
                <div v-if="advancedOpen && selected.length" class="advanced-panel">
                  <p>{{ $t('baskets.advancedSlippageHint', { bps: slippageBps }) }}</p>
                  <div v-for="leg in selected" :key="`slippage-${leg.asset.address}`" class="leg-slippage-row">
                    <div class="leg-slippage-asset">
                      <strong>{{ leg.asset.symbol }}</strong>
                      <em>{{ $t('baskets.fixedPoolFee') }} {{ formatPoolFee(legPoolFee(leg)) }}</em>
                    </div>
                    <label>
                      <input
                        :value="leg.slippageBps ?? slippageBps"
                        type="number"
                        min="1"
                        :max="BASKET_MAX_SLIPPAGE_BPS"
                        :disabled="isBusy"
                        @input="leg.slippageBps = Number(($event.target as HTMLInputElement).value)"
                      >
                      <span>bps</span>
                    </label>
                    <button v-if="leg.slippageBps !== undefined" type="button" @click="leg.slippageBps = undefined">{{ $t('baskets.inherit') }}</button>
                  </div>
                </div>
              </Transition>
              <p class="atomic-note"><svg viewBox="0 0 20 20" fill="none"><path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-10v3.5m0 2.5v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>{{ $t('baskets.atomicCreateHint') }}</p>
            </section>
          </div>

          <footer class="modal-footer">
            <p v-if="errorMessage" class="create-error">{{ errorMessage }}</p>
            <button type="button" class="create-submit" :disabled="isBusy || (!!account && !canSubmit)" @click="submit">
              <span v-if="isBusy" class="spinner" />
              <span v-if="!account">{{ $t('connect') }}</span>
              <span v-else-if="state === 'approving'">{{ $t('baskets.approvingUsdg') }}</span>
              <span v-else-if="state === 'creating'">{{ $t('baskets.creating') }}</span>
              <span v-else>{{ $t('baskets.createAndBuy') }}</span>
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop { position: fixed; z-index: 2000; inset: 0; display: grid; place-items: center; padding: 22px; background: rgba(5,7,12,.72); backdrop-filter: blur(12px); }
.create-modal { display: flex; width: min(780px, 100%); max-height: min(900px, calc(100vh - 44px)); flex-direction: column; overflow: hidden; border: 1px solid var(--border-base); border-radius: 28px; background: var(--surface); box-shadow: 0 28px 100px rgba(0,0,0,.38); }
.modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 26px 28px 22px; border-bottom: 1px solid var(--border-base); background: radial-gradient(circle at 85% 0, rgba(141,103,232,.12), transparent 46%); }
.modal-header span { color: #8d67e8; font-size: 9px; font-weight: 800; letter-spacing: .16em; }
.modal-header h2 { margin-top: 7px; color: var(--text-base); font-size: 27px; font-weight: 760; letter-spacing: -.04em; }
.modal-header p { margin-top: 6px; color: var(--text-muted); font-size: 12px; }
.close-button { display: grid; width: 38px; height: 38px; flex-shrink: 0; place-items: center; border: 1px solid var(--border-base); border-radius: 12px; background: var(--surface-2); color: var(--text-muted); }
.close-button svg { width: 18px; height: 18px; }
.modal-body { overflow-y: auto; padding: 4px 28px 26px; }
.form-section { padding-top: 24px; }
.section-title { display: flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.section-title b { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(240,120,42,.25); border-radius: 10px; background: rgba(240,120,42,.07); color: #f0782a; font-size: 10px; }
.section-title > div { min-width: 0; flex: 1; }
.section-title strong, .section-title span { display: block; }
.section-title strong { color: var(--text-base); font-size: 14px; }
.section-title span { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 15px; }
.section-title em { color: var(--text-muted); font-size: 10px; font-style: normal; }
.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { position: relative; display: block; padding: 11px 13px; border: 1px solid var(--border-base); border-radius: 14px; background: var(--surface-2); }
.field > span { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 9px; font-weight: 650; text-transform: uppercase; letter-spacing: .08em; }
.field > span.field-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.field-heading em { overflow: hidden; color: var(--text-faint); font-size: 8px; font-style: normal; font-weight: 600; letter-spacing: 0; text-overflow: ellipsis; text-transform: none; white-space: nowrap; }
.field.balance-invalid { border-color: color-mix(in srgb, var(--color-down) 55%, var(--border-base)); }
.field.balance-invalid .field-heading em { color: var(--color-down); }
.field input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 14px; font-weight: 650; }
.field select { width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); font-size: 13px; font-weight: 650; }
.field small { position: absolute; right: 12px; bottom: 12px; color: var(--text-faint); font-size: 9px; pointer-events: none; }
.asset-group-label { margin-bottom: 7px; color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.asset-group-label--stocks { margin-top: 14px; }
.asset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.asset-grid--platform { grid-template-columns: repeat(2, minmax(0, 240px)); }
.asset-grid--stocks { max-height: 214px; overflow-y: auto; padding: 1px 2px 2px 1px; }
.asset-option { display: flex; min-width: 0; align-items: center; gap: 9px; padding: 10px; border: 1px solid var(--border-base); border-radius: 13px; background: var(--surface-2); text-align: left; transition: border-color 150ms ease, transform 150ms ease; }
.asset-option:hover { transform: translateY(-1px); }
.asset-option.selected { border-color: rgba(141,103,232,.55); background: rgba(141,103,232,.08); }
.asset-option > i { display: grid; width: 31px; height: 31px; flex-shrink: 0; place-items: center; border-radius: 9px; background: linear-gradient(135deg, #e765b4, #6659d9); color: #fff; font-size: 9px; font-style: normal; font-weight: 800; }
.asset-option > i.has-logo { overflow: hidden; padding: 4px; background: #fff; }
.asset-option > i.platform-logo { padding: 0; background: #000; }
.asset-option > i img { width: 100%; height: 100%; object-fit: contain; }
.asset-option > span { min-width: 0; flex: 1; }
.asset-option__title { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 6px; }
.asset-option__title strong { min-width: 0; }
.asset-option__title em { flex-shrink: 0; color: #e77a27; font-size: 7px; font-style: normal; font-weight: 750; white-space: nowrap; }
.asset-option strong, .asset-option small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-option strong { color: var(--text-base); font-size: 11px; }
.asset-option small { margin-top: 2px; color: var(--text-muted); font-size: 8px; }
.asset-option svg { width: 17px; height: 17px; flex-shrink: 0; color: #8d67e8; }
.weights-panel { margin-top: 10px; padding: 12px; border: 1px solid var(--border-base); border-radius: 14px; }
.weights-head { display: flex; justify-content: space-between; margin-bottom: 7px; color: var(--text-muted); font-size: 9px; }
.weights-head strong { color: #42ce85; }.weights-head strong.invalid { color: var(--color-down); }
.weight-row { display: grid; grid-template-columns: minmax(90px, 1fr) 100px 28px auto; align-items: center; gap: 6px; padding: 6px 0; border-top: 1px solid color-mix(in srgb, var(--border-base) 70%, transparent); }
.weight-row strong { color: var(--text-base); font-size: 10px; }.weight-row input { width: 100%; border: 1px solid var(--border-base); border-radius: 8px; background: var(--surface-2); color: var(--text-base); padding: 6px 8px; text-align: right; }.weight-row span { color: var(--text-muted); font-size: 9px; }
.remove-asset-button { display: inline-flex; height: 28px; align-items: center; justify-content: center; gap: 3px; padding: 0 7px; border: 1px solid color-mix(in srgb, var(--color-down) 30%, var(--border-base)); border-radius: 8px; color: var(--color-down); font-size: 8px; font-weight: 700; transition: border-color 150ms ease, background 150ms ease; }
.remove-asset-button:hover { border-color: color-mix(in srgb, var(--color-down) 65%, var(--border-base)); background: color-mix(in srgb, var(--color-down) 8%, transparent); }
.remove-asset-button:disabled { opacity: .45; }
.remove-asset-button svg { width: 12px; height: 12px; flex-shrink: 0; }
.remove-asset-button span { color: inherit; font-size: inherit; }
.equal-button { margin-top: 7px; color: #8d67e8; font-size: 9px; font-weight: 700; }
.atomic-note { display: flex; align-items: flex-start; gap: 7px; margin-top: 11px; color: var(--text-muted); font-size: 9px; line-height: 15px; }.atomic-note svg { width: 15px; height: 15px; flex-shrink: 0; }
.advanced-toggle { display: flex; width: 100%; align-items: center; justify-content: space-between; margin-top: 11px; padding: 10px 12px; border: 1px solid var(--border-base); border-radius: 11px; background: var(--surface-2); color: var(--text-muted); font-size: 10px; font-weight: 650; }.advanced-toggle:disabled { opacity: .45; }.advanced-toggle svg { width: 16px; height: 16px; transition: transform 150ms ease; }.advanced-toggle.open svg { transform: rotate(180deg); }
.advanced-panel { margin-top: 8px; padding: 11px 12px; border: 1px solid var(--border-base); border-radius: 12px; background: color-mix(in srgb, var(--surface-2) 60%, transparent); }.advanced-panel > p { margin-bottom: 7px; color: var(--text-muted); font-size: 9px; line-height: 14px; }
.custom-toggle { margin-top: 10px; }
.custom-asset-panel { padding: 12px; }
.custom-search-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; }
.custom-address { min-width: 0; }
.pool-search { display: flex; height: 55px; min-width: 112px; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border: 1px solid rgba(141,103,232,.3); border-radius: 14px; background: rgba(141,103,232,.1); color: #8d67e8; font-size: 10px; font-weight: 750; }
.pool-search:disabled { opacity: .5; }
.pool-search .spinner { width: 13px; height: 13px; border-color: rgba(141,103,232,.3); border-top-color: #8d67e8; }
.pool-candidates { display: grid; gap: 7px; margin-top: 9px; }
.pool-candidate { display: block; width: 100%; padding: 12px; border: 1px solid var(--border-base); border-radius: 13px; background: var(--surface-2); text-align: left; transition: border-color 150ms ease, background 150ms ease; }
.pool-candidate.selected { border-color: rgba(141,103,232,.6); background: rgba(141,103,232,.08); box-shadow: inset 3px 0 #8d67e8; }
.pool-candidate__head { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 10px; }
.pool-candidate__head > span { display: flex; min-width: 0; align-items: center; gap: 7px; }
.pool-candidate__head > i { width: 10px; height: 10px; flex-shrink: 0; border: 2px solid var(--border-base); border-radius: 50%; }
.pool-candidate.selected .pool-candidate__head > i { border-color: #8d67e8; background: #8d67e8; box-shadow: inset 0 0 0 2px var(--surface-2); }
.pool-candidate b, .pool-candidate strong, .pool-candidate small, .pool-candidate code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pool-candidate b { color: var(--text-base); font-size: 10px; }
.pool-candidate em { padding: 2px 5px; border-radius: 5px; background: rgba(240,120,42,.1); color: #f0782a; font-size: 8px; font-style: normal; }
.pool-candidate small { margin-bottom: 2px; color: var(--text-faint); font-size: 8px; }
.pool-candidate strong { color: var(--text-muted); font-size: 9px; }
.pool-candidate__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; padding: 9px 0; border-top: 1px solid color-mix(in srgb, var(--border-base) 68%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--border-base) 68%, transparent); }
.pool-candidate__details { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 9px; }
.pool-candidate__details code { color: var(--text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; }
.custom-error { margin-top: 8px; color: var(--color-down) !important; }
.validate-route { display: flex; width: 100%; height: 36px; align-items: center; justify-content: center; gap: 7px; margin-top: 9px; border-radius: 10px; background: rgba(141,103,232,.12); color: #8d67e8; font-size: 10px; font-weight: 750; }.validate-route:disabled { opacity: .5; }.validate-route .spinner { width: 13px; height: 13px; border-color: rgba(141,103,232,.3); border-top-color: #8d67e8; }
.leg-slippage-row { display: grid; grid-template-columns: minmax(80px, 1fr) 112px 46px; align-items: center; gap: 7px; padding: 6px 0; border-top: 1px solid color-mix(in srgb, var(--border-base) 70%, transparent); }.leg-slippage-asset { display: flex; min-width: 0; flex-direction: column; gap: 2px; }.leg-slippage-row strong { color: var(--text-base); font-size: 10px; }.leg-slippage-asset em { color: var(--text-muted); font-size: 8px; font-style: normal; }.leg-slippage-row label { display: flex; align-items: center; gap: 4px; padding: 5px 7px; border: 1px solid var(--border-base); border-radius: 8px; background: var(--surface); }.leg-slippage-row input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-base); text-align: right; }.leg-slippage-row label span, .leg-slippage-row button { color: var(--text-muted); font-size: 8px; }.leg-slippage-row button:hover { color: #8d67e8; }
.advanced-enter-active, .advanced-leave-active { transition: opacity 150ms ease, transform 150ms ease; }.advanced-enter-from, .advanced-leave-to { opacity: 0; transform: translateY(-4px); }
.modal-footer { padding: 16px 28px 22px; border-top: 1px solid var(--border-base); background: color-mix(in srgb, var(--surface-2) 55%, var(--surface)); }
.create-error { margin-bottom: 10px; color: var(--color-down); font-size: 10px; line-height: 15px; }
.create-submit { display: flex; width: 100%; height: 50px; align-items: center; justify-content: center; gap: 8px; border-radius: 14px; background: linear-gradient(115deg, #8d67e8, #5f74df 58%, #27b8b0); color: #fff; font-size: 13px; font-weight: 750; box-shadow: 0 12px 28px rgba(102,89,217,.22); }.create-submit:disabled { opacity: .45; box-shadow: none; cursor: not-allowed; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; }
.basket-modal-enter-active, .basket-modal-leave-active { transition: opacity 180ms ease; }.basket-modal-enter-active .create-modal, .basket-modal-leave-active .create-modal { transition: transform 180ms ease; }.basket-modal-enter-from, .basket-modal-leave-to { opacity: 0; }.basket-modal-enter-from .create-modal, .basket-modal-leave-to .create-modal { transform: translateY(12px) scale(.985); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 650px) { .modal-backdrop { align-items: end; padding: 0; }.create-modal { max-height: 94vh; border-radius: 24px 24px 0 0; }.modal-header, .modal-body, .modal-footer { padding-right: 18px; padding-left: 18px; }.asset-grid { grid-template-columns: 1fr 1fr; }.two-cols, .custom-search-row { grid-template-columns: 1fr; }.pool-search { height: 42px; }.pool-candidate__details { grid-template-columns: 1fr 1fr; }.pool-candidate__details > span:first-child { grid-column: 1 / -1; }.weight-row { grid-template-columns: minmax(60px, 1fr) 82px 24px 28px; }.remove-asset-button { width: 28px; padding: 0; }.remove-asset-button span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; } }
</style>
