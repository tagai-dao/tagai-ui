<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { BasketSummary } from '@/utils/baskets/types'
import { getBasketDeployment } from '@/config/baskets'
import BasketTokenLogo from './BasketTokenLogo.vue'

const props = defineProps<{
  basket: BasketSummary
}>()

const legColors = ['#b84fc2', '#5368d9', '#ef7b45', '#27b8a2', '#8d67e8']
const allocationElement = ref<HTMLElement>()
const allocationWidth = ref(0)
let allocationObserver: ResizeObserver | undefined

const visibleLegLimit = computed(() => {
  const total = Math.min(props.basket.top.length, 4)
  const width = allocationWidth.value
  if (!width || !total) return total
  const minimumLegWidth = 112
  const moreWidth = 44
  const gap = 7
  for (let count = total; count >= 1; count -= 1) {
    const hasMore = props.basket.top.length > count
    const requiredWidth = count * minimumLegWidth
      + Math.max(0, count - 1) * gap
      + (hasMore ? moreWidth + gap : 0)
    if (requiredWidth <= width) return count
  }
  return 1
})

const allocationLegs = computed(() =>
  props.basket.top.slice(0, visibleLegLimit.value).map((leg) => ({
    ...leg,
    label: leg.symbol,
  })),
)
const hiddenLegCount = computed(() => Math.max(0, props.basket.top.length - allocationLegs.value.length))
const networkLabel = computed(() => getBasketDeployment(props.basket.chainId).networkLabel)
const performanceAvailable = computed(() => Number.isFinite(props.basket.toDatePct))
const performanceClass = computed(() => {
  if (!performanceAvailable.value) return 'performance--unavailable'
  return Number(props.basket.toDatePct) >= 0 ? 'performance--positive' : 'performance--negative'
})

onMounted(() => {
  if (!allocationElement.value) return
  allocationObserver = new ResizeObserver(([entry]) => {
    allocationWidth.value = entry?.contentRect.width ?? 0
  })
  allocationObserver.observe(allocationElement.value)
})
onBeforeUnmount(() => allocationObserver?.disconnect())

const formatUsd = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatNav = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const digits = n >= 100 ? 2 : n >= 1 ? 2 : 4
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

const formatPerformance = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return '—'
  const number = Number(value)
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}
</script>

<template>
  <router-link
    :to="`/baskets/${basket.address}`"
    class="basket-card group"
    :aria-label="basket.name"
  >
    <span class="basket-card__glow basket-card__glow--left" aria-hidden="true" />
    <span class="basket-card__glow basket-card__glow--right" aria-hidden="true" />

    <div class="relative z-10 flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <BasketTokenLogo
          :chain-id="basket.chainId"
          :address="basket.address"
          :symbol="basket.symbol"
          :assets="basket.top"
          :size="52"
        />
        <div class="min-w-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <h2 class="text-xl font-bold tracking-[-0.03em] text-content truncate">
              {{ basket.symbol }}
            </h2>
            <span class="chain-badge"><i /> {{ networkLabel }}</span>
            <span class="version-badge">V{{ basket.version }}</span>
          </div>
          <p class="mt-1 text-sm text-muted truncate">{{ basket.name }}</p>
        </div>
      </div>
      <span class="asset-count">
        {{ basket.basketLength }} {{ $t('baskets.assets') }}
      </span>
    </div>

    <div v-if="allocationLegs.length" ref="allocationElement" class="allocation" aria-label="Basket allocation">
      <div
        v-for="(leg, index) in allocationLegs"
        :key="leg.address"
        class="allocation__leg"
        :style="{ backgroundColor: legColors[index % legColors.length] }"
      >
        <span class="allocation__symbol">{{ leg.label }}</span>
        <span class="allocation__weight">{{ leg.weightPct.toFixed(0) }}%</span>
      </div>
      <div v-if="hiddenLegCount" class="allocation__more" :aria-label="`+${hiddenLegCount}`">
        +{{ hiddenLegCount }}
      </div>
    </div>
    <div v-else class="allocation allocation--loading" aria-hidden="true">
      <span /><span /><span />
    </div>

    <div class="relative z-10 mt-6 flex items-end justify-between gap-4">
      <div class="basket-card__metrics min-w-0">
        <div class="min-w-0">
          <div class="text-[28px] leading-8 font-medium tracking-[-0.04em] text-content">
            {{ formatNav(basket.navPerToken) }}
          </div>
          <div class="mt-1.5 text-sm text-muted">
            {{ $t('baskets.aum') }} {{ formatUsd(basket.aumUsd) }}
          </div>
        </div>
        <div
          class="performance"
          :class="performanceClass"
          :title="$t('baskets.toDateHelp')"
        >
          <strong>{{ formatPerformance(basket.toDatePct) }}</strong>
          <span>{{ $t('baskets.toDate') }}</span>
        </div>
      </div>
      <span class="basket-card__action" aria-hidden="true">
        <span>{{ basket.symbol }}</span>
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M6 14 14 6m0 0H8m6 0v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>
  </router-link>
</template>

<style scoped>
.basket-card {
  position: relative;
  display: block;
  min-height: 320px;
  overflow: hidden;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--border-base) 76%, transparent);
  border-radius: 26px;
  background:
    linear-gradient(118deg, color-mix(in srgb, var(--surface) 96%, #8d67e8 4%), var(--surface) 58%, color-mix(in srgb, var(--surface) 92%, #27b8a2 8%));
  box-shadow: 0 18px 50px rgba(10, 12, 20, 0.08);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.basket-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, #8d67e8 42%, var(--border-base));
  box-shadow: 0 24px 60px rgba(10, 12, 20, 0.14);
}

.basket-card__glow {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  filter: blur(68px);
  opacity: 0.11;
  pointer-events: none;
}

.basket-card__glow--left { left: -100px; top: 40px; background: #b84fc2; }
.basket-card__glow--right { right: -100px; top: -80px; background: #38d39f; }

.chain-badge,
.version-badge,
.asset-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--border-base) 85%, transparent);
  border-radius: 999px;
}

.version-badge {
  height: 24px;
  padding: 0 8px;
  background: color-mix(in srgb, var(--surface-2) 78%, transparent);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.chain-badge {
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-color: rgba(167, 218, 0, 0.34);
  background: rgba(169, 230, 0, 0.08);
  color: #8eaf00;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.chain-badge i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b5ec13;
  box-shadow: 0 0 10px rgba(181, 236, 19, 0.65);
}

.asset-count {
  height: 30px;
  padding: 0 11px;
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
  background: color-mix(in srgb, var(--surface-2) 65%, transparent);
}

.allocation {
  position: relative;
  z-index: 1;
  display: flex;
  height: 96px;
  gap: 7px;
  margin-top: 28px;
}

.allocation__leg {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 18px;
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.allocation__more {
  display: grid;
  width: 44px;
  flex: 0 0 44px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--border-base) 85%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-2) 78%, #8d67e8 22%);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.allocation__leg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, rgba(255,255,255,0.2), transparent 42%, rgba(0,0,0,0.14));
  pointer-events: none;
}

.allocation__symbol,
.allocation__weight {
  position: absolute;
  z-index: 1;
  top: 12px;
  font-size: 12px;
  font-weight: 750;
  line-height: 20px;
}

.allocation__symbol {
  left: 12px;
  max-width: calc(100% - 24px);
  overflow: hidden;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.9);
  color: #14151a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.allocation__weight { right: 12px; text-shadow: 0 1px 4px rgba(0,0,0,0.28); }
.allocation__symbol + .allocation__weight { top: auto; bottom: 10px; }

.allocation--loading { gap: 7px; }
.allocation--loading span {
  flex: 1;
  border-radius: 18px;
  background: linear-gradient(100deg, var(--surface-2) 20%, color-mix(in srgb, var(--surface-2) 60%, #8d67e8) 50%, var(--surface-2) 80%);
  background-size: 220% 100%;
  animation: basket-shimmer 1.5s linear infinite;
}

.basket-card__action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 45%;
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  background: linear-gradient(115deg, #704ce8, #17b8d5);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 10px 28px rgba(91, 82, 225, 0.22);
}

.basket-card__metrics {
  display: flex;
  align-items: flex-end;
  gap: 20px;
}

.performance {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-start;
  padding-left: 18px;
  border-left: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
}

.performance strong { font-size: 16px; line-height: 22px; font-weight: 750; }
.performance span { margin-top: 2px; color: var(--text-muted); font-size: 9px; font-weight: 750; letter-spacing: .12em; }
.performance--positive strong { color: #20b77a; }
.performance--negative strong { color: #e25367; }
.performance--unavailable strong { color: var(--text-muted); }

.basket-card__action span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.basket-card__action svg { width: 18px; height: 18px; flex-shrink: 0; transition: transform 180ms ease; }
.basket-card:hover .basket-card__action svg { transform: translate(2px, -2px); }

@keyframes basket-shimmer { to { background-position: -220% 0; } }

@media (max-width: 420px) {
  .basket-card { min-height: 300px; padding: 20px; border-radius: 22px; }
  .allocation { height: 88px; margin-top: 24px; }
  .basket-card__metrics { gap: 12px; }
  .performance { padding-left: 12px; }
}
</style>
