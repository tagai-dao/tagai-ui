<script setup lang="ts">
import {useStateStore} from "@/stores/common";
import {formatKChartDate} from "@/utils/helper";
import {onActivated, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {getTokenTradeData} from "@/apis/api";
import {init} from "klinecharts";
import { useInterval } from "@/composables/useTools";
import { useWindowSize } from '@vant/use';
import { useRoute } from "vue-router";
import { useTheme } from "@/composables/useTheme";
import { useChainStore } from '@/stores/chain'
import emitter from '@/utils/emitter'
import { curveRefreshFrom, replaceCandleTail } from '@/utils/curveCandleTail'
import { periodChange } from '@/utils/communityChartPeriod'

const { width, height } = useWindowSize();
const props = defineProps(['tick', 'chartId', 'period', 'changeSeconds'])
const emit = defineEmits<{ change: [value: number | null] }>()
const { setInter } = useInterval();
const { isDark } = useTheme()
const chainStore = useChainStore()
let tick = ref('');
let lastTimestamp = 0;
type ChartData = {
  timestamp: number,
  open: number,
  close: number,
  low: number,
  high: number,
  pending?: boolean
}

type FormData = {
  categoryData: string[],
  values: (string | number)[][]
}
const route = useRoute()
const timeOptions = ['5min', '1h', '1d']
const activeTab = ref('5min')
let originalData: ChartData[] = []
const data1min = reactive<FormData>({categoryData: [], values: []})
const data5min = reactive<FormData>({categoryData: [], values: []})
const data1h = reactive<FormData>({categoryData: [], values: []})
const data1day = reactive<FormData>({categoryData: [], values: []})

function getInterval(timestamp: number, interval: number) {
  return Math.floor(timestamp / interval);
}

function splitData(rawData: (ChartData)[], interval = 60) {
  rawData = rawData.filter(data =>
    Number.isFinite(Number(data?.timestamp)) &&
    Number.isFinite(Number(data?.open)) &&
    Number.isFinite(Number(data?.close)) &&
    Number.isFinite(Number(data?.low)) &&
    Number.isFinite(Number(data?.high))
  )
  if (rawData.length === 0) return {categoryData: [], values: []};
  let categoryData = [];
  let values = [];
  let lastData: any;
  let lastInterval = getInterval(rawData[0].timestamp, interval);
  const price = useStateStore().ethPrice;
  for (let data of rawData) {
    const thisInterval = getInterval(data.timestamp, interval)
    if(values.length === 0){
      categoryData.push(formatKChartDate(thisInterval * interval * 1000, interval >= 86400));
      let data0 = {
        open: (data.open / 1e18 * price),
        close: (data.close / 1e18 * price),
        low: (data.low / 1e18 * price),
        high: (data.high / 1e18 * price),
        timestamp: thisInterval * interval * 1000
      }
      values.push(data0);
      lastData = data0
      continue;
    }
    let lowest = Math.min(data.open, data.close, data.low, data.high) / 1e18 * price
    let highest = Math.max(data.open, data.close, data.low, data.high) / 1e18 * price;
    lowest = Math.min(lowest, lastData.close)
    highest = Math.max(highest, lastData.close)
    if (thisInterval == lastInterval) {
      lowest = Math.min(lowest, lastData.low)
      highest = Math.max(highest, lastData.high)
      lastData = {
        open: lastData.open,
        close: (data.close / 1e18 * price),
        low: lowest,
        high: highest,
        timestamp: thisInterval * interval * 1000
      }
      values[values.length - 1] = lastData;
    }else if (thisInterval > lastInterval + 1) {
      lastInterval = lastInterval + 1
      while(thisInterval > lastInterval + 1) {
        lastInterval = lastInterval + 1
      }
      categoryData.push(formatKChartDate((lastInterval + 1) * interval * 1000, interval >= 86400));
      lastData = {
        open: lastData.close,
        close: (data.close / 1e18 * price),
        low: lowest,
        high: highest,
        timestamp: (lastInterval + 1) * interval * 1000
      }
      values.push(lastData);
      lastInterval += 1;
    }else {
      categoryData.push(formatKChartDate(thisInterval * interval * 1000, interval >= 86400));
      lastData = {
        open: lastData.close,
        close: (data.close / 1e18 * price),
        low: lowest,
        high: highest,
        timestamp: (lastInterval + 1) * interval * 1000
      }
      values.push(lastData);
      lastInterval = thisInterval;
    }
  }
  return {
    categoryData: categoryData,
    values: values
  };
}
const chartRef = ref<HTMLElement>()
const chart = ref()

/** 暗色网格用低对比灰，避免默认 #EDEDED 在深底上刺眼 */
const applyChartTheme = () => {
  if (!chart.value) return
  const gridColor = isDark.value ? '#2A2F38' : '#EDEDED'
  const textColor = isDark.value ? '#9AA0AD' : '#76808F'
  chart.value.setStyles({
    grid: {
      show: true,
      horizontal: { show: true, color: gridColor },
      vertical: { show: true, color: gridColor },
    },
    candle: {
      priceMark: {
        high: { color: textColor },
        low: { color: textColor },
      },
      tooltip: {
        custom: [
          { title: 'time', value: '{time}' },
          { title: 'open', value: '{open}' },
          { title: 'high', value: '{high}' },
          { title: 'low', value: '{low}' },
          { title: 'close', value: '{close}' },
          { title: '', value: `{change}` },
        ]
      }
    },
    xAxis: {
      axisLine: { color: gridColor },
      tickLine: { color: gridColor },
      tickText: { color: textColor },
    },
    yAxis: {
      axisLine: { color: gridColor },
      tickLine: { color: gridColor },
      tickText: { color: textColor },
    },
  })
}

function updateChart() {
  if (props.changeSeconds) emit('change', periodChange(originalData, Number(props.changeSeconds)))
  if (!chart.value) return
  if(activeTab.value ==='5min') chart.value.applyNewData(data5min.values);
  else if(activeTab.value ==='1h') chart.value.applyNewData(data1h.values);
  else if(activeTab.value ==='1d') chart.value.applyNewData(data1day.values);
}

function setChartRows(rows: ChartData[]) {
  originalData = rows
  lastTimestamp = rows.length ? Number(rows[rows.length - 1].timestamp) : 0
  for (const [target, interval] of [[data1min,60],[data5min,300],[data1h,3600],[data1day,86400]] as const) {
    const data = splitData(rows, interval)
    target.categoryData = data.categoryData
    target.values = data.values
  }
}

async function getNewData() {
  const requestedTick = props.tick
  const requestedChain = chainStore.activeChainId
  try {
    const rows: any = await getTokenTradeData(requestedTick, undefined, true)
    if (requestedTick === props.tick && requestedChain === chainStore.activeChainId && Array.isArray(rows)) setChartRows(rows)
  } catch (_) {}
}

let refreshing = false
async function refreshData() {
  if (refreshing) return
  refreshing = true
  const requestedTick = props.tick
  const requestedChain = chainStore.activeChainId
  const from = requestedChain === 56 ? curveRefreshFrom(originalData) : lastTimestamp
  try {
    const rows: any = await getTokenTradeData(requestedTick, from || undefined, true)
    if (requestedTick !== props.tick || requestedChain !== chainStore.activeChainId || !Array.isArray(rows)) return
    setChartRows(requestedChain === 56 ? replaceCandleTail(originalData, rows, from) : originalData.concat(rows))
    updateChart()
  } catch (error) { console.warn('Chart refresh failed', error) }
  finally { refreshing = false }
}

onActivated(async () => {
  if (route.params.id !== tick.value) {
    setChartRows([])
    tick.value = route.params.id as string
    await getNewData()
    updateChart()
    setInter(refreshData, 3000)
  }
})

onUnmounted(() => emitter.off('newTrade', refreshData))

onMounted(async () => {
  tick.value = route.params.id as string
  await getNewData()
  if (!chartRef.value) return;
  chart.value = init(chartRef.value,  {
    decimalFoldThreshold: 4,
    layout: [
      {
        // @ts-ignore
        type: 'candle',
        options: {
          gap: {
            top: 150
          }
        }
      }
    ]
  });
  applyChartTheme()
  chart.value.setPriceVolumePrecision(6, 2)
  updateChart();
  setInter(refreshData, 3000)
  emitter.on('newTrade', refreshData)
})

watch(()=> activeTab.value, () => {
  updateChart()
})
watch(() => props.period, value => {
  if (value && timeOptions.includes(value)) activeTab.value = value
}, { immediate: true })
watch(() => props.changeSeconds, () => {
  if (props.changeSeconds) emit('change', periodChange(originalData, Number(props.changeSeconds)))
})

watch(() => width.value, () => {
  chart.value.resize()
})

watch(() => isDark.value, () => {
  applyChartTheme()
})

watch(() => useStateStore().ethPrice, (newPrice, oldPrice) => {
  if (oldPrice === 0 && newPrice > 0 && originalData.length > 0) {
    const m1 = splitData(originalData, 60)
    const m5 = splitData(originalData, 300)
    const h1 = splitData(originalData, 3600)
    const day1 = splitData(originalData, 86400)
    data1min.categoryData = m1.categoryData; data1min.values = m1.values;
    data5min.categoryData = m5.categoryData; data5min.values = m5.values;
    data1h.categoryData = h1.categoryData; data1h.values = h1.values;
    data1day.categoryData = day1.categoryData; data1day.values = day1.values;
    if (chart.value) updateChart();
  }
})

</script>

<template>
  <div class="pt-4 px-4 pb-5 rounded-2xl min-h-[400px] w-full bg-surface flex flex-col">
    <div class="mb-4 px-3 flex flex-wrap justify-between gap-y-2 gap-x-4">
      <span class="font-medium text-content text-xl">{{tick + '/USDT'}}</span>
      <div v-if="!period" class="flex-1 flex justify-end items-center gap-4">
        <button v-for="t of timeOptions" :key="t" class="flex items-center gap-1"
                @click="activeTab=t">
          <span class="text-sm font-light text-muted">{{t}}</span>
          <span class="flex min-w-8 w-8 h-4 rounded-[5px]"
                :class="activeTab===t?'bg-green-2f':'bg-grey-light-hover'"></span>
        </button>
      </div>
    </div>
    <div ref="chartRef" class="k-line-chart flex flex-1 z-0"/>
  </div>
</template>

<style scoped>

</style>
