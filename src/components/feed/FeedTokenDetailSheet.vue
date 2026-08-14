<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { FeedTokenSheetAsset, TokenTrade } from '@/types'
import { getTokenTradeData, getTokenTradeList } from '@/apis/api'
import { getExternalTokenChartData } from '@/utils/pump'
import { useStateStore } from '@/stores/common'
import { formatTokenAmount, formatUsd, formatUsdCompact } from '@/utils/format'
import { formatAddress, formatPastTime } from '@/utils/helper'
import CommunityLogo from '@/components/common/CommunityLogo.vue'

type CandleRow = { timestamp: number | string; close: number | string }
type RangeKey = '1H' | '4H' | '1D' | '7D' | '1M' | 'ALL'

const props = defineProps<{
  modelValue: boolean
  asset: FeedTokenSheetAsset | null
}>()
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  buy: [asset: FeedTokenSheetAsset]
}>()

const stateStore = useStateStore()
const loading = ref(false)
const candles = ref<CandleRow[]>([])
const candlesInUsd = ref(false)
const externalChart = ref(false)
const trades = ref<TokenTrade[]>([])
const activeRange = ref<RangeKey>('1D')
const showTransactions = ref(false)
const sheetPanel = ref<HTMLElement | null>(null)
const sheetScroller = ref<HTMLElement | null>(null)
const sheetOffset = ref(0)
const sheetDragging = ref(false)
const ranges: Array<{ key: RangeKey; label: string; seconds: number }> = [
  { key: '1H', label: '1H', seconds: 3600 },
  { key: '4H', label: '4H', seconds: 4 * 3600 },
  { key: '1D', label: '1D', seconds: 86400 },
  { key: '7D', label: '7D', seconds: 7 * 86400 },
  { key: '1M', label: '1M', seconds: 30 * 86400 },
  { key: 'ALL', label: 'All', seconds: 0 },
]

let loadSequence = 0
let previousBodyOverflow = ''
let touchStartY = 0
let touchStartAt = 0
let touchCanDrag = false

const normalizeTimestamp = (value: number | string) => {
  const n = Number(value)
  return n > 1e12 ? n : n * 1000
}

const selectedCandles = computed(() => {
  const ordered = [...candles.value]
    .filter(row => Number.isFinite(Number(row.close)) && Number.isFinite(Number(row.timestamp)))
    .sort((a, b) => normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp))
  const seconds = ranges.find(range => range.key === activeRange.value)?.seconds || 0
  if (!seconds || !ordered.length) return ordered
  const cutoff = normalizeTimestamp(ordered[ordered.length - 1]!.timestamp) - seconds * 1000
  const filtered = ordered.filter(row => normalizeTimestamp(row.timestamp) >= cutoff)
  return filtered.length > 1 ? filtered : ordered.slice(-Math.min(ordered.length, 24))
})

const chartPoints = computed(() => {
  const nativePrice = stateStore.ethPrice || 0
  const rows = selectedCandles.value.map(row => ({
    x: normalizeTimestamp(row.timestamp),
    y: candlesInUsd.value ? Number(row.close) : Number(row.close) / 1e18 * nativePrice,
  })).filter(point => Number.isFinite(point.y))

  if (rows.length > 1) return rows
  const fallback = props.asset?.sparkline24h || []
  const now = Date.now()
  return fallback.map((value, index) => ({
    x: now - (fallback.length - index - 1) * 3600_000,
    y: Number(value) / 1e18 * nativePrice,
  })).filter(point => Number.isFinite(point.y))
})

const currentPrice = computed(() => {
  const last = chartPoints.value.at(-1)?.y
  return Number.isFinite(last) ? Number(last) : Number(props.asset?.price || 0) * stateStore.ethPrice
})
const selectedChange = computed(() => {
  const first = chartPoints.value[0]?.y
  const last = chartPoints.value.at(-1)?.y
  if (first && last && Number.isFinite(first) && Number.isFinite(last)) return ((last - first) / first) * 100
  return Number(props.asset?.priceChange24h || 0)
})
const marketCapUsd = computed(() => Number(props.asset?.marketCap || 0) * stateStore.ethPrice)
const trendUp = computed(() => selectedChange.value >= 0)
const transactionLabel = computed(() => `${trades.value.length}${trades.value.length >= 30 ? '+' : ''} transactions`)

const chartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false }, sparkline: { enabled: false } },
  colors: [trendUp.value ? '#10B981' : '#EF4444'],
  stroke: { curve: 'straight', width: 3 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.2, opacityFrom: 0.22, opacityTo: 0.02, stops: [0, 95] } },
  dataLabels: { enabled: false },
  markers: { size: 0 },
  grid: { borderColor: 'rgba(118,128,143,.13)', strokeDashArray: 3, padding: { left: 0, right: 4, top: -8, bottom: -8 } },
  xaxis: { type: 'datetime', labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
  yaxis: { show: false },
  tooltip: { x: { format: 'MMM dd, HH:mm' }, y: { formatter: (value: number) => formatUsd(value) } },
}))

async function loadData() {
  const asset = props.asset
  if (!props.modelValue || !asset?.tick || !asset.token) return
  const sequence = ++loadSequence
  loading.value = true
  candles.value = []
  candlesInUsd.value = false
  externalChart.value = false
  trades.value = []
  showTransactions.value = false
  activeRange.value = '1D'
  try {
    const rangeSeconds = ranges.find(range => range.key === activeRange.value)?.seconds || 0
    const [chartResult, tradeRows] = await Promise.all([
      (async () => {
        if (asset.isImport) {
          return { rows: await getExternalTokenChartData(asset.token, rangeSeconds).catch(() => []), external: true }
        }
        const internalRows = await getTokenTradeData(asset.tick, undefined, true).catch(() => []) as CandleRow[]
        if (internalRows?.length) return { rows: internalRows, external: false }
        const fallbackRows = await getExternalTokenChartData(asset.token, rangeSeconds).catch(() => [])
        return { rows: fallbackRows, external: fallbackRows.length > 0 }
      })(),
      getTokenTradeList(asset.token, 0).catch(() => []),
    ])
    if (sequence !== loadSequence) return
    externalChart.value = chartResult.external
    candlesInUsd.value = chartResult.external
    candles.value = (chartResult.rows || []) as CandleRow[]
    trades.value = (tradeRows || []) as TokenTrade[]
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function selectRange(range: RangeKey) {
  activeRange.value = range
  const asset = props.asset
  if (!props.modelValue || !asset || (!asset.isImport && !externalChart.value) || !asset.token) return
  const sequence = ++loadSequence
  loading.value = true
  const seconds = ranges.find(item => item.key === range)?.seconds || 0
  try {
    const rows = await getExternalTokenChartData(asset.token, seconds)
    if (sequence !== loadSequence) return
    candlesInUsd.value = true
    candles.value = rows
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function resetSheetDrag() {
  sheetDragging.value = false
  sheetOffset.value = 0
  touchCanDrag = false
}

function close() {
  resetSheetDrag()
  emit('update:modelValue', false)
}
function buy() { if (props.asset) emit('buy', props.asset) }

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  touchStartY = event.touches[0]!.clientY
  touchStartAt = performance.now()
  touchCanDrag = (sheetScroller.value?.scrollTop || 0) <= 0
  sheetDragging.value = false
  sheetOffset.value = 0
}

function onTouchMove(event: TouchEvent) {
  if (!touchCanDrag || event.touches.length !== 1) return
  const deltaY = event.touches[0]!.clientY - touchStartY
  if (deltaY <= 0) return
  if ((sheetScroller.value?.scrollTop || 0) > 0) {
    touchCanDrag = false
    return
  }
  if (deltaY > 4) sheetDragging.value = true
  if (!sheetDragging.value) return
  event.preventDefault()
  sheetOffset.value = deltaY
}

function onTouchEnd() {
  if (!touchCanDrag) return resetSheetDrag()
  const elapsed = Math.max(performance.now() - touchStartAt, 1)
  const velocity = sheetOffset.value / elapsed
  const distanceThreshold = Math.min((sheetPanel.value?.offsetHeight || 500) * 0.22, 140)
  const shouldClose = sheetOffset.value >= distanceThreshold || (sheetOffset.value >= 44 && velocity >= 0.65)
  if (shouldClose) close()
  else resetSheetDrag()
}

watch(() => [props.modelValue, props.asset?.token], loadData, { immediate: true })
watch(() => props.modelValue, visible => {
  if (visible) {
    resetSheetDrag()
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
})
onUnmounted(() => { document.body.style.overflow = previousBodyOverflow })
</script>

<template>
  <Teleport to="body">
    <Transition name="token-sheet">
      <div v-if="modelValue && asset" class="token-sheet-layer fixed inset-x-0 top-0 z-[120]" @click.self="close">
        <button type="button" class="absolute inset-0 w-full bg-black/15" aria-label="Close token details" @click="close" />
        <section ref="sheetPanel" class="token-sheet-panel absolute inset-x-0 bottom-0 z-10 mx-auto flex max-h-[76dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border border-grey-light-hover bg-surface shadow-2xl" :class="{ 'token-sheet-panel--dragging': sheetDragging }" :style="sheetOffset ? { transform: `translateY(${sheetOffset}px)` } : undefined" @click.stop @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
          <div class="flex justify-center py-2"><span class="h-1 w-10 rounded-full bg-grey-light-active" /></div>
          <div ref="sheetScroller" class="min-h-0 flex-1 overflow-y-auto px-4 pb-3 no-scroll-bar">
            <div v-if="asset.creatorName || asset.creatorUsername" class="flex items-center gap-2 border-b border-grey-light-hover/70 pb-3">
              <img v-if="asset.creatorProfile" :src="asset.creatorProfile.replace('normal', '200x200')" class="h-9 w-9 rounded-full object-cover" alt="">
              <div v-else class="h-9 w-9 rounded-full bg-grey-light-active" />
              <div class="min-w-0"><strong class="block truncate text-base text-content">{{ asset.creatorName || asset.creatorUsername }}</strong><span v-if="asset.creatorUsername" class="text-xs text-grey-64">@{{ asset.creatorUsername }}</span></div>
            </div>

            <div class="flex items-center gap-3 py-4">
              <CommunityLogo :logo="asset.logo" size="md" :shadow="false" class="!rounded-full" />
              <div class="min-w-0 flex-1"><strong class="block truncate text-xl text-content">{{ asset.name || asset.tick }}</strong><span class="text-sm text-grey-64">{{ asset.listed ? 'Graduated' : 'Bonding' }}</span></div>
              <div class="text-right"><strong class="block text-xl tabular-nums text-content">{{ formatUsd(currentPrice) }}</strong><span class="text-sm font-semibold tabular-nums" :class="trendUp ? 'text-up' : 'text-down'">{{ trendUp ? '△ +' : '▽ ' }}{{ selectedChange.toFixed(2) }}%</span><span v-if="marketCapUsd" class="mt-0.5 block text-xs text-grey-64">{{ formatUsdCompact(marketCapUsd) }} MC</span></div>
            </div>

            <div class="relative min-h-[220px]">
              <div v-if="loading && !chartPoints.length" class="absolute inset-0 z-10 flex items-center justify-center"><i-ep-loading class="animate-spin text-2xl text-orange-normal" /></div>
              <VueApexCharts v-if="chartPoints.length > 1" type="area" height="220" :options="chartOptions" :series="[{ name: asset.tick, data: chartPoints }]" />
              <div v-else-if="!loading" class="flex h-[220px] items-center justify-center rounded-2xl bg-surface-2 text-sm text-grey-64">No chart data</div>
            </div>

            <div class="grid grid-cols-6 gap-1 pb-3">
              <button v-for="range in ranges" :key="range.key" class="h-8 rounded-lg text-xs font-semibold" :class="activeRange === range.key ? 'bg-orange-normal/15 text-orange-normal' : 'text-grey-64'" @click="selectRange(range.key)">{{ range.label }}</button>
            </div>

            <button type="button" class="flex w-full items-center justify-between py-2 text-left text-base font-semibold text-content" @click="showTransactions = !showTransactions">
              <span>{{ transactionLabel }}</span><span class="text-grey-64 transition-transform" :class="showTransactions ? 'rotate-180' : ''">⌄</span>
            </button>
            <div v-if="showTransactions" class="mb-2 overflow-hidden rounded-xl border border-grey-light-hover">
              <div v-if="!trades.length" class="px-3 py-5 text-center text-sm text-grey-64">No transactions</div>
              <div v-for="(trade, index) in trades.slice(0, 8)" :key="`${trade.trader}-${trade.timestamp}-${index}`" class="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-grey-light-hover/60 px-3 py-2 text-xs last:border-0">
                <span class="truncate text-grey-64">{{ formatAddress(trade.trader, 5, 4) }} · {{ formatPastTime(trade.timestamp as number) }}</span>
                <span :class="trade.isBuy ? 'text-up' : 'text-down'">{{ trade.isBuy ? 'Buy' : 'Sell' }}</span>
                <span class="tabular-nums text-content">{{ formatTokenAmount(trade.amount) }}</span>
              </div>
            </div>
          </div>
          <div class="border-t border-grey-light-hover bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
            <button type="button" class="h-12 w-full rounded-2xl bg-gradient-primary text-lg font-semibold text-white shadow-sm" @click="buy">{{ $t('buy') }}</button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.token-sheet-layer { bottom: calc(3.5rem + var(--safe-area-bottom, 0px)); }
.token-sheet-panel { transition: transform .22s ease-out; }
.token-sheet-panel--dragging { transition: none; }
.token-sheet-enter-active, .token-sheet-leave-active { transition: opacity .2s ease; }
.token-sheet-enter-active .token-sheet-panel, .token-sheet-leave-active .token-sheet-panel { transition: transform .24s ease; }
.token-sheet-enter-from, .token-sheet-leave-to { opacity: 0; }
.token-sheet-enter-from .token-sheet-panel, .token-sheet-leave-to .token-sheet-panel { transform: translateY(100%); }
@media (min-width: 804px) { .token-sheet-layer { bottom: 0; } }
</style>
