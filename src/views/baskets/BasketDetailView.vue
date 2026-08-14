<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBasketDetail } from '@/composables/baskets/useBasketDetail'
import BasketChainGate from './components/BasketChainGate.vue'
import BasketTradePanel from './components/BasketTradePanel.vue'
import BasketRebalanceAction from './components/BasketRebalanceAction.vue'
import BasketPerformanceChart from './components/BasketPerformanceChart.vue'
import { getBasketDeployment } from '@/config/baskets'
import { formatUnits } from 'viem'
import { getChainDeployment } from '@/config/chains'
import { listBasketTrades, type BasketTradeEvent } from '@/utils/baskets/api'

const route = useRoute()
const router = useRouter()
const { detail, isLoading, hasError, errorMessage, load } = useBasketDetail()
const legColors = ['#b84fc2', '#5368d9', '#ef7b45', '#27b8a2', '#8d67e8']
const addressCopied = ref(false)
const trades = ref<BasketTradeEvent[]>([])
const tradesLoading = ref(false)
const tradesError = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | null = null
let tradesRequestId = 0

const address = computed(() => String(route.params.address || ''))
const deployment = computed(() => detail.value ? getBasketDeployment(detail.value.chainId) : null)

const explorerBasket = computed(() => {
  if (!detail.value) return ''
  return `${getChainDeployment(detail.value.chainId).browser.replace(/\/$/, '')}/address/${detail.value.address}`
})

const shortBasketAddress = computed(() => {
  const value = detail.value?.address
  return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : ''
})

const copyBasketAddress = async () => {
  const value = detail.value?.address
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    addressCopied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { addressCopied.value = false }, 1_600)
  } catch (error) {
    console.warn('[baskets] copy contract address failed', error)
  }
}

const liveWeight = (valueUsd: number) => {
  const total = detail.value?.aumUsd ?? 0
  return total > 0 ? (valueUsd / total) * 100 : 0
}

const formatUsd = (n: number, small = false) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: small ? 4 : 2, maximumFractionDigits: small ? 6 : 2 })}`
}

const formatSupply = (n: number | null) => {
  if (!n || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const rawAmount = (value: string | undefined, decimals: number): number => {
  try {
    return Number(formatUnits(BigInt(value || '0'), decimals))
  } catch {
    return 0
  }
}

const formatTokenAmount = (n: number, maxDigits = 4) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDigits })
}

const tradeSettlementAmount = (trade: BasketTradeEvent): number =>
  rawAmount(trade.usdg_amount, deployment.value?.settlementDecimals ?? 18)

const tradeBasketAmount = (trade: BasketTradeEvent): number =>
  rawAmount(trade.basket_amount, detail.value?.decimals ?? 18)

const tradePrice = (trade: BasketTradeEvent): number => {
  const basketAmount = tradeBasketAmount(trade)
  return basketAmount > 0 ? tradeSettlementAmount(trade) / basketAmount : 0
}

const isBuyTrade = (trade: BasketTradeEvent): boolean => Number(trade.is_buy) === 1

const shortAddress = (value: string | undefined) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'

const tradeTxUrl = (trade: BasketTradeEvent) => {
  if (!detail.value) return ''
  return `${getChainDeployment(detail.value.chainId).browser.replace(/\/$/, '')}/tx/${trade.transaction_hash}`
}

const formatTradeTime = (seconds: number) => {
  if (!seconds) return '—'
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const loadTrades = async () => {
  const requestId = ++tradesRequestId
  const current = detail.value
  if (!current) {
    trades.value = []
    tradesError.value = ''
    tradesLoading.value = false
    return
  }
  tradesLoading.value = true
  tradesError.value = ''
  try {
    const rows = await listBasketTrades(current.address, current.chainId, 0, 20)
    if (requestId !== tradesRequestId) return
    trades.value = rows
  } catch (error) {
    if (requestId !== tradesRequestId) return
    console.warn('[baskets] load trade history failed', error)
    trades.value = []
    tradesError.value = error instanceof Error ? error.message : 'Failed to load trades'
  } finally {
    if (requestId === tradesRequestId) tradesLoading.value = false
  }
}

const refreshDetail = async (force = false) => {
  await load(address.value, force)
  await loadTrades()
}

const openFees = () => router.push({ name: 'basket-fees', params: { address: address.value } })

onMounted(() => void refreshDetail())
watch(address, () => {
  tradesRequestId += 1
  trades.value = []
  tradesError.value = ''
  tradesLoading.value = false
  void refreshDetail()
})
onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="detail-page">
    <div class="detail-shell">
      <div class="page-actions">
        <button type="button" class="back-button" @click="router.push('/baskets')">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m12.5 5-5 5 5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ $t('baskets.backToList') }}
        </button>
        <div v-if="explorerBasket" class="contract-address">
          <a
            :href="explorerBasket"
            :title="detail?.address"
            target="_blank"
            rel="noopener noreferrer"
            class="contract-address__link"
          >
            <span>{{ shortBasketAddress }}</span>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
          <button
            type="button"
            class="contract-address__copy"
            :class="{ copied: addressCopied }"
            :title="$t('copy')"
            :aria-label="$t('copy')"
            @click="copyBasketAddress"
          >
            <svg v-if="addressCopied" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5.5 10.5 3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="6.5" y="6.5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.4" />
              <path d="M13.5 6.5V5.8a2.3 2.3 0 0 0-2.3-2.3H5.8a2.3 2.3 0 0 0-2.3 2.3v5.4a2.3 2.3 0 0 0 2.3 2.3h.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <BasketChainGate />

      <div v-if="isLoading" class="detail-state">
        <span class="loading-orbit" />
        {{ $t('baskets.loading') }}
      </div>
      <div v-else-if="hasError || !detail" class="detail-state text-red-normal">
        {{ errorMessage || $t('baskets.loadFailed') }}
      </div>

      <template v-else>
        <section class="basket-hero">
          <div class="basket-hero__grid" aria-hidden="true" />
          <div class="basket-hero__glow" aria-hidden="true" />

          <div class="relative z-10 flex flex-col web:flex-row web:items-start web:justify-between gap-6">
            <div class="flex items-start gap-4 min-w-0">
              <div class="basket-mark">
                <svg viewBox="0 0 42 42" fill="none" aria-hidden="true">
                  <path d="M6 23h6l3-10 5 19 5-22 4 13h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <div class="min-w-0 pt-1">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h1 class="text-[28px] web:text-[38px] leading-none font-bold tracking-[-0.05em] text-content truncate">
                    {{ detail.name }}
                  </h1>
                  <span class="symbol-badge">{{ detail.symbol }}</span>
                  <span class="chain-badge"><i /> {{ deployment?.networkLabel }}</span>
                </div>
                <div class="mt-5 text-[38px] web:text-[46px] leading-none font-semibold tracking-[-0.05em] text-content">
                  {{ formatUsd(detail.navPerToken, true) }}
                </div>
                <p class="mt-3 text-sm text-muted">
                  {{ $t('baskets.aum') }} {{ formatUsd(detail.aumUsd) }}
                  <span class="mx-2 opacity-40">·</span>
                  {{ formatSupply(detail.effectiveSupply ?? detail.totalSupply) }} {{ $t('baskets.supply') }}
                  <span class="mx-2 opacity-40">·</span>
                  {{ detail.pricedCount }}/{{ detail.basketLength }} {{ $t('baskets.priced') }}
                </p>
              </div>
            </div>

            <div class="hero-metrics">
              <button type="button" class="hero-metric-link" @click="openFees">
                <span>{{ $t('baskets.fee') }}</span>
                <strong>{{ (detail.basketFeeBps / 100).toFixed(2) }}%</strong>
                <small>{{ $t('baskets.viewFeeDetails') }} →</small>
              </button>
              <div>
                <span>{{ $t('baskets.assets') }}</span>
                <strong>{{ detail.basketLength }}</strong>
              </div>
            </div>
          </div>
        </section>

        <div class="market-grid">
          <div class="market-panel market-panel--chart">
            <BasketPerformanceChart :address="detail.address" :chain-id="detail.chainId" />
          </div>
          <div class="market-panel market-panel--trade">
            <BasketTradePanel :detail="detail" @traded="refreshDetail(true)" />
          </div>
        </div>

        <section class="content-card holdings-card">
          <div class="section-heading">
            <div>
              <span class="section-kicker">{{ $t('baskets.composition') }}</span>
              <h2>{{ $t('baskets.holdings') }}</h2>
            </div>
            <span class="section-count">{{ detail.basketLength }} {{ $t('baskets.assets') }}</span>
          </div>

          <BasketRebalanceAction :detail="detail" @rebalanced="refreshDetail(true)" />

          <div class="holdings-table holdings-table--head">
            <span>{{ $t('baskets.assets') }}</span>
            <span>{{ $t('baskets.target') }}</span>
            <span>{{ $t('baskets.live') }}</span>
            <span>{{ $t('baskets.price') }}</span>
            <span>{{ $t('baskets.value') }}</span>
          </div>
          <div
            v-for="(holding, index) in detail.holdings"
            :key="holding.asset"
            class="holdings-table holdings-table--row"
          >
            <div class="asset-cell">
              <i :style="{ backgroundColor: legColors[index % legColors.length] }" />
              <div class="min-w-0">
                <strong :title="holding.symbol">{{ holding.symbol }}</strong>
                <span>{{ holding.asset.slice(0, 6) }}…{{ holding.asset.slice(-4) }}</span>
              </div>
            </div>
            <div class="metric-cell" :data-label="$t('baskets.target')">
              {{ holding.targetWeightPct.toFixed(1) }}%
            </div>
            <div class="metric-cell" :data-label="$t('baskets.live')">
              {{ liveWeight(holding.valueUsd).toFixed(1) }}%
            </div>
            <div class="metric-cell" :data-label="$t('baskets.price')">
              <template v-if="holding.priced">{{ formatUsd(holding.priceUsd, true) }}</template>
              <span v-else class="text-red-normal">{{ $t('baskets.unpriced') }}</span>
            </div>
            <div class="metric-cell metric-cell--strong" :data-label="$t('baskets.value')">
              {{ formatUsd(holding.valueUsd) }}
            </div>
            <div class="weight-track" aria-hidden="true">
              <span
                :style="{
                  width: `${Math.min(liveWeight(holding.valueUsd), 100)}%`,
                  backgroundColor: legColors[index % legColors.length],
                }"
              />
            </div>
          </div>
        </section>

        <section class="content-card trade-history-card">
          <div class="section-heading">
            <div>
              <span class="section-kicker">{{ $t('baskets.trade') }}</span>
              <h2>{{ $t('baskets.tradeHistory') }}</h2>
            </div>
            <span class="section-count">{{ $t('baskets.recentTrades', { count: trades.length }) }}</span>
          </div>

          <div v-if="tradesLoading" class="trade-history-state">
            <span class="loading-orbit" />
            {{ $t('baskets.loadingTrades') }}
          </div>
          <div v-else-if="tradesError" class="trade-history-state text-red-normal">
            {{ $t('baskets.tradeLoadFailed') }}
          </div>
          <div v-else-if="!trades.length" class="trade-history-state">
            {{ $t('baskets.noTrades') }}
          </div>
          <template v-else>
            <div class="trade-history-table trade-history-table--head">
              <span>{{ $t('baskets.time') }}</span>
              <span>{{ $t('baskets.side') }}</span>
              <span>{{ $t('baskets.price') }}</span>
              <span>{{ detail.symbol }}</span>
              <span>{{ deployment?.settlementSymbol }}</span>
              <span>{{ $t('baskets.trader') }}</span>
              <span>{{ $t('baskets.tx') }}</span>
            </div>
            <div
              v-for="trade in trades"
              :key="trade.id"
              class="trade-history-table trade-history-table--row"
            >
              <div class="trade-time" :data-label="$t('baskets.time')">{{ formatTradeTime(Number(trade.block_timestamp)) }}</div>
              <div class="trade-side-cell" :data-label="$t('baskets.side')">
                <span class="trade-side" :class="isBuyTrade(trade) ? 'trade-side--buy' : 'trade-side--sell'">
                  {{ isBuyTrade(trade) ? $t('buy') : $t('sell') }}
                </span>
              </div>
              <div class="trade-metric" :data-label="$t('baskets.price')">{{ formatUsd(tradePrice(trade), true) }}</div>
              <div class="trade-metric" :data-label="detail.symbol">{{ formatTokenAmount(tradeBasketAmount(trade)) }}</div>
              <div class="trade-metric trade-metric--strong" :data-label="deployment?.settlementSymbol">
                {{ formatTokenAmount(tradeSettlementAmount(trade), 2) }}
              </div>
              <div class="trade-address" :data-label="$t('baskets.trader')" :title="trade.payer">
                {{ shortAddress(trade.payer) }}
              </div>
              <div class="trade-link-cell" :data-label="$t('baskets.tx')">
                <a
                  :href="tradeTxUrl(trade)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="trade-tx-link"
                  :title="trade.transaction_hash"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
          </template>
        </section>

        <p class="detail-footer">
          <a v-if="deployment?.protocolRepo" :href="deployment.protocolRepo" target="_blank" rel="noopener noreferrer">
            {{ $t('baskets.openSourceProtocol') }}
          </a>
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at 10% 0%, rgba(133, 75, 225, 0.07), transparent 28rem),
    radial-gradient(circle at 100% 18%, rgba(24, 185, 181, 0.06), transparent 25rem);
}

.detail-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: 20px 16px 44px; }
.page-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.back-button { display: inline-flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: 12px; transition: color 160ms ease; }
.back-button:hover { color: var(--text-base); }
.back-button svg { width: 18px; height: 18px; }
.contract-address { display: inline-flex; height: 34px; align-items: center; overflow: hidden; border: 1px solid var(--border-base); border-radius: 11px; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-muted); }
.contract-address__link { display: inline-flex; min-width: 0; height: 100%; align-items: center; gap: 6px; padding: 0 10px 0 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; transition: color 160ms ease, background 160ms ease; }
.contract-address__link:hover { background: var(--surface-2); color: var(--text-base); }
.contract-address__link svg { width: 15px; height: 15px; flex-shrink: 0; }
.contract-address__copy { display: grid; width: 34px; height: 100%; flex-shrink: 0; place-items: center; border-left: 1px solid var(--border-base); transition: color 160ms ease, background 160ms ease; }
.contract-address__copy:hover { background: var(--surface-2); color: var(--text-base); }
.contract-address__copy.copied { color: #31b975; }
.contract-address__copy svg { width: 16px; height: 16px; }

.basket-hero {
  position: relative;
  overflow: hidden;
  padding: 30px;
  border: 1px solid var(--border-base);
  border-radius: 28px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: 0 20px 60px rgba(10, 12, 20, .06);
}
.basket-hero__grid { position: absolute; inset: 0; opacity: .055; background-image: linear-gradient(var(--text-base) 1px, transparent 1px), linear-gradient(90deg, var(--text-base) 1px, transparent 1px); background-size: 32px 32px; mask-image: linear-gradient(to right, transparent, #000); }
.basket-hero__glow { position: absolute; right: -90px; top: -150px; width: 420px; height: 420px; border-radius: 50%; background: conic-gradient(from 70deg, rgba(23,184,213,.26), rgba(112,76,232,.22), rgba(197,75,183,.18), rgba(23,184,213,.26)); filter: blur(38px); opacity: .55; }

.basket-mark { display: grid; width: 62px; height: 62px; flex-shrink: 0; place-items: center; border-radius: 19px; background: linear-gradient(135deg, #bce950, #48e2ba 43%, #7d67ef); color: #0d1320; box-shadow: inset 0 1px 0 rgba(255,255,255,.55), 0 12px 30px rgba(75,181,162,.2); }
.basket-mark svg { width: 42px; height: 42px; }
.symbol-badge, .chain-badge, .section-count { display: inline-flex; align-items: center; flex-shrink: 0; border: 1px solid var(--border-base); border-radius: 999px; }
.symbol-badge { height: 25px; padding: 0 9px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
.chain-badge { gap: 6px; height: 25px; padding: 0 10px; border-color: rgba(167,218,0,.34); background: rgba(169,230,0,.08); color: #8eaf00; font-size: 10px; font-weight: 800; letter-spacing: .13em; }
.chain-badge i { width: 7px; height: 7px; border-radius: 50%; background: #b5ec13; box-shadow: 0 0 10px rgba(181,236,19,.65); }

.hero-metrics { display: flex; gap: 10px; }
.hero-metrics > div, .hero-metric-link { display: flex; min-width: 100px; flex-direction: column; gap: 3px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--surface-2) 72%, transparent); text-align:left; }
.hero-metric-link { transition: border-color 160ms ease, transform 160ms ease; }
.hero-metric-link:hover { border-color:#8d67e8; transform:translateY(-1px); }
.hero-metric-link small { margin-top:3px; color:#8d67e8; font-size:9px; }
.hero-metrics span { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
.hero-metrics strong { color: var(--text-base); font-size: 18px; }

.market-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, .85fr); gap: 18px; margin-top: 18px; align-items: stretch; }
.market-panel { display: flex; min-width: 0; }
.market-panel--trade :deep(.trade-card),
.market-panel--chart :deep(.performance-card) { width: 100%; height: 100%; }
.market-panel--chart :deep(.performance-card) { margin-bottom: 0; }
.content-card { overflow: hidden; border: 1px solid var(--border-base); border-radius: 24px; background: var(--surface); }
.holdings-card { margin-top: 18px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.holdings-card .section-heading { padding: 24px 24px 18px; }
.section-kicker { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
.section-heading h2 { color: var(--text-base); font-size: 19px; font-weight: 700; letter-spacing: -.03em; }
.section-count { height: 29px; padding: 0 11px; color: var(--text-muted); font-size: 10px; background: var(--surface-2); }

.holdings-table { display: grid; grid-template-columns: minmax(150px, 1.5fr) repeat(4, minmax(68px, .75fr)); align-items: center; column-gap: 12px; }
.holdings-table--head { padding: 10px 24px; border-top: 1px solid var(--border-base); border-bottom: 1px solid var(--border-base); background: color-mix(in srgb, var(--surface-2) 55%, transparent); color: var(--text-muted); font-size: 9px; letter-spacing: .09em; text-transform: uppercase; }
.holdings-table--head span:not(:first-child) { text-align: right; }
.holdings-table--row { position: relative; min-height: 78px; padding: 14px 24px 18px; border-bottom: 1px solid var(--border-base); color: var(--text-base); font-size: 12px; }
.holdings-table--row:last-child { border-bottom: 0; }
.asset-cell { display: flex; min-width: 0; align-items: center; gap: 10px; }
.asset-cell > i { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
.asset-cell strong, .asset-cell span { display: block; }
.asset-cell strong { overflow-wrap: anywhere; font-size: 13px; line-height: 1.35; white-space: normal; }
.asset-cell span { overflow: hidden; margin-top: 2px; color: var(--text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.metric-cell { text-align: right; }
	.metric-cell--strong { font-weight: 700; }
	.weight-track { position: absolute; right: 24px; bottom: 10px; left: 24px; height: 2px; overflow: hidden; border-radius: 2px; background: var(--surface-2); }
	.weight-track span { display: block; height: 100%; border-radius: inherit; opacity: .8; }

	.trade-history-card { margin-top: 18px; }
	.trade-history-card .section-heading { padding: 24px 24px 18px; }
	.trade-history-table { display: grid; grid-template-columns: minmax(112px, .95fr) 74px repeat(3, minmax(78px, .8fr)) minmax(92px, .8fr) 44px; align-items: center; column-gap: 12px; }
	.trade-history-table--head { padding: 10px 24px; border-top: 1px solid var(--border-base); border-bottom: 1px solid var(--border-base); background: color-mix(in srgb, var(--surface-2) 55%, transparent); color: var(--text-muted); font-size: 9px; letter-spacing: .09em; text-transform: uppercase; }
	.trade-history-table--head span:not(:first-child) { text-align: right; }
	.trade-history-table--row { min-height: 58px; padding: 12px 24px; border-bottom: 1px solid var(--border-base); color: var(--text-base); font-size: 12px; }
	.trade-history-table--row:last-child { border-bottom: 0; }
	.trade-time { color: var(--text-muted); font-size: 11px; }
	.trade-side-cell, .trade-metric, .trade-address, .trade-link-cell { text-align: right; }
	.trade-side { display: inline-flex; height: 24px; align-items: center; justify-content: center; padding: 0 9px; border-radius: 999px; font-size: 10px; font-weight: 800; }
	.trade-side--buy { background: rgba(39,184,162,.12); color: #27b8a2; }
	.trade-side--sell { background: rgba(239,123,69,.12); color: #ef7b45; }
	.trade-metric--strong { font-weight: 700; }
	.trade-address { overflow: hidden; color: var(--text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.trade-tx-link { display: inline-grid; width: 28px; height: 28px; place-items: center; border: 1px solid var(--border-base); border-radius: 9px; color: var(--text-muted); transition: color 160ms ease, border-color 160ms ease, background 160ms ease; }
	.trade-tx-link:hover { border-color: #8d67e8; background: color-mix(in srgb, #8d67e8 10%, transparent); color: #8d67e8; }
	.trade-tx-link svg { width: 15px; height: 15px; }
	.trade-history-state { display: flex; min-height: 112px; align-items: center; justify-content: center; gap: 10px; border-top: 1px solid var(--border-base); color: var(--text-muted); font-size: 12px; }

.detail-state { display: flex; min-height: 360px; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
.loading-orbit { width: 20px; height: 20px; border: 2px solid var(--border-base); border-top-color: #8d67e8; border-radius: 50%; animation: spin 750ms linear infinite; }
.detail-footer { padding-top: 30px; text-align: center; color: var(--text-muted); font-size: 10px; }
.detail-footer a:hover { color: var(--text-base); }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 980px) {
	  .market-grid { grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr); }
	  .holdings-table { grid-template-columns: minmax(125px, 1.3fr) repeat(4, minmax(55px, .7fr)); column-gap: 8px; }
	  .holdings-table--head, .holdings-table--row { padding-right: 16px; padding-left: 16px; }
	  .weight-track { right: 16px; left: 16px; }
	  .trade-history-table { grid-template-columns: minmax(104px, .9fr) 68px repeat(3, minmax(62px, .7fr)) minmax(76px, .7fr) 36px; column-gap: 8px; }
	  .trade-history-table--head, .trade-history-table--row { padding-right: 16px; padding-left: 16px; }
	}

@media (max-width: 803px) {
  .detail-shell { padding-top: 14px; padding-bottom: 88px; }
  .market-grid { grid-template-columns: 1fr; }
  .basket-hero { padding: 24px 20px; border-radius: 24px; }
}

@media (max-width: 600px) {
  .basket-mark { width: 48px; height: 48px; border-radius: 15px; }
  .basket-mark svg { width: 34px; height: 34px; }
  .hero-metrics { width: 100%; }
  .hero-metrics > div { min-width: 0; flex: 1; }
  .holdings-table--head { display: none; }
	  .holdings-table--row { grid-template-columns: 1fr 1fr; gap: 14px 20px; padding: 18px 20px 22px; }
	  .asset-cell { grid-column: 1 / -1; }
	  .metric-cell { display: flex; justify-content: space-between; gap: 8px; text-align: right; }
	  .metric-cell::before { content: attr(data-label); color: var(--text-muted); font-size: 10px; }
	  .weight-track { right: 20px; left: 20px; }
	  .trade-history-table--head { display: none; }
	  .trade-history-table--row { grid-template-columns: 1fr 1fr; gap: 12px 18px; padding: 16px 20px; }
	  .trade-time, .trade-side-cell, .trade-metric, .trade-address, .trade-link-cell { display: flex; justify-content: space-between; gap: 8px; text-align: right; }
	  .trade-time::before, .trade-side-cell::before, .trade-metric::before, .trade-address::before, .trade-link-cell::before { content: attr(data-label); color: var(--text-muted); font-family: inherit; font-size: 10px; }
	  .trade-time, .trade-link-cell { grid-column: 1 / -1; }
	  .trade-link-cell { align-items: center; }
	}
</style>
