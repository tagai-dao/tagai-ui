<script setup lang="ts">
import VueApexCharts from "vue3-apexcharts";
import {computed, reactive, ref, watch} from "vue";
import { type MindShare } from "@/types";
import { onMounted } from "vue";
import type { ApexOptions } from "apexcharts";

// 类型断言来解决 vue3-apexcharts 的类型问题
const ApexCharts = VueApexCharts as any;

const props = defineProps({
  chartId: {
    type: String,
    required: true
  },
  dataSeries: {
    type: Array,
    required: false
  },
  mindShare: {
    type: Object,
    required: false
  }
})

const mindShareMid = computed(() => {
  // 获取mindShare.percents的中位数
  return props.mindShare?.percents.length > 0 ? props.mindShare?.percents.sort((a: number, b: number) => a - b)[Math.floor(props.mindShare.percents.length / 2)] : 0
})

const lineChartOptions = ref<ApexOptions>({})

onMounted(() => {
  lineChartOptions.value = {
    chart: {
      type: 'line',
      sparkline: {enabled: true},
      toolbar: {show: false},
      zoom: {enabled: false},
    },
    grid: {show: false,},
    xaxis: {
      categories: props.dataSeries?props.dataSeries.map((item: any) => item.date):[],
      labels: {show: false},
      axisBorder: {show: false},
      axisTicks: {show: false}
    },
    yaxis: {show: false},
    tooltip: {enabled: false},
    fill: {
      type: 'gradient',
      colors: ['#34C759'],
      gradient: {
        opacityFrom: 0.5,
        opacityTo: 0.6,
        stops: [0, 100]
      }
    },
    stroke: {
      width: 2,
      curve: 'smooth'
    },
    plotOptions: {
      area: {
        fillTo: 'end',
      },
      line: {
        colors: {
          threshold: mindShareMid.value,
          colorAboveThreshold: '#34C759',
          colorBelowThreshold: '#E6374D',
        },
      },
    }
  }
})
const series = computed(() => {
  return [{
    data: props.dataSeries?.map((item: any) => item.value)
  }]
})
</script>

<template>
  <component
      :is="ApexCharts"
      :width="80"
      :height="40"
      :id="props.chartId"
      :options="lineChartOptions"
      :series="series"
  />
</template>

<style scoped>

</style>
