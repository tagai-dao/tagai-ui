<script setup lang="ts">
import {useCreateTweet} from "@/composables/useCreateTweet";
import { EmojiPicker } from 'vue3-twemoji-picker-final'
import { onMounted, reactive, ref } from "vue";
import { getTokenTradeData } from '@/apis/api'
import { OperateType, useTweet } from "@/composables/useTweet";
import { handleErrorTip, notify } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import { useCommunityStore } from "@/stores/community";
import { useAccount } from "@/composables/useAccount";
import emitter from "@/utils/emitter";
import * as echarts from 'echarts';
import { formatAmount, formatKChartDate, formatPrice } from "@/utils/helper";
import { useStateStore } from "@/stores/common";

const props = defineProps(['tick'])
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


function splitData(rawData: (ChartData)[], interval = 60) {
  let categoryData = [];
  let values = [];
  let lastData: any;
  let currentTime = rawData[0].timestamp;
  const price = useStateStore().ethPrice;
  for (let data of rawData) {
    if(values.length === 0){
        categoryData.push(formatKChartDate(data.timestamp * 1000));
        let data0 = [
            (data.low / 1e18 * price),
            (data.close / 1e18 * price),
            (data.low / 1e18 * price),
            (data.high / 1e18 * price)
        ]
        values.push(data0);
        lastData = data0
        currentTime = data.timestamp
    }else if (data.timestamp == currentTime){
        lastData = [
            lastData[0],
            data.close / 1e18 * price,
            Math.min(data.low / 1e18 * price, lastData[2]),
            Math.max(data.high / 1e18 * price, lastData[3])
        ]
        values[values.length - 1] = lastData
    }else if (data.timestamp > currentTime + interval) {
        categoryData.push(formatKChartDate(data.timestamp * 1000 + interval * 1000));
        lastData = [
            lastData[1],
            lastData[1],
            lastData[1],
            lastData[1]
        ]
        currentTime = currentTime + interval
        values.push(lastData)
        while(data.timestamp > currentTime + interval) {
            categoryData.push(formatKChartDate(currentTime * 1000 + interval * 1000));
            lastData = [
                lastData[1],
                data.close / 1e18 * price,
                data.low / 1e18 * price,
                data.high / 1e18 * price
            ]
            currentTime = data.timestamp
            values.push(lastData)
        }
        categoryData.push(formatKChartDate(data.timestamp * 1000));
        let data0 = [
            lastData.close,
            (data.close / 1e18 * price),
            (data.low / 1e18 * price),
            (data.high / 1e18 * price)
        ]
        values.push(0);
        lastData = data0
        currentTime = data.timestamp
    }else {
        categoryData.push(formatKChartDate(data.timestamp * 1000));
        let data0 = [
            lastData.close,
            (data.close / 1e18 * price),
            (data.low / 1e18 * price),
            (data.high / 1e18 * price)
        ]
        values.push(0);
        lastData = data0
        currentTime = data.timestamp
    }
  }
  return {
    categoryData: categoryData,
    values: values
  };
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
            let d1 = splitData(res, 60)
            let d5 = splitData(res, 300)
            let day1 = splitData(res, 86400)
            data1min.categoryData = d1.categoryData;
            data1min.values = d1.values;
            data5min.categoryData = d5.categoryData;
            data5min.values = d5.values;
            data1day.categoryData = day1.categoryData;
            data1day.values = day1.values
            console.log(42, day1)
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
            text: props.tick + '/ETH',
            left: 0
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            },
            confine: true,
        },
        select: {
            disabled: false
        },
        legend: {
            data: ['1min', '5min', '1d'],
            selectedMode: 'single',
        },
        grid: {
            left: '10%',
            right: '10%',
            bottom: '15%'
        },
        xAxis: {
            type: 'category',
            data: data1min.categoryData,
            boundaryGap: false,
            axisLine: { onZero: false },
            splitLine: { show: false },
            min: 'dataMin',
            max: 'dataMax'
        },
        yAxis: {
            scale: true,
            splitArea: {
                show: true
            }
        },
        dataZoom: [
            {
                type: 'inside',
                start: 50,
                end: 100
            },
            // {
            //     show: true,
            //     type: 'slider',
            //     top: '90%',
            //     start: 50,
            //     end: 100
            // }
        ],
        series: [
            {
            name: '1min',
            type: 'candlestick',
            data: data1min.values,
            itemStyle: {
                color: upColor,
                color0: downColor,
                borderColor: upBorderColor,
                borderColor0: downBorderColor
            },
            },
            {
            name: '5min',
            type: 'candlestick',
            data: data5min.values,
            itemStyle: {
                color: upColor,
                color0: downColor,
                borderColor: upBorderColor,
                borderColor0: downBorderColor
            },
            markLine: {
                symbol: ['none', 'none'],
                data: [
                [
                    {
                    name: 'from lowest to highest',
                    type: 'min',
                    valueDim: 'lowest',
                    symbol: 'circle',
                    symbolSize: 10,
                    label: {
                        show: false
                    },
                    emphasis: {
                        label: {
                        show: false
                        }
                    }
                    },
                    {
                    type: 'max',
                    valueDim: 'highest',
                    symbol: 'circle',
                    symbolSize: 10,
                    label: {
                        show: false
                    },
                    emphasis: {
                        label: {
                        show: false
                        }
                    }
                    }
                ],
                {
                    name: 'min line on close',
                    type: 'min',
                    valueDim: 'close'
                },
                {
                    name: 'max line on close',
                    type: 'max',
                    valueDim: 'close'
                }
                ]
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
            },
            markLine: {
                symbol: ['none', 'none'],
                data: [
                [
                    {
                    name: 'from lowest to highest',
                    type: 'min',
                    valueDim: 'lowest',
                    symbol: 'circle',
                    symbolSize: 10,
                    label: {
                        show: false
                    },
                    emphasis: {
                        label: {
                        show: false
                        }
                    }
                    },
                    {
                    type: 'max',
                    valueDim: 'highest',
                    symbol: 'circle',
                    symbolSize: 10,
                    label: {
                        show: false
                    },
                    emphasis: {
                        label: {
                        show: false
                        }
                    }
                    }
                ],
                {
                    name: 'min line on close',
                    type: 'min',
                    valueDim: 'close'
                },
                {
                    name: 'max line on close',
                    type: 'max',
                    valueDim: 'close'
                }
                ]
            }
            }
        ]
    };

    kChart = echarts.init(chartdom.value, null, {
        renderer: 'canvas',
        useDirtyRect: false
    });
    kChart.setOption(option.value)
}

onMounted(async () => {
    getNewData()
})

</script>

<template>
  <div class="py-5 px-4 rounded-2xl h-500px min-h-[500px] w-full">
   <div ref="chartdom" class="h-full w-full">
   </div>
  </div>
</template>

<style scoped>

</style>
