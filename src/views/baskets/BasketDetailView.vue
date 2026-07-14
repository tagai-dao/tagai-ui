<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBasketDetail } from '@/composables/baskets/useBasketDetail'
import BasketChainGate from './components/BasketChainGate.vue'
import BasketTradePanel from './components/BasketTradePanel.vue'
import { feeSplit } from '@/utils/spectrum/fee-model'
import { hasSpectrumFeeWallet, SPECTRUM_MINI_ATTRIBUTION, SPECTRUM_REPO_URL } from '@/config/spectrum'
import { ROBINHOOD_CHAIN } from '@/config/chains'

const route = useRoute()
const router = useRouter()
const { detail, isLoading, hasError, errorMessage, load } = useBasketDetail()
const legColors = ['#b84fc2', '#5368d9', '#ef7b45', '#27b8a2', '#8d67e8']

const address = computed(() => String(route.params.address || ''))

const explorerBasket = computed(() => {
  if (!detail.value) return ''
  return `${ROBINHOOD_CHAIN.browser.replace(/\/$/, '')}/address/${detail.value.address}`
})

const split = computed(() => {
  const d = detail.value
  if (!d) return null
  return feeSplit(d.creatorShareBps, {
    hasInterface: hasSpectrumFeeWallet(),
    hasLauncher: !!d.launcher,
  })
})

const feeSegments = computed(() => {
  if (!split.value) return []
  return [
    { key: 'feeBurn', value: split.value.burn },
    { key: 'feeInterface', value: split.value.interface },
    { key: 'feeLauncher', value: split.value.launcher },
    { key: 'feeCreator', value: split.value.creator },
    { key: 'feeHolders', value: split.value.holders },
  ].filter((item) => item.value > 0)
})

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

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

onMounted(() => void load(address.value))
watch(address, (a) => void load(a))
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
        <a
          v-if="explorerBasket"
          :href="explorerBasket"
          target="_blank"
          rel="noopener noreferrer"
          class="contract-link"
        >
          {{ $t('baskets.viewContract') }}
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
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
                  <span class="chain-badge"><i /> HOOD</span>
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
              <div>
                <span>{{ $t('baskets.fee') }}</span>
                <strong>{{ (detail.basketFeeBps / 100).toFixed(2) }}%</strong>
              </div>
              <div>
                <span>{{ $t('baskets.assets') }}</span>
                <strong>{{ detail.basketLength }}</strong>
              </div>
            </div>
          </div>

          <div class="hero-composition" :aria-label="$t('baskets.composition')">
            <div
              v-for="(holding, index) in detail.holdings"
              :key="holding.asset"
              class="hero-composition__leg"
              :style="{
                flexGrow: Math.max(holding.targetWeightPct, 6),
                backgroundColor: legColors[index % legColors.length],
              }"
            >
              <span>{{ holding.symbol }}</span>
              <strong>{{ holding.targetWeightPct.toFixed(0) }}%</strong>
            </div>
          </div>
        </section>

        <div class="content-grid">
          <main class="min-w-0">
            <section class="content-card holdings-card">
              <div class="section-heading">
                <div>
                  <span class="section-kicker">{{ $t('baskets.composition') }}</span>
                  <h2>{{ $t('baskets.holdings') }}</h2>
                </div>
                <span class="section-count">{{ detail.basketLength }} {{ $t('baskets.assets') }}</span>
              </div>

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
                    <strong>{{ holding.symbol }}</strong>
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

            <section v-if="split" class="content-card fee-card">
              <div class="section-heading">
                <div>
                  <span class="section-kicker">PROTOCOL</span>
                  <h2>{{ $t('baskets.feeSplit') }}</h2>
                </div>
                <span class="section-count">{{ (detail.basketFeeBps / 100).toFixed(2) }}%</span>
              </div>
              <div class="fee-bar" aria-hidden="true">
                <span
                  v-for="(segment, index) in feeSegments"
                  :key="segment.key"
                  :style="{ flexGrow: segment.value, backgroundColor: legColors[index % legColors.length] }"
                />
              </div>
              <div class="fee-legend">
                <div v-for="(segment, index) in feeSegments" :key="segment.key">
                  <i :style="{ backgroundColor: legColors[index % legColors.length] }" />
                  <span>{{ $t(`baskets.${segment.key}`) }}</span>
                  <strong>{{ pct(segment.value) }}</strong>
                </div>
              </div>
            </section>
          </main>

          <aside class="trade-column">
            <BasketTradePanel :detail="detail" @traded="load(address)" />
          </aside>
        </div>

        <p class="detail-footer">
          <a :href="SPECTRUM_REPO_URL" target="_blank" rel="noopener noreferrer">
            {{ SPECTRUM_MINI_ATTRIBUTION }}
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
.back-button, .contract-link { display: inline-flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: 12px; transition: color 160ms ease; }
.back-button:hover, .contract-link:hover { color: var(--text-base); }
.back-button svg, .contract-link svg { width: 18px; height: 18px; }

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
.hero-metrics > div { display: flex; min-width: 100px; flex-direction: column; gap: 3px; padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--surface-2) 72%, transparent); }
.hero-metrics span { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
.hero-metrics strong { color: var(--text-base); font-size: 18px; }

.hero-composition { position: relative; z-index: 1; display: flex; height: 94px; gap: 7px; margin-top: 30px; }
.hero-composition__leg { position: relative; min-width: 0; overflow: hidden; border: 1px solid rgba(255,255,255,.24); border-radius: 18px; color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
.hero-composition__leg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, rgba(255,255,255,.2), transparent 42%, rgba(0,0,0,.14)); }
.hero-composition__leg span, .hero-composition__leg strong { position: absolute; z-index: 1; top: 12px; font-size: 12px; }
.hero-composition__leg span { left: 12px; max-width: calc(100% - 24px); overflow: hidden; padding: 0 8px; border-radius: 999px; background: rgba(255,255,255,.9); color: #14151a; font-weight: 750; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.hero-composition__leg strong { right: 12px; text-shadow: 0 1px 4px rgba(0,0,0,.28); }

.content-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, .85fr); gap: 18px; margin-top: 18px; align-items: start; }
.trade-column { position: sticky; top: 18px; }
.content-card { overflow: hidden; border: 1px solid var(--border-base); border-radius: 24px; background: var(--surface); }
.fee-card { margin-top: 18px; padding: 24px; }
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
.asset-cell strong, .asset-cell span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-cell strong { font-size: 13px; }
.asset-cell span { margin-top: 2px; color: var(--text-muted); font-size: 9px; }
.metric-cell { text-align: right; }
.metric-cell--strong { font-weight: 700; }
.weight-track { position: absolute; right: 24px; bottom: 10px; left: 24px; height: 2px; overflow: hidden; border-radius: 2px; background: var(--surface-2); }
.weight-track span { display: block; height: 100%; border-radius: inherit; opacity: .8; }

.fee-bar { display: flex; height: 9px; gap: 3px; overflow: hidden; margin-top: 20px; border-radius: 999px; background: var(--surface-2); }
.fee-bar span { min-width: 3px; border-radius: 999px; }
.fee-legend { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.fee-legend > div { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 7px; color: var(--text-muted); font-size: 10px; }
.fee-legend i { width: 7px; height: 7px; border-radius: 50%; }
.fee-legend strong { color: var(--text-base); font-size: 11px; }

.detail-state { display: flex; min-height: 360px; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); font-size: 13px; }
.loading-orbit { width: 20px; height: 20px; border: 2px solid var(--border-base); border-top-color: #8d67e8; border-radius: 50%; animation: spin 750ms linear infinite; }
.detail-footer { padding-top: 30px; text-align: center; color: var(--text-muted); font-size: 10px; }
.detail-footer a:hover { color: var(--text-base); }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 980px) {
  .content-grid { grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr); }
  .holdings-table { grid-template-columns: minmax(125px, 1.3fr) repeat(4, minmax(55px, .7fr)); column-gap: 8px; }
  .holdings-table--head, .holdings-table--row { padding-right: 16px; padding-left: 16px; }
  .weight-track { right: 16px; left: 16px; }
}

@media (max-width: 803px) {
  .detail-shell { padding-top: 14px; padding-bottom: 88px; }
  .content-grid { grid-template-columns: 1fr; }
  .trade-column { position: static; order: -1; }
  .basket-hero { padding: 24px 20px; border-radius: 24px; }
}

@media (max-width: 600px) {
  .basket-mark { width: 48px; height: 48px; border-radius: 15px; }
  .basket-mark svg { width: 34px; height: 34px; }
  .hero-metrics { width: 100%; }
  .hero-metrics > div { min-width: 0; flex: 1; }
  .hero-composition { height: 84px; margin-top: 24px; }
  .hero-composition__leg strong { display: none; }
  .holdings-table--head { display: none; }
  .holdings-table--row { grid-template-columns: 1fr 1fr; gap: 14px 20px; padding: 18px 20px 22px; }
  .asset-cell { grid-column: 1 / -1; }
  .metric-cell { display: flex; justify-content: space-between; gap: 8px; text-align: right; }
  .metric-cell::before { content: attr(data-label); color: var(--text-muted); font-size: 10px; }
  .weight-track { right: 20px; left: 20px; }
  .fee-legend { grid-template-columns: 1fr 1fr; }
}
</style>
