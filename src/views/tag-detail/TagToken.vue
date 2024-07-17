<script setup lang="ts">
import {ref} from "vue";

const chartOptions = ref({
  chart: {
    height: 200,
    type: 'line',
    toolbar: {
      show: false
    },
  },
  stroke: {
    width: 5,
    curve: 'smooth'
  },
  xaxis: {
    type: 'datetime',
    categories: ['1/11/2000', '2/11/2000', '3/11/2000', '4/11/2000', '5/11/2000', '6/11/2000', '7/11/2000', '8/11/2000', '9/11/2000', '10/11/2000', '11/11/2000', '12/11/2000', '1/11/2001', '2/11/2001', '3/11/2001','4/11/2001' ,'5/11/2001' ,'6/11/2001'],
    tickAmount: 10,
    labels: {
      show: false
    }
  },
  yaxis: {
    labels: {
      show: false
    }
  },
  title: {
    show: false
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      type: 'horizontal',
      opacityFrom: 1,
      opacityTo: 1,
      stops: [0, 50, 100],
      colorStops: [
        [
          { offset: 0, color: '#FF8F40', opacity: 1},
          { offset: 35, color: '#F963B5', opacity: 1},
          { offset: 65, color: '#4040F7', opacity: 1}
        ]
      ]
    },
  }
})
const series = ref([{
  name: 'Price',
  data: [4, 3, 10, 9, 29, 19, 22, 9, 12, 7, 19, 5, 13, 9, 17, 2, 7, 5]
}])

const chartTabs = ['12H', '24H', '1W', '1Y', 'All']
const activeTab = ref('12H')

const progressData = ref([
  {amount: 20, stopHeight: 20, background: '#FA8383'},
  {amount: 20, stopHeight: 40, background: '#FACA83'},
  {amount: 20, stopHeight: 60, background: '#B0FA83'},
  {amount: 20, stopHeight: 80, background: '#83DDFA'},
  {amount: 20, stopHeight: 100, background: '#9B83FA'},
])
</script>

<template>
  <div class="">
    <div class="bg-white p-3 rounded-2xl">
      <div class="flex justify-between items-center">
        <div class="flex items-end gap-1">
          <span class="text-lg font-bold leading-5">LATC</span>
          <span class="text-xs text-grey-6f leading-4">Chart</span>
        </div>
        <div class="text-red-ff text-base">0.2886 $</div>
      </div>
      <apexchart type="line" height="200" ref="chart"
                 :options="chartOptions"
                 :series="series"></apexchart>
      <div class="bg-grey-e7 h-14 rounded-full p-1 flex items-center">
        <button v-for="tab of chartTabs" :key="tab"
                class="h-full flex-1 rounded-full text-h5"
                :class="activeTab===tab?'bg-white shadow-tab':'text-grey-6f'">{{tab}}</button>
      </div>
    </div>
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">Token info</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Price</span>
        <span class="text-h5 text-black-19">$0.0038</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">bonding curve sell</span>
        <span class="text-h5 text-black-19">16.76M</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Supply</span>
        <span class="text-h5 text-black-19">15,280,000,000</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Dex Liquidity</span>
        <span class="text-h5 text-black-19">3.87M</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Cap</span>
        <span class="text-h5 text-black-19">$231,233</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Tweet Pool</span>
        <span class="text-h5 text-black-19">2.1M</span>
      </div>
    </div>
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">Tweet Pool</div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Content and Interaction</span>
        <span class="text-h5 text-black-19">60%(0.236M)</span>
      </div>
      <div class="flex justify-between items-center h-6">
        <span class="text-h4 text-grey-93">Space</span>
        <span class="text-h5 text-black-19">40%(0.084M)</span>
      </div>
      <div class="my-1">
        <div class="text-h4 text-grey-93 mb-1">Social Distribution Strategy</div>
        <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden">
          <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                      placement="top-start">
            <template #content>
              <span class="text-xs">{{data.amount}}</span>
            </template>
            <div class="h-full"
                 :style="{ flex: 1,  background: data.background}" >
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Unclaimed Reward:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="123"
                 type="text" id="reward">
          <span class="text-h3">$ LATC</span>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label for="reward" class="text-h4 text-grey-93">Pool Contract:</label>
        <div class="border-[1px] border-grey-c9 rounded-xl h-11 flex items-center gap-2 px-5">
          <input class="flex-1 text-h3" :value="'0x3475...3880'" disabled type="text" id="reward">
        </div>
      </div>
    </div>
    <div class="bg-white py-5 px-4 rounded-2xl mt-2 flex flex-col gap-1">
      <div class="text-h2 mb-2">Token List</div>
      <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
           v-for="i of 4" :key="i">
        <el-tooltip placement="top">
          <template #content>
            <div class="flex gap-1">
              用户信息
            </div>
          </template>
          <div class="col-span-3 truncate flex items-center gap-1">
            <span class="min-w-4">{{i+1}}</span>
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <span class="">0x ……F263</span>
            <span class="text-xs bg-purple-c1 text-blue-active px-1.5 rounded-full">deployer</span>
          </div>
        </el-tooltip>
        <span class="col-span-2 text-right">680M / 6.11%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
