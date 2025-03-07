<script setup lang="ts">
import {useStateStore} from "@/stores/common";
import {formatKChartDate} from "@/utils/helper";
import {onActivated, onMounted, reactive, ref, watch} from "vue";
import {getTokenTradeData} from "@/apis/api";
import {init} from "klinecharts";
import { useInterval } from "@/composables/useTools";
import { useWindowSize } from '@vant/use';
import { useRoute } from "vue-router";

const { width, height } = useWindowSize();
const props = defineProps(['tick', 'chartId'])
const { setInter } = useInterval();
let tick = ref('');
let lastTimestamp = 0;
type ChartData = {
  timestamp: number,
  open: number,
  close: number,
  low: number,
  high: number
}

type FormData = {
  categoryData: string[],
  values: (string | number)[][]
}
const route = useRoute()
const timeOptions = ['5min', '1h', '1d']
const activeTab = ref('5min')
let originalData: ChartData[] = []
const data1min = reactive<FormData>({categoryData: [''], values: [[3]]})
const data5min = reactive<FormData>({categoryData: [''], values: [[3]]})
const data1h = reactive<FormData>({categoryData: [''], values: [[3]]})
const data1day = reactive<FormData>({categoryData: [''], values: [[3]]})

function getInterval(timestamp: number, interval: number) {
  return Math.floor(timestamp / interval);
}

function splitData(rawData: (ChartData)[], interval = 60) {
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
      // categoryData.push(formatKChartDate((lastInterval + 1) * interval * 1000, interval >= 86400));
      // lastData = {
      //   open: lastData.close,
      //   close: lastData.close,
      //   low: lastData.close,
      //   high: lastData.close,
      //   timestamp: (lastInterval + 1) * interval * 1000
      // }
      lastInterval = lastInterval + 1
      // values.push(lastData)
      while(thisInterval > lastInterval + 1) {
        lastInterval = lastInterval + 1
        // categoryData.push(formatKChartDate(lastInterval * interval * 1000, interval >= 86400));
        // values.push({
        //   ...lastData,
        //   timestamp: lastInterval * interval * 1000
        // })
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
const chart = ref()
function updateChart() {
  if(activeTab.value ==='5min') chart.value.applyNewData(data5min.values);
  if(activeTab.value ==='1h') chart.value.applyNewData(data1h.values);
  if(activeTab.value ==='1d') chart.value.applyNewData(data1day.values);
}

async function getNewData() {
  try{
    let res: any = await getTokenTradeData(props.tick, undefined, true);
    if (res && res.length > 0) {
      originalData = res as ChartData[];
      lastTimestamp = res[res.length - 1].timestamp;
      let m1 = splitData(res, 60)
      let m5 = splitData(res, 300)
      let h1 = splitData(res, 3600)
      let day1 = splitData(res, 86400)
      data1min.categoryData = m1.categoryData;
      data1min.values = m1.values;
      data5min.categoryData = m5.categoryData;
      data5min.values = m5.values;
      data1day.categoryData = day1.categoryData;
      data1day.values = day1.values;
      data1h.categoryData = h1.categoryData;
      data1h.values = h1.values;
    }
  } catch (e) {

  } finally {

  }
}

onActivated(async () => {
  if (route.params.id !== tick.value) {
    originalData = []
    tick.value = route.params.id as string
    await getNewData()
    updateChart()
    setInter(async () => {
      try{
        let res: any = await getTokenTradeData(tick.value, lastTimestamp, true);
        if (res && res.length > 0) {
          originalData = originalData.concat(res as ChartData[])
          lastTimestamp = res[res.length - 1].timestamp
          let m1 = splitData(originalData, 60)
          let m5 = splitData(originalData, 300)
          let h1 = splitData(originalData, 3600)
          let day1 = splitData(originalData, 86400)
          data1min.categoryData = m1.categoryData;
          data1min.values = m1.values;
          data5min.categoryData = m5.categoryData;
          data5min.values = m5.values;
          data1day.categoryData = day1.categoryData;
          data1day.values = day1.values;
          data1h.categoryData = h1.categoryData;
          data1h.values = h1.values;
          updateChart();
        }
      } catch (e) {
        console.log(53331, e)
      } finally {

    }
  }, 3000)
  }
})

onMounted(async () => {
  tick.value = route.params.id as string
  await getNewData()
  chart.value = init(props.chartId,  {
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
  chart.value.setStyles({
    candle: {
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
    }
  })
  chart.value.setPriceVolumePrecision(6, 2)
  updateChart();
  setInter(async () => {
    try{
      let res: any = await getTokenTradeData(tick.value, lastTimestamp, true);
      if (res && res.length > 0) {
        originalData = originalData.concat(res as ChartData[])
        lastTimestamp = res[res.length - 1].timestamp
        let m1 = splitData(originalData, 60)
        let m5 = splitData(originalData, 300)
        let h1 = splitData(originalData, 3600)
        let day1 = splitData(originalData, 86400)
        data1min.categoryData = m1.categoryData;
        data1min.values = m1.values;
        data5min.categoryData = m5.categoryData;
        data5min.values = m5.values;
        data1day.categoryData = day1.categoryData;
        data1day.values = day1.values;
        data1h.categoryData = h1.categoryData;
        data1h.values = h1.values;
        updateChart();
      }
    } catch (e) {
      console.log(5333, e)
    } finally {

    }
  }, 3000)
})

watch(()=> activeTab.value, () => {
  updateChart()
})

watch(() => width.value, () => {
  chart.value.resize()
})

</script>

<template>
  <div class="pt-4 px-4 pb-5 rounded-2xl min-h-[400px] w-full bg-white flex flex-col">
    <div class="mb-4 px-3 flex flex-wrap justify-between gap-y-2 gap-x-4">
      <span class="font-medium text-black text-xl">{{tick + '/USDT'}}</span>
      <div class="flex-1 flex justify-end items-center gap-4">
        <button v-for="t of timeOptions" :key="t" class="flex items-center gap-1"
                @click="activeTab=t">
          <span class="text-sm font-light">{{t}}</span>
          <span class="flex min-w-8 w-8 h-4 rounded-[5px]"
                :class="activeTab===t?'bg-green-2f':'bg-grey-light-hover'"></span>
        </button>
      </div>
    </div>
    <div :id="chartId" class="k-line-chart flex flex-1"/>
  </div>
</template>

<style scoped>

</style>
