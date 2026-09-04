<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getAccountPnl, type AccountPnl, type PnlPeriod } from '@/apis/api'
import { formatUsd, formatUsdCompact } from '@/utils/format'

const props = defineProps<{
  twitterId?: string | null
  username?: string | null
}>()

const periods: Array<{ value: PnlPeriod; label: string; suffix: string }> = [
  { value: '1d', label: '24H', suffix: '24h' },
  { value: '7d', label: '7D', suffix: '7d' },
  { value: '30d', label: '30D', suffix: '30d' },
]
const period = ref<PnlPeriod>('7d')
const data = ref<AccountPnl | null>(null)
const loading = ref(false)
let requestId = 0

const activePeriod = computed(() => periods.find(item => item.value === period.value) || periods[1])
const positive = computed(() => Number(data.value?.pnlChangeUsd || 0) >= 0)
const chartPoints = computed(() => {
  const values = (data.value?.points || []).map(point => Number(point.pnlUsd)).filter(Number.isFinite)
  if (!values.length && data.value?.hasData) values.push(Number(data.value.pnlUsd || 0))
  if (!values.length) return []
  if (values.length === 1) values.unshift(values[0])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.max(Math.abs(max) * .05, 1)
  return values.map((value, index) => ({
    x: 4 + (index / Math.max(1, values.length - 1)) * 92,
    y: 88 - ((value - min) / span) * 72,
  }))
})
const polyline = computed(() => chartPoints.value.map(point => `${point.x},${point.y}`).join(' '))
const area = computed(() => chartPoints.value.length
  ? `4,94 ${polyline.value} 96,94`
  : '')

function metric(value: number | null | undefined, suffix = '') {
  return value == null ? '—' : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}

async function load() {
  if (!props.twitterId && !props.username) return
  const currentRequest = ++requestId
  loading.value = true
  try {
    const result = await getAccountPnl(period.value, {
      twitterId: props.twitterId || undefined,
      username: props.username || undefined,
    })
    if (currentRequest === requestId) data.value = result
  } catch (error) {
    console.error('Load personal PnL failed', error)
    if (currentRequest === requestId) data.value = null
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch([period, () => props.twitterId, () => props.username], load, { immediate: true })
</script>

<template>
  <div class="pnl-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-[.18em] text-orange-normal">Personal PnL</p>
        <strong class="mt-1 block truncate text-3xl font-bold tabular-nums text-content web:text-4xl">
          {{ loading ? '—' : formatUsd(data?.pnlUsd || 0) }}
        </strong>
        <p v-if="data?.hasData" class="mt-1 text-base font-semibold tabular-nums"
          :class="positive ? 'text-green-500' : 'text-red-500'">
          {{ positive ? '+' : '' }}{{ formatUsd(data.pnlChangeUsd || 0) }} {{ activePeriod.suffix }}
        </p>
      </div>
      <div class="periods">
        <button v-for="item in periods" :key="item.value" :class="{ active: period === item.value }"
          @click="period = item.value">{{ item.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="flex h-48 items-center justify-center text-grey-8d">
      <i-ep-loading class="h-6 w-6 animate-spin" />
    </div>
    <div v-else-if="!data?.hasData" class="flex h-48 flex-col items-center justify-center px-6 text-center">
      <strong class="text-base text-content">No PnL data yet</strong>
      <span class="mt-1 text-xs text-grey-8d">This profile will update when FOMO, GMGN or Pump provides matched data.</span>
    </div>
    <template v-else>
      <div class="chart mt-4 h-48 overflow-hidden rounded-xl">
        <svg class="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="PnL history">
          <defs>
            <linearGradient id="profile-pnl-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#22c55e" stop-opacity=".28" />
              <stop offset="1" stop-color="#22c55e" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polygon v-if="area" :points="area" fill="url(#profile-pnl-area)" />
          <polyline :points="polyline" fill="none" stroke="#22c55e" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <circle v-if="chartPoints.length" :cx="chartPoints.at(-1)?.x" :cy="chartPoints.at(-1)?.y" r="2.4"
            fill="#22c55e" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 web:grid-cols-4">
        <div class="metric"><span>Volume</span><strong>{{ data.volumeUsd == null ? '—' : formatUsdCompact(data.volumeUsd) }}</strong></div>
        <div class="metric"><span>ROI</span><strong>{{ metric(data.roiPercent, '%') }}</strong></div>
        <div class="metric"><span>Win rate</span><strong>{{ metric(data.winRate, '%') }}</strong></div>
        <div class="metric"><span>Trades</span><strong>{{ metric(data.tradeCount) }}</strong></div>
      </div>
      <div class="mt-3 flex items-center justify-between text-[10px] text-grey-8d">
        <span>Source: {{ (data.source || 'TagAI').toUpperCase() }}</span>
        <span>12-hour snapshots · {{ data.capturedAt ? new Date(data.capturedAt).toLocaleString() : '—' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pnl-card { padding: 1rem; background: radial-gradient(circle at 80% 0, #fff1e8 0, transparent 32%); }
.periods { display: flex; flex: none; gap: .2rem; border-radius: .75rem; background: #f4f4f5; padding: .2rem; }
.periods button { min-width: 2.75rem; border-radius: .6rem; padding: .45rem .55rem; color: #8d8d8d; font-size: .7rem; font-weight: 700; }
.periods button.active { background: white; color: #ff7a16; box-shadow: 0 2px 8px rgb(0 0 0 / 8%); }
.chart { background-color: #fbfbfc; background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 12px 12px; }
.metric { display: flex; flex-direction: column; border-radius: .75rem; background: #f7f7f8; padding: .65rem .75rem; }
.metric span { color: #8d8d8d; font-size: .65rem; }
.metric strong { margin-top: .15rem; color: #191b2b; font-size: .875rem; font-variant-numeric: tabular-nums; }
</style>
