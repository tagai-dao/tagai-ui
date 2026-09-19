<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAccountPnl, type AccountPnl, type PnlPeriod } from '@/apis/api'
import { useChainStore } from '@/stores/chain'
import { formatUsd, formatUsdCompact } from '@/utils/format'

const props = defineProps<{ twitterId?: string | null; username?: string | null }>()
const { locale } = useI18n()
const chain = useChainStore()
const zh = computed(() => String(locale.value).startsWith('zh'))
const periods: Array<{ value: PnlPeriod; label: string }> = [
  { value: '1d', label: '24H' }, { value: '7d', label: '7D' }, { value: '30d', label: '30D' },
]
const period = ref<PnlPeriod>('7d')
const data = ref<AccountPnl | null>(null)
const loading = ref(false)
const failed = ref(false)
let requestId = 0
let lastKey = ''
const indexed = computed(() => data.value?.calculation === 'indexed-realized-v1')
const value = computed(() => indexed.value ? data.value?.pnlNative : data.value?.pnlUsd)
const color = computed(() => Number(value.value || 0) >= 0 ? '#22c55e' : '#ef4444')
function native(value: number | null | undefined) {
  return value == null ? '—' : `${Number(value).toLocaleString('en-US', { maximumSignificantDigits: 8 })} ${data.value?.nativeSymbol || ''}`
}
const amount = computed(() => !data.value?.hasData || value.value == null ? '—'
  : indexed.value ? native(value.value) : formatUsd(value.value))
const series = computed(() => (data.value?.points || []).flatMap(point => {
  const value = indexed.value ? point.pnlNative : point.pnlUsd
  const timestamp = new Date(point.timestamp).getTime()
  return value != null && Number.isFinite(value) && Number.isFinite(timestamp) ? [{ value, timestamp }] : []
}).sort((a, b) => a.timestamp - b.timestamp))
const chartPoints = computed(() => {
  if (series.value.length < 2) return []
  const values = series.value.map(point => point.value)
  const min = Math.min(...values), max = Math.max(...values)
  const start = series.value[0].timestamp, end = series.value.at(-1)!.timestamp
  if (start === end) return []
  return series.value.map(point => ({
    x: 4 + (point.timestamp - start) / (end - start) * 92,
    y: max === min ? 50 : 88 - (point.value - min) / (max - min) * 72,
  }))
})
const polyline = computed(() => chartPoints.value.map(point => `${point.x},${point.y}`).join(' '))
const emptyText = computed(() => {
  if (failed.value) return zh.value ? '收益数据暂时加载失败' : 'Unable to load PnL'
  if (data.value?.status === 'incomplete_history') return zh.value ? '历史成本不足，暂无法计算收益' : 'Insufficient cost history to calculate PnL'
  if (data.value?.status === 'history_limit') return zh.value ? '交易历史较多，暂无法计算收益' : 'Trading history exceeds the current calculation limit'
  if (data.value?.status === 'no_wallet') return zh.value ? '此账号尚无关联钱包数据' : 'No linked wallet data for this account'
  return zh.value ? '暂无可用交易数据' : 'No trading data available yet'
})
function metric(value: number | null | undefined, suffix = '') {
  return value == null ? '—' : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`
}
function date(value: string | number) { return new Date(value).toLocaleString() }
async function load() {
  const currentRequest = ++requestId
  const key = `${chain.activeChainId}:${props.twitterId}:${props.username}:${period.value}`
  if (lastKey !== key) data.value = null
  lastKey = key
  failed.value = false
  if (!props.twitterId && !props.username) { loading.value = false; return }
  loading.value = true
  try {
    const result = await getAccountPnl(period.value, {
      twitterId: props.twitterId || undefined, username: props.username || undefined,
    })
    if (typeof result?.hasData !== 'boolean' || result.chainId !== chain.activeChainId) throw new Error('Invalid PnL response')
    if (currentRequest === requestId) data.value = result
  } catch {
    if (currentRequest === requestId) failed.value = true
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
watch([period, () => props.twitterId, () => props.username, () => chain.activeChainId], load, { immediate: true })
onBeforeUnmount(() => { requestId++ })
</script>

<template>
  <div class="pnl-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-[.12em] text-orange-normal">
          {{ indexed ? (zh ? '已实现收益 · TagAI 估算' : 'Realized PnL · TagAI estimate') : 'Personal PnL' }}
        </p>
        <strong class="mt-1 block break-words text-2xl font-bold tabular-nums text-content web:text-4xl">
          {{ loading ? '—' : amount }}
        </strong>
      </div>
      <div class="periods">
        <button v-for="item in periods" :key="item.value" :class="{ active: period === item.value }"
          :aria-pressed="period === item.value" @click="period = item.value">{{ item.label }}</button>
      </div>
    </div>
    <div v-if="loading" class="flex h-48 items-center justify-center text-grey-8d" aria-busy="true">
      <i-ep-loading class="h-6 w-6 animate-spin" />
    </div>
    <div v-else-if="!data?.hasData" class="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center">
      <strong class="text-base text-content">{{ emptyText }}</strong>
      <button v-if="failed" class="text-orange-normal" @click="load">{{ zh ? '重试' : 'Retry' }}</button>
    </div>
    <template v-else>
      <p v-if="failed || data.stale" class="mt-2 text-xs text-grey-8d" role="status">
        {{ zh ? '当前显示上次可用数据' : 'Showing the last available data' }}
        <button class="ml-2 text-orange-normal" @click="load">{{ zh ? '重试' : 'Retry' }}</button>
      </p>
      <template v-if="chartPoints.length">
        <div class="chart mt-4 h-48 overflow-hidden rounded-xl">
          <svg class="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
            :aria-label="indexed ? 'Realized PnL history' : 'PnL snapshots'">
            <polygon :points="`4,94 ${polyline} 96,94`" :fill="color" fill-opacity=".1" />
            <polyline :points="polyline" fill="none" :stroke="color" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </svg>
        </div>
        <div class="mt-1 flex justify-between gap-2 text-[10px] text-grey-8d">
          <span>{{ date(series[0].timestamp) }}</span><span>{{ date(series.at(-1)!.timestamp) }}</span>
        </div>
      </template>
      <div v-else class="flex h-48 items-center justify-center text-sm text-grey-8d">
        {{ zh ? '暂缺历史曲线数据' : 'History is not available yet' }}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 web:grid-cols-4">
        <div class="metric"><span>{{ zh ? '交易额' : 'Volume' }}</span><strong>{{ indexed ? native(data.volumeNative) : data.volumeUsd == null ? '—' : formatUsdCompact(data.volumeUsd) }}</strong></div>
        <div class="metric"><span>{{ indexed ? (zh ? '已匹配卖出 ROI' : 'Matched sales ROI') : 'ROI' }}</span><strong>{{ metric(data.roiPercent, '%') }}</strong></div>
        <div class="metric"><span>{{ indexed ? (zh ? '盈利卖出占比' : 'Profitable sales') : (zh ? '胜率' : 'Win rate') }}</span><strong>{{ metric(data.winRate, '%') }}</strong></div>
        <div class="metric"><span>{{ zh ? '交易次数' : 'Trades' }}</span><strong>{{ metric(data.tradeCount) }}</strong></div>
      </div>
      <p v-if="indexed" class="mt-3 text-xs leading-relaxed text-grey-8d">
        {{ zh ? '部分数据：仅统计已索引且成本可追溯的卖出收益，不含持仓浮盈、Gas 及未记录费用。' : 'Partial coverage: indexed sales with known costs. Open-position gains, gas and unrecorded fees are excluded.' }}
        <span v-if="data.excludedSales">{{ zh ? `本周期 ${data.excludedSales} 笔卖出因成本不明未计入。` : `${data.excludedSales} sales excluded due to unknown costs.` }}</span>
        <span v-if="data.reasons?.includes('transfers_not_indexed')">{{ zh ? '此链缺少转账历史，成本按已索引买卖记录估算。' : 'Transfer history is unavailable on this chain; costs are estimated from indexed trades.' }}</span>
      </p>
      <div class="mt-3 flex flex-wrap justify-between gap-1 text-[10px] text-grey-8d">
        <span>{{ data.chain.toUpperCase() }} · {{ (data.source || 'TagAI').toUpperCase() }}</span>
        <span>{{ data.capturedAt ? date(data.capturedAt) : '—' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pnl-card { padding: 1rem; background: radial-gradient(circle at 80% 0, var(--pool-selected-bg) 0, transparent 32%); }
.periods { display: flex; flex: none; gap: .2rem; border-radius: .75rem; background: var(--surface-2); padding: .2rem; }
.periods button { min-width: 2.75rem; border-radius: .6rem; padding: .45rem .55rem; color: var(--text-muted); font-size: .7rem; font-weight: 700; }
.periods button.active { background: var(--surface); color: #ff7a16; box-shadow: 0 2px 8px rgb(0 0 0 / 8%); }
.chart { background-color: var(--surface); background-image: radial-gradient(var(--border-base) 1px, transparent 1px); background-size: 12px 12px; }
.metric { display: flex; flex-direction: column; border-radius: .75rem; background: var(--surface-2); padding: .65rem .75rem; }
.metric span { color: var(--text-muted); font-size: .65rem; }
.metric strong { margin-top: .15rem; color: var(--text-base); font-size: .875rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
</style>
