<script setup lang="ts">
import VueApexCharts from 'vue3-apexcharts'
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { getFPMMKlineData } from '@/apis/api'
import type { ApexOptions } from 'apexcharts'
import type { EventPredictOutcome, KlineData } from '@/types'
import { OUTCOME_CHART_COLORS } from '@/composables/useEventMarketOutcomes'

const ApexCharts = VueApexCharts as any

const props = defineProps<{
  marketAddr: string
  chartId: string
  /** 不传则只展示 outcome 0（Yes） */
  outcomes?: EventPredictOutcome[]
}>()

/** 接口 close 为 0~1 概率 */
function normalizeProbability(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(1, Math.max(0, n))
}

const chartOutcomes = computed(() => {
  if (props.outcomes?.length) {
    return [...props.outcomes].sort((a, b) => a.outcomeIndex - b.outcomeIndex)
  }
  return [{ outcomeIndex: 0, label: 'Yes' }]
})

const isMultiSeries = computed(() => chartOutcomes.value.length > 1)

const timeframes = ['1MIN', '5MIN', '1H']
const activeTimeframe = ref('1MIN')

const series = ref<{ name: string; data: [number, number][] }[]>([])
const currentPrices = ref<Record<number, number | null>>({})

/** 每个 outcome 独立缓存 K 线 */
const allDataByOutcome = new Map<number, KlineData[]>()
const lastTimestampByOutcome = new Map<number, number>()

function aggregateSeries(sourceData: KlineData[], aggregationInterval: number) {
  if (aggregationInterval <= 60 * 1000) return sourceData

  const aggregated: KlineData[] = []
  let currentBucketStart = 0
  let bucketClose = 0

  for (const item of sourceData) {
    const bucketStart = Math.floor(item.timestamp / aggregationInterval) * aggregationInterval
    if (bucketStart !== currentBucketStart) {
      if (currentBucketStart !== 0) {
        aggregated.push({
          timestamp: currentBucketStart,
          close: bucketClose,
          open: 0,
          high: 0,
          low: 0,
          fpmm: '',
        })
      }
      currentBucketStart = bucketStart
    }
    bucketClose = item.close
  }

  if (currentBucketStart !== 0) {
    aggregated.push({
      timestamp: currentBucketStart,
      close: bucketClose,
      open: 0,
      high: 0,
      low: 0,
      fpmm: '',
    })
  }

  return aggregated
}

function buildDataPoints(processedData: KlineData[]): [number, number][] {
  const dataPoints: [number, number][] = []
  for (const d of processedData) {
    const close = normalizeProbability(d.close)
    if (close === null) continue
    dataPoints.push([d.timestamp, close])
  }
  return dataPoints
}

function updateChartData() {
  let aggregationInterval = 60 * 1000
  switch (activeTimeframe.value) {
    case '5MIN':
      aggregationInterval = 5 * 60 * 1000
      break
    case '1H':
      aggregationInterval = 60 * 60 * 1000
      break
    default:
      aggregationInterval = 60 * 1000
  }

  const nextSeries: { name: string; data: [number, number][] }[] = []
  const nextPrices: Record<number, number | null> = {}

  for (const outcome of chartOutcomes.value) {
    const raw = allDataByOutcome.get(outcome.outcomeIndex) ?? []
    if (raw.length === 0) {
      nextSeries.push({ name: outcome.label, data: [] })
      nextPrices[outcome.outcomeIndex] = null
      continue
    }

    const sourceData = raw
      .map(d => {
        const close = normalizeProbability(d.close)
        if (close === null) return null
        return { ...d, close, timestamp: d.timestamp * 1000 }
      })
      .filter((d): d is KlineData => d != null)

    const processedData = aggregateSeries(sourceData, aggregationInterval)
    const dataPoints = buildDataPoints(processedData)
    nextSeries.push({ name: outcome.label, data: dataPoints })

    if (processedData.length > 0) {
      nextPrices[outcome.outcomeIndex] = normalizeProbability(processedData[processedData.length - 1].close)
    } else {
      nextPrices[outcome.outcomeIndex] = null
    }
  }

  series.value = nextSeries
  currentPrices.value = nextPrices
}

async function fetchOutcomeData(outcomeIndex: number, isUpdate = false) {
  const lastTs = lastTimestampByOutcome.get(outcomeIndex) ?? 0
  const res: any = await getFPMMKlineData(
    props.marketAddr,
    isUpdate ? lastTs : undefined,
    true,
    outcomeIndex
  )

  if (!res?.length) return

  const newItems = res as KlineData[]
  const existing = allDataByOutcome.get(outcomeIndex) ?? []

  if (isUpdate && existing.length > 0) {
    const uniqueNewItems = newItems.filter(item => item.timestamp > lastTs)
    allDataByOutcome.set(outcomeIndex, existing.concat(uniqueNewItems).sort((a, b) => a.timestamp - b.timestamp))
  } else {
    allDataByOutcome.set(outcomeIndex, [...newItems].sort((a, b) => a.timestamp - b.timestamp))
  }

  const merged = allDataByOutcome.get(outcomeIndex) ?? []
  if (merged.length > 0) {
    lastTimestampByOutcome.set(outcomeIndex, merged[merged.length - 1].timestamp)
  }
}

async function fetchData(isUpdate = false) {
  try {
    await Promise.all(chartOutcomes.value.map(o => fetchOutcomeData(o.outcomeIndex, isUpdate)))
    updateChartData()
  } catch (e) {
    console.error('Error fetching chart data', e)
  }
}

function resetCaches() {
  allDataByOutcome.clear()
  lastTimestampByOutcome.clear()
  series.value = []
  currentPrices.value = {}
}

watch(activeTimeframe, () => updateChartData())

watch(
  () => [props.marketAddr, props.outcomes?.map(o => o.outcomeIndex).join(',')],
  async () => {
    resetCaches()
    await fetchData()
  }
)

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    id: props.chartId,
    type: 'line',
    height: 350,
    zoom: { enabled: true },
    toolbar: { show: true },
    animations: { enabled: true },
    fontFamily: 'inherit',
  },
  colors: chartOutcomes.value.map((_, i) => OUTCOME_CHART_COLORS[i % OUTCOME_CHART_COLORS.length]),
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  dataLabels: { enabled: false },
  legend: {
    show: isMultiSeries.value,
    position: 'top',
    horizontalAlign: 'left',
  },
  xaxis: {
    type: 'datetime',
    tooltip: { enabled: false },
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: { colors: '#9ca3af' },
      datetimeFormatter: {
        year: 'yyyy',
        month: 'MMM',
        day: 'dd MMM',
        hour: 'HH:mm',
      },
    },
  },
  yaxis: {
    opposite: true,
    min: 0,
    max: 1,
    tickAmount: 4,
    labels: {
      formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
      style: { colors: '#9ca3af' },
    },
  },
  grid: {
    borderColor: '#f3f4f6',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { top: 0, right: 20, bottom: 0, left: 10 },
  },
  tooltip: {
    shared: true,
    intersect: false,
    x: { format: 'MM-dd HH:mm' },
    y: {
      formatter: (value: number) => `${(value * 100).toFixed(1)}%`,
    },
  },
}))

let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchData()
  timer = setInterval(() => fetchData(true), 60 * 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col min-h-[450px]">
    <div class="mb-4">
      <h2 class="text-sm font-bold text-gray-500 mb-3">
        {{ isMultiSeries ? $t('predictTrade.outcomeProbabilities') : 'Predict probability (Yes)' }}
      </h2>
      <div
        class="gap-3"
        :class="isMultiSeries ? 'grid grid-cols-1 sm:grid-cols-3' : 'flex items-baseline gap-2'"
      >
        <div
          v-for="(outcome, idx) in chartOutcomes"
          :key="outcome.outcomeIndex"
          class="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start gap-1 rounded-xl border border-gray-100 px-3 py-2"
        >
          <span class="text-sm font-medium text-gray-700 truncate" :title="outcome.label">
            {{ outcome.label }}
          </span>
          <span
            class="text-xl font-bold font-mono"
            :style="{ color: OUTCOME_CHART_COLORS[idx % OUTCOME_CHART_COLORS.length] }"
          >
            {{
              currentPrices[outcome.outcomeIndex] != null
                ? `${(currentPrices[outcome.outcomeIndex]! * 100).toFixed(1)}%`
                : '--'
            }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-[280px] w-full">
      <component
        :is="ApexCharts"
        height="100%"
        width="100%"
        :options="chartOptions"
        :series="series"
      />
    </div>

    <div class="flex justify-start gap-1 mt-4 border-t border-gray-100 pt-4">
      <button
        v-for="tf in timeframes"
        :key="tf"
        class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
        :class="activeTimeframe === tf ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
        @click="activeTimeframe = tf"
      >
        {{ tf }}
      </button>
    </div>
  </div>
</template>
