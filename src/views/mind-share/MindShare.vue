<script setup lang="ts">
import {getMindShareList} from "@/apis/api";
import {type MindShare, ListType} from "@/types";
import {handleErrorTip} from "@/utils/notify";
import { onMounted, ref, watch } from "vue";
import {mockData } from './mock-data'
import {formatAmount, formatPrice, getDayNumber} from "@/utils/helper";
import ChartItem from "@/views/mind-share/ChartItem.vue";
import MetaMaskSDK from "@metamask/sdk";

const test = {"value": 8.607069969177246,
    "delta": -0.7096586227416992,
    "delta24h": -0.7096586227416992,
    "delta7d": -0.7977447509765625,
    "delta30d": -0.46353721618652344,
    "delta90d": -3.070357322692871,
    "chart": [
      {
        "date": "2025-09-01T16:29:55.841Z",
        "value": 11.928284
      },
      {
        "date": "2025-09-02T16:29:55.841Z",
        "value": 10.697126
      },
      {
        "date": "2025-09-03T16:29:55.841Z",
        "value": 11.279785
      }]
  }

const listType = ref('project')
const mindShareList = ref<Array<MindShare>>([])

async function getNewCommunities() {
  try{
    let res = await getMindShareList(listType.value==='project'?1:0)
      console.log(53, res)
    mindShareList.value = res as Array<MindShare>;
    const dayNumber = getDayNumber()
    mindShareList.value.forEach(ms => {
      let chart = ms.percents.map((percent, index) => {
        return {
          date: new Date((dayNumber + index) * 86400000),
          value: percent
        }
      })
      ms.chart = chart;
    })
    console.log(54, mindShareList.value)
  } catch(e) {
    handleErrorTip(e)
  }
}
watch(listType, (val) => {
  getNewCommunities()
})
onMounted(() => {
  getNewCommunities()
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col px-3">
    <div class="mb-3 flex items-center gap-2">
      <el-select
          v-model="listType"
          class="bg-white rounded-full overflow-hidden max-w-[120px] c-select h-8 flex items-center text-h3 text-black"
          popper-class="c-select-popper rounded-xl">
        <el-option value="project" :label="$t('mindShare.project')" />
        <el-option value="user" :label="$t('mindShare.user')" />
      </el-select>
      <div class="text-sm text-grey-light-active">{{ $t('mindShare.dataProviderTip') }}</div>
    </div>
    <div class="flex-1 overflow-auto no-scroll-bar">
      <el-table :data="mindShareList" style="width: 100%"
                class="rounded-2xl overflow-hidden no-scroll-bar px-3 h-full">
        <el-table-column label="#" type="index" width="50" text-center>
          <template #default="scope">
            <div>{{scope.$index+1}}</div>
          </template>
        </el-table-column>
        <el-table-column label="Name" column-key="name" min-width="160">
          <template #default="scope">
            <div class="flex gap-2 items-center">
              <div class="w-8 h-8 min-w-8 min-h-8 bg-grey-light rounded-lg overflow-hidden">
                <img class="w-8 h-8 " :src="scope.row.profile" alt="">
              </div>
              <div class="flex flex-col">
                <span class="text-h4 font-medium whitespace-nowrap">{{ scope.row.twitterName }}</span>
                <span class="text-sm whitespace-nowrap">@{{scope.row.twitterUsername}}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="AI Score" column-key="reputation" width="150">
          <template #default="scope">
            <div class="flex gap-2 items-center">
              <div class="text-sm">{{ (scope.row.twitterReputation).toFixed(2) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Mindshare" column-key="mindshare" width="150">
          <template #default="scope">
            <div class="flex gap-2 items-center">
              <div class="text-sm">{{ (scope.row.mindSharePercent * 100).toFixed(2) }}%</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="24h" column-key="mindshare" width="120">
          <template #default="scope">
            <div v-if="scope.row.delta24h>=0" class="flex gap-2 items-center">
              <i-ep-caret-top color="#34C759"></i-ep-caret-top>
              <div class="text-sm text-green-34">{{scope.row.delta24h?.toFixed(2)||0.0}}%</div>
            </div>
            <div v-else class="flex gap-2 items-center">
              <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
              <div class="text-sm text-red-e6">{{scope.row.delta24h?.toFixed(2)||0.0}}%</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="7d" column-key="mindshare" width="120">
          <template #default="scope">
            <div v-if="scope.row.delta7d>=0" class="flex gap-2 items-center">
              <i-ep-caret-top color="#34C759"></i-ep-caret-top>
              <div class="text-sm text-green-34">{{scope.row.delta7d?.toFixed(2)||0.0}}%</div>
            </div>
            <div v-else class="flex gap-2 items-center">
              <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
              <div class="text-sm text-red-e6">{{scope.row.delta7d?.toFixed(2)||0.0}}%</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Last 7 days" column-key="marketCap" width="180">
          <template #default="scope">
            <div class="flex justify-start items-center w-full h-[50px] ">
              <ChartItem :data-series="scope.row.chart ?? test.chart"
                         :chart-id="scope.row.twitterId"/>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>

</style>
