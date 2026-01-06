<script setup lang="ts">
import VueApexCharts from "vue3-apexcharts";
import { computed, onMounted, ref, watch, onUnmounted } from "vue";
import { getFPMMKlineData } from "@/apis/api";
import type { ApexOptions } from "apexcharts";
import type { KlineData } from "@/types";
import { useInterval } from "@/composables/useTools";

const ApexCharts = VueApexCharts as any;

const props = defineProps<{
  marketAddr: string;
  chartId: string;
}>();

const { setInter } = useInterval();
let lastTimestamp = 0;
const series = ref<{ name: string; data: [number, number][] }[]>([
  { name: "Probability", data: [] },
]);
const currentPrice = ref<number | null>(null);
const priceChange = ref<number | null>(null);

// Timeframe options
const timeframes = ["1MIN", "5MIN", "1H"];
const activeTimeframe = ref("1MIN");

// All data cache
let allData: KlineData[] = [];

// Fetch data
async function fetchData(isUpdate = false) {
  try {
    const res: any = await getFPMMKlineData(
      props.marketAddr,
      isUpdate ? lastTimestamp : undefined,
      true
    );

    console.log(53, res)

    if (res && res.length > 0) {
      const newItems = res as KlineData[];
      
      if (isUpdate && allData.length > 0) {
         // Filter out duplicates based on timestamp
         const uniqueNewItems = newItems.filter(item => item.timestamp > lastTimestamp);
         allData = allData.concat(uniqueNewItems);
      } else {
         allData = newItems;
      }
      
      if (allData.length > 0) {
        lastTimestamp = allData[allData.length - 1].timestamp;
      }
      
      updateChartData();
    }
  } catch (e) {
    console.error("Error fetching chart data", e);
  }
}

function updateChartData() {
  if (allData.length === 0) return;

  const now = new Date().getTime(); // ms
  
  // Prepare source data for aggregation
  // Input: API data with seconds timestamp
  const sourceData = allData.map(d => ({
      ...d,
      timestamp: d.timestamp * 1000 // Convert to ms
  }));

  // Determine cutoff and interval based on activeTimeframe
  let cutoff = 0;
  let aggregationInterval = 60 * 1000; // Default 1 min in ms
  
  const lastTime = sourceData[sourceData.length - 1].timestamp;
  
  switch (activeTimeframe.value) {
    case "1MIN":
        // Show last 60 points? Or all? User requested 1min chart.
        // Usually means 1min interval. Let's show recent history or all.
        // Assuming user means granularity. 
        aggregationInterval = 60 * 1000; 
        cutoff = lastTime - 60 * 60 * 1000; // Show last 1 hour by default for 1min view?
        // Or actually, user said "generate 1 min, 5 min, 1h line chart data"
        // This implies the X-axis granularity.
        break;
    case "5MIN":
        aggregationInterval = 5 * 60 * 1000;
        cutoff = lastTime - 24 * 60 * 60 * 1000; // Show last 24h for 5min?
        break;
    case "1H":
        aggregationInterval = 60 * 60 * 1000;
        cutoff = 0; // Show all history for 1H?
        break;
    default:
        aggregationInterval = 60 * 1000;
        cutoff = 0;
  }

  // Filter data by cutoff
  let processedData = sourceData;
  if (activeTimeframe.value === "1MIN") {
      // For 1MIN view, maybe we don't cut off everything, but Polymarket style usually shows specific range.
      // Let's just show all available 1-min data if "ALL" isn't an option but we have specific interval buttons.
      // Wait, user provided: "1min, 5min, 1h" buttons.
      // Usually these mean "Interval size".
      // Let's implement aggregation.
  }

  // Aggregate data if needed
  if (aggregationInterval > 60 * 1000) {
      const aggregated: KlineData[] = [];
      let currentBucketStart = 0;
      let bucketClose = 0;
      
      for (const item of sourceData) {
          const bucketStart = Math.floor(item.timestamp / aggregationInterval) * aggregationInterval;
          
          if (bucketStart !== currentBucketStart) {
              if (currentBucketStart !== 0) {
                  aggregated.push({
                      timestamp: currentBucketStart, // Store as ms
                      close: bucketClose,
                      open: 0, high: 0, low: 0, fpmm: "" // dummy
                  });
              }
              currentBucketStart = bucketStart;
          }
          bucketClose = item.close; // Last close in bucket is bucket close
      }
      
      // Push last bucket
      if (currentBucketStart !== 0) {
          aggregated.push({
              timestamp: currentBucketStart,
              close: bucketClose,
              open: 0, high: 0, low: 0, fpmm: ""
          });
      }
      
      // Override processedData with aggregated
      // Note: aggregated timestamp is ms
      processedData = aggregated.map(d => ({...d, timestamp: d.timestamp})); // already ms
  }

  // Map to [timestamp, close]
  const dataPoints: [number, number][] = processedData.map((d) => [
    d.timestamp,
    d.close,
  ]);

  series.value = [{ name: "Probability", data: dataPoints }];

  // Update current price and change
  if (processedData.length > 0) {
    const last = processedData[processedData.length - 1];
    currentPrice.value = last.close;
    
    // Calculate change over the visible period
    const first = processedData[0];
    if (first) {
        priceChange.value = last.close - first.close;
    }
  }
}

const chartOptions = computed<ApexOptions>(() => {
  return {
    chart: {
      type: "area",
      height: 350,
      zoom: { enabled: true },
      toolbar: { show: true },
      animations: { enabled: true }, // Disable for performance with many points
      fontFamily: 'inherit'
    },
    annotations: {
      yaxis: [
        {
          y: 0.5,
          borderColor: '#9ca3af',
          strokeDashArray: 4,
          opacity: 0.5,
          label: {
            text: '50%',
            style: {
              color: '#fff',
              background: '#9ca3af',
            },
            position: 'left',
            offsetX: 50,
          },
        }
      ]
    },
    colors: ["#EF5350"], // Red color
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth", // Smooth curve
      width: 2,
    },
    xaxis: {
      type: "datetime",
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
          }
      }
    },
    yaxis: {
      opposite: true, // Move y-axis to the right
      labels: {
        formatter: (value: number) => {
          return (value * 100).toFixed(0) + "%";
        },
        style: { colors: '#9ca3af' }
      },
      // min: 0,
      // max: 1, // Probability usually 0-1
      tickAmount: 4
    },
    grid: {
      borderColor: "#f3f4f6",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }, 
      padding: { top: 0, right: 20, bottom: 0, left: 10 }
    },
    tooltip: {
      x: { format: "MM-dd HH:mm" },
      y: {
        formatter: (value: number) => {
          return (value * 100).toFixed(1) + "%";
        },
      },
    },
  };
});

// Watch timeframe change
watch(activeTimeframe, () => {
  updateChartData();
});

let timer: any = null;

onMounted(async () => {
  await fetchData();
  
  // Poll for updates every minute
  timer = setInterval(() => {
      fetchData(true);
  }, 60 * 1000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
})

</script>

<template>
  <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col h-[450px]">
    <!-- Header info -->
    <div class="flex justify-between items-start mb-6">
        <div>
            <div class="flex items-baseline gap-2">
                <h1 class="text-3xl text-bold">
                    Predict probability(Red)
                </h1>
                <span class="text-xl font-bold text-red-600">
                    {{ currentPrice ? (currentPrice * 100).toFixed(0) + '%' : '--' }}
                </span>
                <span class="text-sm text-gray-400">chance</span>
            </div>
        </div>
        
        <!-- Polymarket logo placeholder/branding if needed, skipping for now -->
    </div>

    <!-- Chart -->
    <div class="flex-1 min-h-0 w-full">
       <component
        :is="ApexCharts"
        height="100%"
        width="100%"
        :options="chartOptions"
        :series="series"
      />
    </div>

    <!-- Timeframe controls -->
    <div class="flex justify-start gap-1 mt-4 border-t border-gray-100 pt-4">
        <button 
            v-for="tf in timeframes" 
            :key="tf"
            @click="activeTimeframe = tf"
            class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
            :class="activeTimeframe === tf ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
        >
            {{ tf }}
        </button>
    </div>
  </div>
</template>

<style scoped>
/* Optional specific overrides */
</style>

