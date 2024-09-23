<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { getTokenTradeData } from '@/apis/api'
import * as echarts from 'echarts';
import { formatAmount, formatKChartDate, formatPrice, formatDate } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { useInterval } from "@/composables/useTools";

const props = defineProps(['tick'])
const start = ref(0)
const end = ref(0)
let lastStart = 0;
let lastEnd = 0;
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
const data1min = reactive<FormData>({categoryData: [''], values: [[3]]})
const data5min = reactive<FormData>({categoryData: [''], values: [[3]]})
const data1h = reactive<FormData>({categoryData: [''], values: [[3]]})
const data1day = reactive<FormData>({categoryData: [''], values: [[3]]})

type EChartsOption = echarts.EChartsOption;
const upColor = '#35aa3e';
const upBorderColor = '#158a6e';
const downColor = '#ec1c36';
const downBorderColor = '#ec1c36';
const barCount = 40;
const chartdom = ref()
let kChart: any = null;
const option = ref<EChartsOption>();

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
        let data0 = [
            (data.low / 1e18 * price),
            (data.close / 1e18 * price),
            (data.low / 1e18 * price),
            (data.high / 1e18 * price)
        ]
        values.push(data0);
        lastData = data0
        continue;
    }
    let lowest = Math.min(data.open, data.close, data.low, data.high) / 1e18 * price
    let highest = Math.max(data.open, data.close, data.low, data.high) / 1e18 * price;
    lowest = Math.min(lowest, lastData[1])
    highest = Math.max(highest, lastData[1])
    if (thisInterval == lastInterval) {
        lowest = Math.min(lowest, lastData[2])
        highest = Math.max(highest, lastData[3])
        lastData = [
            lastData[0],
            data.close / 1e18 * price,
            lowest,
            highest
        ]
        values[values.length - 1] = lastData;
    }else if (thisInterval > lastInterval + 1) {
        categoryData.push(formatKChartDate((lastInterval + 1) * interval * 1000, interval >= 86400));
        lastData = [
            lastData[1],
            lastData[1],
            lastData[1],
            lastData[1]
        ]
        lastInterval = lastInterval + 1
        values.push(lastData)
        while(thisInterval > lastInterval + 1) {
            lastInterval = lastInterval + 1
            categoryData.push(formatKChartDate(lastInterval * interval * 1000, interval >= 86400));
            values.push(lastData)
        }
        categoryData.push(formatKChartDate((lastInterval + 1) * interval * 1000, interval >= 86400));
        lastData = [
            lastData[1],
            (data.close / 1e18 * price),
            lowest,
            highest
        ]
        values.push(lastData);
        lastInterval += 1;
    }else {
        categoryData.push(formatKChartDate(thisInterval * interval * 1000, interval >= 86400));
        lastData = [
            lastData[1],
            (data.close / 1e18 * price),
            lowest,
            highest
        ]
        values.push(lastData);
        lastInterval = thisInterval;
    }
  }
  return {
    categoryData: categoryData,
    values: values
  };
}

function getDay(timestamp: number) {
    return Math.floor(timestamp / 86400)
}

function calculateMA(dayCount: number) {
//   var result = [];
//   for (var i = 0, len = data1min.value.values.length; i < len; i++) {
//     if (i < dayCount) {
//       result.push('-');
//       continue;
//     }
//     var sum = 0;
//     for (var j = 0; j < dayCount; j++) {
//       sum += +data0.values[i - j][1];
//     }
//     result.push(sum / dayCount);
//   }
//   return result;
}

async function getNewData() {
    try{
        let res: any = await getTokenTradeData(props.tick, undefined, true);
        if (res && res.length > 0) {
            console.log(32, res.map((res: any) => {
                return {
                    ...res,
                    time: formatDate(res.timestamp * 1000)
                }
            }))
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

            start.value = Math.max(0, data5min.values.length - 15) * 100 / data5min.values.length;
            end.value = 100
            lastStart = start.value;
            lastEnd = 100;
            updateChart();
        }
    } catch (e) {

    } finally {

    }
}

async function updateChart() {
    option.value = {
        animation: true,
        title: {
            text: props.tick + '/USDT',
            left: 0
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                label: {
                    precision: 8
                }
            },
            confine: true,
            valueFormatter: (v: any) => formatPrice(v)
        },
        select: {
            disabled: false
        },
        legend: {
            data: ['5min', '1h', '1d'],
            selectedMode: 'single',
            right: '0'
        },
        grid: {
          left: 80,
          right: 20,
          bottom: 30,
          borderColor: '#C9C9C9'
        },
        xAxis: {
            type: 'category',
            data: data5min.categoryData,
            boundaryGap: false,
            axisLine: { onZero: false },
            splitLine: { show: false },
            min: -1,
            max: lastEnd + 1
        },
        yAxis: {
          scale: true,
          splitLine: {
            show: true
          }
        },
        dataZoom: [{
          type: 'inside',
          minValueSpan: 5,
          maxValueSpan: 60,
          start: start.value,
          end: 100,
          orient: 'horizontal'
        }],
        series: [
            {
                name: '5min',
                type: 'candlestick',
                data: data1min.values,
                itemStyle: {
                    color: upColor,
                    color0: downColor,
                    borderColor: upBorderColor,
                    borderColor0: downBorderColor
                }
            },
            {
                name: '1h',
                type: 'candlestick',
                data: data5min.values,
                itemStyle: {
                    color: upColor,
                    color0: downColor,
                    borderColor: upBorderColor,
                    borderColor0: downBorderColor
                }
            },
            {
                name: '1d',
                type: 'candlestick',
                data: data1day.values,
                itemStyle: {
                    color: upColor,
                    color0: downColor,
                    borderColor: upBorderColor,
                    borderColor0: downBorderColor
                }
            }
        ]
    };

    kChart = echarts.init(chartdom.value, null, {
        renderer: 'canvas',
        useDirtyRect: false
    });
    kChart.setOption(option.value)
    kChart.on('legendselectchanged', (params: any) => {
        let length = 0
        let category: any
        if (params.name == '5min') {
            length = data5min.values.length;
            category = data5min.categoryData;
        }else if(params.name === '1h') {
            length = data1h.values.length;
            category = data1h.categoryData
        }else if (params.name === '1d') {
            length = data1day.values.length;
            category = data1day.categoryData
        }
        start.value = (length > 15 ? length - 15 : 0) * 100 / length;
        end.value = 100;
        kChart.setOption({
            dataZoom: [
                {
                    type: 'inside',
                    start: start.value,
                    end: 100
                },
            ],
            xAxis: {
                type: 'category',
                data: category,
                boundaryGap: false,
                axisLine: { onZero: false },
                splitLine: { show: false },
                min: -1,
                max: length + 2
            },
        })
    })
    kChart.on('dataZoom', (params: any) => {
        // const dataZoom = params.batch ? params.batch[0] : params;
        // const zoom = kChart.getOption().dataZoom[0];
        // const preRange = (lastEnd - lastStart).toFixed(6);
        // const currentRange = (dataZoom.end - dataZoom.start).toFixed(6);
        // console.log(33222, params, dataZoom, preRange, currentRange)
        // if (preRange == currentRange) {
        //     // 拖动
        //     lastEnd = dataZoom.end;
        //     lastStart = dataZoom.start;
        // }else {
        //     // 缩放
        //     zoom.end = lastEnd;
        //     kChart.setOption({
        //         dataZoom: [zoom]
        //     })
        // }
    })
    window.addEventListener('resize', () => {
        kChart.resize();
    })
}

onMounted(async () => {
    getNewData()
})

</script>

<template>
  <div class="py-5 px-4 rounded-2xl h-500px min-h-[500px] w-full bg-white">
   <div ref="chartdom" class="h-full w-full">
   </div>
  </div>
</template>

<style scoped>

</style>
