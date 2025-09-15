<script setup lang="ts">
import VueApexCharts from "vue3-apexcharts";
import {computed, ref, watch} from "vue";

const props = defineProps({
  chartId: {
    type: String,
    required: true
  },
  dataSeries: {
    type: Array,
    required: false
  }
})

const lineChartOptions = computed(() => {
  return {
    chart: {
      type: 'area',
      sparkline: {
        enabled: true
      },
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },

    },
    stroke: {
      width: 2,
    },
    grid: {
      show: false,
    },
    xaxis: {
      categories: props.dataSeries?props.dataSeries.map((item: any) => item.date):[],
      labels: {show: false},
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      show: false
    },
    tooltip: {
      enabled: false
    },
    fill: {
      colors: ['#34C759'],
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.5,
        opacityTo: 0.6,
        stops: [0, 100]
      }
    },
    colors: ['#34C759'],
  }
});
const series = computed(() => {
  return [{
    data: props.dataSeries?.map((item: any) => item.value),
    parsing: {
      x: 'date',
      y: 'value'
    }
  }]
})
</script>

<template>
  <VueApexCharts
      :width="120"
      :height="40"
      type="area"
      :id="props.chartId"
      :options="lineChartOptions"
      :series="series"
  />
</template>

<style scoped>

</style>
