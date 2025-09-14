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
      width: '100%',
      height: 200,
      type: 'line',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },

    },
    stroke: {
      width: 1,
    },
    grid: {
      show: false
    },
    xaxis: {
      categories: props.dataSeries?props.dataSeries.map(item => item.date):[],
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
    }
  }
});
const series = computed(() => {
  return [{
    data: props.dataSeries?.map(item => item.value),
    parsing: {
      x: 'date',
      y: 'value'
    }
  }]
})
</script>

<template>
  <div>
    <VueApexCharts
        :id="props.chartId"
        type="line"
        :options="lineChartOptions"
        :series="series"
        class="w-full"
    />
  </div>
</template>

<style scoped>

</style>