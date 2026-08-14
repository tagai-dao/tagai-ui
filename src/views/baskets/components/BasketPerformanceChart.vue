<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { Address } from 'viem'
import { useI18n } from 'vue-i18n'
import { getBasketPerformanceSeries } from '@/utils/baskets/api'
import type {
  BasketPerformanceRange,
  BasketPerformanceSeries,
} from '@/utils/baskets/types'

const props = defineProps<{ address: Address; chainId: number }>()
const { t } = useI18n()
const ranges: BasketPerformanceRange[] = ['24h', '7d', '30d', 'all']
const rangeDurationMs: Partial<Record<BasketPerformanceRange, number>> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}
const rangeTickAmount: Record<BasketPerformanceRange, number> = {
  // Six equal four-hour segments keep the complete 24-hour window readable.
  '24h': 6,
  // Seven one-day segments and ten three-day segments respectively.
  '7d': 7,
  '30d': 10,
  all: 6,
}
const selectedRange = ref<BasketPerformanceRange>('all')
const data = ref<BasketPerformanceSeries | null>(null)
const loading = ref(false)
const error = ref('')
let requestId = 0

const load = async () => {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await getBasketPerformanceSeries(props.address, props.chainId, selectedRange.value)
    if (currentRequest === requestId) data.value = result
  } catch (reason) {
    if (currentRequest !== requestId) return
    data.value = null
    error.value = reason instanceof Error ? reason.message : t('baskets.performanceLoadFailed')
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(
  () => [props.address, props.chainId, selectedRange.value] as const,
  () => void load(),
  { immediate: true },
)

const points = computed(() => (data.value?.points || [])
  .filter((point) => Number.isFinite(Number(point.nav)))
  .map((point) => ({ x: point.timestamp * 1000, y: Number(point.nav) })))

const chartBounds = computed(() => {
  const firstPoint = points.value[0]?.x
  const lastPoint = points.value[points.value.length - 1]?.x
  const asOf = data.value?.asOf ? data.value.asOf * 1000 : undefined
  const max = asOf || lastPoint
  if (!max) return { min: undefined, max: undefined }
  const duration = rangeDurationMs[selectedRange.value]
  const min = duration ? max - duration : firstPoint
  return { min, max }
})

const formatAxisTimestamp = (value: string | number) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return ''
  if (selectedRange.value === '24h') {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  })
}

const change = computed(() => data.value?.changePct ?? null)
const changeAvailable = computed(() => Number.isFinite(change.value))
const changePositive = computed(() => Number(change.value) >= 0)
const changeText = computed(() => {
  if (!changeAvailable.value) return '—'
  const value = Number(change.value)
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
})
const changeLabel = computed(() => selectedRange.value === 'all'
  ? t('baskets.sinceLaunch')
  : t('baskets.rangeReturn', { range: selectedRange.value.toUpperCase() }))

const formatNav = (value: number) => `$${value.toLocaleString(undefined, {
  minimumFractionDigits: value >= 1 ? 2 : 4,
  maximumFractionDigits: value >= 1 ? 6 : 8,
})}`

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'area',
    height: 320,
    background: 'transparent',
    foreColor: '#858997',
    fontFamily: 'inherit',
    animations: { enabled: true, speed: 350 },
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  colors: [changePositive.value ? '#21cda0' : '#ef4f8d'],
  stroke: { curve: 'smooth', width: 2.2 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 0.8,
      opacityFrom: 0.5,
      opacityTo: 0.03,
      stops: [0, 60, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(132, 137, 151, 0.13)',
    strokeDashArray: 3,
    padding: { left: 8, right: 12, top: 2, bottom: 0 },
  },
  xaxis: {
    // Numeric timestamps make ApexCharts honor exact, proportional tick counts.
    type: 'numeric',
    min: chartBounds.value.min,
    max: chartBounds.value.max,
    tickAmount: rangeTickAmount[selectedRange.value],
    decimalsInFloat: 0,
    labels: {
      formatter: (value: string) => formatAxisTimestamp(value),
      hideOverlappingLabels: true,
      trim: false,
      style: { colors: '#858997', fontSize: '11px' },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    crosshairs: {
      show: true,
      position: 'back',
      stroke: { color: 'rgba(132, 137, 151, .45)', width: 1, dashArray: 3 },
    },
    tooltip: { enabled: false },
  },
  yaxis: {
    decimalsInFloat: 4,
    labels: {
      formatter: (value: number) => formatNav(value),
      style: { colors: '#858997', fontSize: '11px' },
    },
  },
  tooltip: {
    enabled: true,
    shared: false,
    intersect: false,
    followCursor: false,
    marker: { show: true },
    x: {
      formatter: (value: number) => new Date(value).toLocaleString(),
    },
    y: {
      formatter: (value: number) => `${formatNav(value)} NAV`,
      title: { formatter: () => 'INDEX NAV:' },
    },
  },
  markers: {
    size: 0,
    strokeWidth: 2,
    strokeColors: '#fff',
    hover: { size: 6, sizeOffset: 2 },
  },
  noData: { text: t('baskets.performanceCollecting') },
}))

const series = computed(() => [{ name: 'INDEX NAV', data: points.value }])
</script>

<template>
  <section class="performance-card">
    <div class="performance-card__header">
      <div>
        <span class="performance-card__kicker">{{ $t('baskets.indexNav') }}</span>
        <div class="performance-card__change" :class="changePositive ? 'positive' : 'negative'">
          {{ changeText }}
          <small>{{ changeLabel }}</small>
        </div>
      </div>

      <div class="performance-card__controls">
        <span class="nav-mode">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M2.5 12.5c2-3 3.5 2 5.5-1s3.5-1 4.5.5 2.5 1.5 5-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path d="M2.5 6.5c2-3 3.5 2 5.5-1s3.5-1 4.5.5 2.5 1.5 5-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55" />
          </svg>
          INDEX NAV
        </span>
        <div class="range-tabs" role="tablist" :aria-label="$t('baskets.chartRange')">
          <button
            v-for="range in ranges"
            :key="range"
            type="button"
            role="tab"
            :aria-selected="selectedRange === range"
            :class="{ active: selectedRange === range }"
            @click="selectedRange = range"
          >
            {{ range.toUpperCase() }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="performance-state">
      <span class="loading-orbit" />
      {{ $t('baskets.loadingPerformance') }}
    </div>
    <div v-else-if="error" class="performance-state text-red-normal">
      {{ $t('baskets.performanceLoadFailed') }}
    </div>
    <div v-else-if="points.length < 2" class="performance-state">
      {{ $t('baskets.performanceCollecting') }}
    </div>
    <VueApexCharts
      v-else
      type="area"
      height="320"
      :options="chartOptions"
      :series="series"
    />

    <div v-if="data" class="performance-card__footer">
      <span :class="`quality quality--${data.dataQuality}`">
        {{ $t(`baskets.quality_${data.dataQuality}`) }}
      </span>
      <span v-if="data.asOf">
        {{ $t('baskets.asOf') }} {{ new Date(data.asOf * 1000).toLocaleString() }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.performance-card {
  position: relative;
  overflow: hidden;
  container-type: inline-size;
  margin-bottom: 18px;
  padding: 24px 24px 12px;
  border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
  border-radius: 24px;
  background:
    radial-gradient(circle at 72% 100%, rgba(176, 55, 210, .10), transparent 38%),
    radial-gradient(circle at 35% 100%, rgba(32, 210, 160, .09), transparent 34%),
    color-mix(in srgb, var(--surface) 96%, #101118 4%);
  box-shadow: 0 18px 50px rgba(10, 12, 20, .07);
}

.performance-card::after {
  content: '';
  position: absolute;
  inset: 88px 24px 42px;
  opacity: .07;
  pointer-events: none;
  background-image: radial-gradient(circle, var(--text-base) 1px, transparent 1.2px);
  background-size: 8px 8px;
  mask-image: linear-gradient(to top, #000, transparent 78%);
}

.performance-card__header,
.performance-card__footer { position: relative; z-index: 2; }
.performance-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.performance-card__kicker { color: var(--text-muted); font-size: 10px; font-weight: 750; letter-spacing: .14em; }
.performance-card__change { margin-top: 5px; font-size: 24px; font-weight: 750; letter-spacing: -.035em; }
.performance-card__change.positive { color: #20cda0; }
.performance-card__change.negative { color: #ef4f8d; }
.performance-card__change small { margin-left: 9px; color: var(--text-muted); font-size: 10px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; }
.performance-card__controls { display: flex; align-items: center; gap: 14px; }
.nav-mode { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 13px; border: 1px solid color-mix(in srgb, #28bfd8 60%, var(--border-base)); border-radius: 12px; color: var(--text-base); font-size: 11px; font-weight: 750; letter-spacing: .08em; }
.nav-mode svg { width: 18px; height: 18px; color: #2fc6df; }
.range-tabs { display: flex; gap: 4px; padding: 3px; border: 1px solid var(--border-base); border-radius: 12px; background: color-mix(in srgb, var(--surface-2) 75%, transparent); }
.range-tabs button { height: 31px; padding: 0 11px; border-radius: 9px; color: var(--text-muted); font-size: 10px; font-weight: 750; letter-spacing: .08em; transition: color 150ms ease, background 150ms ease; }
.range-tabs button.active { background: var(--text-base); color: var(--surface); box-shadow: 0 5px 16px rgba(12, 14, 20, .14); }
.performance-state { position: relative; z-index: 2; display: flex; min-height: 300px; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted); font-size: 13px; }
.performance-card__footer { display: flex; flex-wrap: wrap; align-items: center; gap: 9px 14px; min-height: 30px; color: var(--text-muted); font-size: 10px; }
.quality { padding: 3px 7px; border-radius: 999px; background: color-mix(in srgb, var(--surface-2) 82%, transparent); text-transform: uppercase; letter-spacing: .08em; }
.quality--complete { color: #20b77a; }
.quality--partial, .quality--stale { color: #e6a23c; }
.quality--estimated { color: #8d67e8; }

:deep(.apexcharts-canvas) { position: relative; z-index: 1; }
:deep(.apexcharts-tooltip) { border-color: var(--border-base) !important; background: var(--surface) !important; color: var(--text-base) !important; box-shadow: 0 12px 32px rgba(5, 7, 12, .18) !important; }
:deep(.apexcharts-tooltip-title) { border-color: var(--border-base) !important; background: var(--surface-2) !important; }

@container (max-width: 520px) {
  .performance-card__header { flex-direction: column; }
  .performance-card__controls { width: 100%; flex-wrap: wrap; }
  .range-tabs { flex: 1; justify-content: space-between; }
  .range-tabs button { flex: 1; padding: 0 6px; }
}

@media (max-width: 760px) {
  .performance-card { padding: 20px 12px 10px; border-radius: 20px; }
  .performance-card__header { padding: 0 8px; flex-direction: column; }
  .performance-card__controls { width: 100%; flex-wrap: wrap; }
  .range-tabs { flex: 1; justify-content: space-between; }
  .range-tabs button { flex: 1; padding: 0 6px; }
  .performance-state { min-height: 220px; }
  .performance-card__footer { padding: 0 8px; }
}
</style>
