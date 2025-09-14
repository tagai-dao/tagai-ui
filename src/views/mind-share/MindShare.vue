<script setup lang="ts">
import {getMindShareList} from "@/apis/api";
import {type Community, ListType} from "@/types";
import {handleErrorTip} from "@/utils/notify";
import {onMounted} from "vue";
import {mockData } from './mock-data'
import {formatAmount, formatPrice} from "@/utils/helper";
import ChartItem from "@/views/mind-share/ChartItem.vue";

interface User {
  date: string
  name: string
  address: string
}

const handleEdit = (index: number, row: User) => {
  console.log(index, row)
}
const handleDelete = (index: number, row: User) => {
  console.log(index, row)
}


async function getNewCommunities() {
  try{
    let res = await getMindShareList() as Array<Community>;
  } catch(e) {
    handleErrorTip(e)
  }
}

onMounted(() => {
  getNewCommunities()
})
</script>

<template>
  <div class="px-3">
    <el-table :data="mockData" style="width: 100%" class="rounded-2xl overflow-hidden no-scroll-bar">
      <el-table-column label="#" type="index" width="40" >
        <template #default="scope">
          <div>{{scope.$index+1}}</div>
        </template>
      </el-table-column>
      <el-table-column label="Name" column-key="name" width="150">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <img class="w-8 h-8" :src="scope.row.image" alt="">
            <div class="flex flex-col">
              <span class="text-h4 font-medium">{{ scope.row.name }}</span>
              <span class="text-sm">{{scope.row.symbol}}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Mindshare" column-key="mindshare" width="100">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">--</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="24h" column-key="mindshare" width="80">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.mindshare.delta24h.toFixed(2)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="7d" column-key="mindshare" width="80">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.mindshare.delta7d.toFixed(2)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Sentiment" column-key="sentiment" width="120">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">--</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="24h" column-key="sentiment" width="100">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.sentiment.delta24h.toFixed(2)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="7d" column-key="sentiment" width="100">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.sentiment.delta7d.toFixed(2)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Price" column-key="marketCap" width="100">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{formatPrice(scope.row.marketCap.price)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Market Cap" column-key="marketCap" width="180">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.marketCap.value.toFixed(4)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="24h" column-key="marketCap" width="100">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <div class="text-sm">{{scope.row.marketCap.delta24h.toFixed(2)}}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Last 7 days" column-key="marketCap" width="180">
        <template #default="scope">
          <div class="flex gap-2 items-center">
            <ChartItem :data-series="scope.row.marketCap.chart" :chart-id="scope.row.name"/>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>

</style>