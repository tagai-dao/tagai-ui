<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { formatUnits, isAddress, zeroAddress, type Address } from 'viem'
import { useI18n } from 'vue-i18n'
import { useCommunityStore } from '@/stores/community'
import { useChainStore } from '@/stores/chain'
import { useAccountStore } from '@/stores/web3'
import { useModalStore } from '@/stores/common'
import { GlobalModalType } from '@/types'
import BasketTokenLogo from '@/views/baskets/components/BasketTokenLogo.vue'
import { getV13Detail, type V13Detail } from '@/utils/v13/pools'
import { buybackAbi, readBuybackState, quoteBuyback, executeBuyback, claimIndexReward, type BuybackState, type BuybackQuote } from '@/utils/v13/buyback'
import { getReadOnlyClient } from '@/utils/wallets'
import { poolOperationErrorKey } from '@/utils/v13/operation-error'

const { t, locale } = useI18n(), store = useCommunityStore(), chain = useChainStore(), wallet = useAccountStore()
const token = computed(() => store.currentSelectedCommunity?.token as Address | undefined)
const account = computed(() => isAddress(wallet.ethConnectAddress || '') ? wallet.ethConnectAddress as Address : zeroAddress)
const connected = computed(() => account.value !== zeroAddress && chain.activeChainId === 56)
const detail = ref<V13Detail>(), state = ref<BuybackState>(), quote = ref<BuybackQuote>()
const listed = ref<boolean>()
const loading = ref(false), quoting = ref(false), busy = ref<'buyback' | 'claim' | ''>(''), error = ref(''), loadError = ref(''), success = ref('')
const slippage = ref(1), bps = computed(() => Math.round(Number(slippage.value) * 100))
const validSlippage = computed(() => Number.isInteger(bps.value) && bps.value >= 1 && bps.value <= 1000)
const index = computed(() => state.value?.index || detail.value?.config.index_token || zeroAddress)
const indexReady = computed(() => listed.value === true && index.value !== zeroAddress && !!state.value?.listed)
const name = computed(() => detail.value?.config.name || state.value?.symbol || store.currentSelectedCommunity?.tick || '—')
const symbol = computed(() => state.value?.symbol || detail.value?.config.symbol || '')
const assets = computed(() => detail.value?.components.map(c => ({ address: c.asset, symbol: c.asset_symbol || `${c.asset.slice(0, 6)}…`, weightPct: c.target_weight / 100 })) || [])
const f = (value: bigint | undefined, decimals = state.value?.decimals ?? 18) => value === undefined ? '—' : Number(formatUnits(value, decimals)).toLocaleString(locale.value, { maximumFractionDigits: 6 })
let generation = 0, previewGeneration = 0, disposed = false
async function load() {
  if (!token.value || chain.activeChainId !== 56) return
  const id = ++generation; loading.value = true
  const currentToken = token.value, currentAccount = account.value
  try {
    // Inner-curve tokens have no index yet. Do not depend on index metadata or
    // reward reads just to explain when it will be created (including pendinglist).
    const value = await getReadOnlyClient(56).readContract({ address: currentToken, abi: buybackAbi, functionName: 'listed' })
    if (id !== generation || disposed) return
    listed.value = value; loadError.value = ''
    if (!value) { detail.value = undefined; state.value = undefined; quote.value = undefined; return }
    const result = await Promise.allSettled([getV13Detail(currentToken), readBuybackState(currentToken, currentAccount)])
    if (id !== generation || disposed) return
    if (result[0].status === 'fulfilled') detail.value = result[0].value
    if (result[1].status === 'fulfilled') { state.value = result[1].value; listed.value = result[1].value.listed }
    else loadError.value = t('v13Page.loadError')
  } catch { if (id === generation && !disposed) loadError.value = t('v13Page.loadError') }
  finally { if (id === generation && !disposed) loading.value = false }
}
function message(cause: unknown) {
  const code = cause instanceof Error ? cause.message : ''
  if (code === 'V13_BUYBACK_EXPIRED') return t('v13Index.expired')
  if (code === 'V13_BUYBACK_EMPTY') return t('v13Index.emptyReserve')
  if (code === 'V13_BUYBACK_ROUTER') return t('v13Index.routerUnavailable')
  if (code === 'V13_BUYBACK_TOO_SMALL') return t('v13Index.tooSmall')
  return t(poolOperationErrorKey(cause))
}
async function preview() {
  if (!indexReady.value || !token.value || !validSlippage.value || busy.value || quoting.value) return
  const id = ++previewGeneration; quoting.value = true; quote.value = undefined; error.value = ''; success.value = ''
  try {
    const result = await quoteBuyback(token.value, account.value, bps.value)
    if (id === previewGeneration && !disposed) { state.value = result.state; quote.value = result }
  } catch (cause) { if (id === previewGeneration && !disposed) { error.value = message(cause); console.warn('[V13 buyback quote]', cause) } }
  finally { if (id === previewGeneration) quoting.value = false }
}
function connect() { useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet) }
async function operate(kind: 'buyback' | 'claim') {
  if (!indexReady.value) return
  if (!connected.value) { connect(); return }
  if (!token.value || busy.value || quoting.value) return
  const id = previewGeneration; busy.value = kind; error.value = ''; success.value = ''
  try {
    if (kind === 'buyback') { if (!quote.value) return; await executeBuyback(quote.value) }
    else await claimIndexReward(token.value)
    if (id !== previewGeneration || disposed) return
    quote.value = undefined; success.value = t(kind === 'buyback' ? 'v13Index.buybackDone' : 'v13Index.claimDone')
    await load()
  } catch (cause) { if (id === previewGeneration && !disposed) { quote.value = undefined; error.value = message(cause); console.warn('[V13 index operation]', cause) } }
  finally { busy.value = '' }
}
watch([token, account, () => chain.activeChainId], () => {
  generation++; previewGeneration++; detail.value = undefined; state.value = undefined; quote.value = undefined; listed.value = undefined
  loading.value = false; quoting.value = false; error.value = ''; loadError.value = ''; success.value = ''
  void load()
}, { immediate: true })
watch(bps, () => { previewGeneration++; quote.value = undefined; quoting.value = false; error.value = '' })
watch(() => state.value?.reserve, value => { if (quote.value && value !== quote.value.state.reserve) quote.value = undefined })
const timer = setInterval(() => { if (!loading.value && !busy.value && !quoting.value) void load() }, 20000)
onUnmounted(() => { disposed = true; generation++; previewGeneration++; clearInterval(timer) })
</script>

<template>
  <section class="index-rewards">
    <header class="index-header">
      <div class="index-identity">
        <BasketTokenLogo v-if="assets.length" :chain-id="56" :address="index" :symbol="symbol" :assets="assets" :size="48" />
        <div><span class="eyebrow">{{ t('v13Page.linkedIndex') }}</span><h2><RouterLink v-if="indexReady" :to="`/bsc/baskets/${index}`">{{ name }} ↗</RouterLink><span v-else>{{ name }}</span></h2></div>
      </div>
      <button class="text-button" :disabled="loading || !!busy || quoting" @click="load">{{ t('v13Page.refresh') }}</button>
    </header>
    <p v-if="loadError" role="alert" class="error">{{ loadError }}</p>
    <p v-if="listed === false" class="pending" role="status">{{ t('v13Index.createdOnList') }}</p>
    <p v-else-if="state && !indexReady" class="pending" role="status">{{ t('v13Index.pending') }}</p>
    <template v-if="indexReady">
    <div v-if="assets.length" class="index-assets"><span v-for="asset in assets" :key="asset.address">{{ asset.symbol }} <b>{{ asset.weightPct }}%</b></span></div>
    <div class="index-stats">
      <div><span>{{ t('v13Page.buybackReserve') }}</span><strong>{{ f(state?.reserve, 18) }} <small>BNB</small></strong></div>
      <div><span>{{ t('v13Index.totalBought') }}</span><strong>{{ f(state?.notified) }} <small>{{ symbol }}</small></strong></div>
      <div><span>{{ t('v13Index.rewardBalance') }}</span><strong>{{ f(state?.rewardBalance) }} <small>{{ symbol }}</small></strong></div>
    </div>
    <div class="index-actions">
      <article class="action-card claim-card">
        <span class="eyebrow">{{ t('v13Page.dividend') }}</span>
        <strong class="claim-amount">{{ connected ? f(state?.pending) : '—' }} <small>{{ symbol }}</small></strong>
        <div class="data-row"><span>{{ t('v13Index.walletBalance') }}</span><span>{{ connected ? f(state?.walletIndex) : '—' }} {{ symbol }}</span></div>
        <p>{{ t('v13Index.rewardHelp') }}</p>
        <button class="primary" :disabled="!!busy || quoting || (connected && (!state?.pending || !indexReady))" @click="operate('claim')">{{ !connected ? t('connect') : busy === 'claim' ? t('v13Page.wait') : t('v13Index.claimReward') }}</button>
      </article>
      <article class="action-card buyback-card">
        <h3>{{ t('v13Index.buybackTitle') }}</h3>
        <p>{{ t('v13Index.buybackHelp') }}</p>
        <div class="estimate data-row"><span>{{ t('v13Index.estimatedIndex') }}</span><strong>{{ f(quote?.amountOut) }} {{ symbol }}</strong></div>
        <label class="data-row"><span>{{ t('v13Page.slippage') }} %</span><input v-model.number="slippage" type="number" min="0.01" max="10" step="0.01" :disabled="!!busy || quoting" /></label>
        <div v-if="quote" class="data-row minimum"><span>{{ t('v13Index.minimumIndex') }}</span><span>{{ f(quote.minOut) }} {{ symbol }}</span></div>
        <p v-if="state && !state.reserve && indexReady">{{ t('v13Index.emptyReserve') }}</p>
        <div class="buyback-buttons">
          <button class="secondary" :disabled="!!busy || quoting || !validSlippage || !indexReady || !state?.reserve" @click="preview">{{ quoting ? t('baskets.quoting') : quote ? t('v13Trade.refresh') : t('v13Index.preview') }}</button>
          <button class="primary" :disabled="!!busy || quoting || (connected && (!quote || !validSlippage))" @click="operate('buyback')">{{ !connected ? t('connect') : busy === 'buyback' ? t('v13Page.wait') : t('v13Index.execute') }}</button>
        </div>
      </article>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="success" class="success" role="status">{{ success }}</p>
    </template>
  </section>
</template>

<style scoped>
.index-rewards{padding:12px 4px 24px;display:grid;gap:18px;min-width:0}.index-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.index-identity{display:flex;gap:14px;align-items:center;min-width:0}.index-identity h2{font-size:24px;font-weight:750;overflow-wrap:anywhere}.index-identity a:hover{color:#fe913f}.eyebrow{font-size:12px;color:var(--text-muted)}.text-button{font-size:12px;color:var(--text-muted);padding:6px 10px;border:1px solid var(--border-base);border-radius:8px}.index-assets{display:flex;flex-wrap:wrap;gap:8px}.index-assets>span{font-size:11px;border:1px solid var(--border-base);background:var(--surface-2);padding:6px 10px;border-radius:8px}.index-assets b{margin-left:8px;color:#fe913f;font-weight:600}.index-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px;border:1px solid var(--border-base);border-radius:16px;background:var(--surface)}.index-stats>div{display:grid;align-content:start;gap:9px;min-width:0}.index-stats>div>span{font-size:11px;color:var(--text-muted)}.index-stats strong{font-size:19px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.index-stats small,.claim-amount small{font-size:12px;font-weight:500;color:var(--text-muted)}.index-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.action-card{display:flex;flex-direction:column;gap:14px;min-width:0;padding:20px;border:1px solid var(--border-base);border-radius:18px;background:var(--surface)}.claim-card{background:linear-gradient(140deg,#fe913f0d,var(--surface) 65%)}.action-card h3{font-size:16px;font-weight:700}.claim-amount{font-size:30px;line-height:1.3;color:#fe913f;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.data-row{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:12px}.data-row>span:first-child{color:var(--text-muted)}.data-row>span:last-child{text-align:right;overflow-wrap:anywhere}.data-row input{width:70px;min-width:0;border:1px solid var(--border-base);background:var(--surface-2);border-radius:8px;padding:7px;text-align:right;color:var(--text-base)}.estimate{min-height:42px;padding:9px 12px;border-radius:10px;background:var(--surface-2)}.estimate strong{font-size:14px;color:#fe913f;overflow-wrap:anywhere}.minimum{font-size:11px}.buyback-buttons{display:flex;gap:8px;margin-top:auto}.primary,.secondary{border-radius:10px;min-height:40px;padding:9px 12px;font-size:12px;font-weight:650}.primary{background:linear-gradient(110deg,#ff9b48,#ee7c2c);color:#18130f;border:1px solid #ed873f}.secondary{background:transparent;border:1px solid var(--border-base);color:var(--text-base)}.buyback-buttons>button{flex:1}.claim-card>.primary{margin-top:auto}button{cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}p{font-size:12px;line-height:1.6;color:var(--text-muted)}.error{color:#e78a38}.success{color:#52ce9f}.pending{padding:12px;background:var(--surface-2);border-radius:10px}@media(max-width:767px){.index-actions{grid-template-columns:1fr}.index-stats{gap:8px;padding:12px}.index-stats strong{font-size:16px}.action-card{padding:16px}}
</style>
