<script setup lang="ts">
import {getMindShareList} from "@/apis/api";
import {type MindShare, ListType, MindShareType} from "@/types";
import {handleErrorTip} from "@/utils/notify";
import {onMounted, ref, watch } from "vue";
import {getDayNumber} from "@/utils/helper";
import ChartItem from "@/views/mind-share/ChartItem.vue";

const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);

const props = defineProps<{
  mindShareType: MindShareType
}>()

watch(() => props.mindShareType, (val) => {
  onRefresh()
})

const mindShareList = ref<Array<MindShare>>([])

const onRefresh = async () => {
  try{
    refreshing.value = true
    finished.value = false
    const res  = await getMindShareList(props.mindShareType)
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
    if (mindShareList.value && mindShareList.value.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

const onLoad = async () => {
  try{
    if (refreshing.value || finished.value || mindShareList.value.length===0) return
    loading.value = true
    const list: any = await getMindShareList(
        props.mindShareType,
        Math.floor((mindShareList.value.length - 1) / 30) + 1
    )
    const dayNumber = getDayNumber()
    list.forEach((ms: MindShare) => {
      let chart = ms.percents.map((percent, index) => {
        return {
          date: new Date((dayNumber + index) * 86400000),
          value: percent
        }
      })
      ms.chart = chart;
    })
    mindShareList.value = mindShareList.value.concat(list)
    if (list && list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  onRefresh()
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col px-3">
    <div class="mb-3 flex items-center gap-2">
      <div class="text-sm text-grey-light-active">{{ $t('mindShare.dataProviderTip') }}</div>
    </div>
    <div class="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl">
      <van-pull-refresh class="flex-1 overflow-auto no-scroll-bar"
                        v-model="refreshing"
                        @refresh="onRefresh"
                        :loading-text="$t('loading')"
                        :lpulling-text="$t('pullToRefreshData')"
                        :loosing-text="$t('releaseToRefresh')">
        <van-list
            :loading="loading"
            :finished="finished"
            :immediate-check="false"
            :finished-text="$t('noMore')"
            :offset="50"
            @load="onLoad">
          <div class="min-w-[500px] web:min-w-[700px]">
            <div class="flex gap-2 items-center px-3 py-3 border-b-[0.5px] text-h5 sticky top-0 bg-white z-[99]">
              <div class="min-w-[50px] hidden web:block">#</div>
              <div class="min-w-[150px] flex-1">Name</div>
              <div class="min-w-[100px]">Mindshare</div>
              <div class="min-w-[100px]">24h</div>
              <div class="min-w-[100px]">7d</div>
              <div class="min-w-[100px]">Last 7 days</div>
            </div>
            <div class="flex gap-2 items-center px-3 py-3 hover:bg-grey-light border-b-[0.5px]"
                 v-for="(item, index) of mindShareList" :key="item.twitterName">
              <div class="min-w-[50px] text-sm hidden web:block">{{index+1}}</div>
              <div class="min-w-[150px] flex-1 flex gap-2 items-center">
                <div class="w-6 h-6 min-w-6 web:w-8 web:h-8 web:min-w-8 web:min-h-8 bg-grey-light rounded-lg overflow-hidden">
                  <img class="w-6 h-6 web:w-8 web:h-8" :src="item.profile" alt="">
                </div>
                <div class="flex flex-col">
                  <span class="text-sm web:text-h4 font-medium break-words">{{ item.twitterName }}</span>
                  <span class="text-sm break-words">@{{item.twitterUsername}}</span>
                </div>
              </div>
              <div class="min-w-[100px] flex gap-2 items-center">
                <div class="text-sm">{{(item.mindSharePercent * 100).toFixed(2) }}%</div>
              </div>
              <div class="min-w-[100px]">
                <div v-if="item.delta24h>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
              <div class="min-w-[100px]">
                <div v-if="item.delta7d>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
              <div class="min-w-[100px]">
                <div class="flex justify-start items-center w-full h-[50px] z-0">
                  <ChartItem :data-series="item.chart ?? []"
                             :mind-share-percent="item.mindSharePercent"
                             :chart-id="item.twitterId"/>
                </div>
              </div>
            </div>
          </div>

        </van-list>
      </van-pull-refresh>
    </div>
  </div>
</template>

<style scoped>

</style>
