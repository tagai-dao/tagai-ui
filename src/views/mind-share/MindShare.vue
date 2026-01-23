<script setup lang="ts">
import {getMindShareList} from "@/apis/api";
import {type MindShare, ListType, MindShareType} from "@/types";
import {handleErrorTip} from "@/utils/notify";
import {onMounted, ref, watch } from "vue";
import {getDayNumber} from "@/utils/helper";
import ChartItem from "@/views/mind-share/ChartItem.vue";
import { useRouter } from "vue-router";

const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const router = useRouter()

const props = defineProps<{
  mindShareType: MindShareType
}>()

const emit = defineEmits<{
  'update:mindShareType': [value: MindShareType]
}>()

const mindShareType = ref<MindShareType>(props.mindShareType)

watch(() => props.mindShareType, (val) => {
  mindShareType.value = val
  onRefresh()
})

watch(mindShareType, (val) => {
  emit('update:mindShareType', val)
  onRefresh()
})

const mindShareList = ref<Array<MindShare>>([])

const gotoProfile = (twitterUsername: string) => {
  router.push(`/user/${twitterUsername}`)
}

const onRefresh = async () => {
  try{
    refreshing.value = true
    finished.value = false
    const res  = await getMindShareList(mindShareType.value)
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
        mindShareType.value,
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
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="text-sm text-grey-light-active">{{ $t('mindShare.dataProviderTip') }}</div>
      <!-- PC 端：选择器显示在 Data provided 那一行 -->
      <el-select
        v-model="mindShareType"
        class="hidden web:flex bg-white rounded-full overflow-hidden max-w-[100px] c-select h-10 flex items-center text-h4 text-black"
        popper-class="c-select-popper rounded-xl"
      >
        <el-option :value="MindShareType.Project" :label="$t('mindShare.project')" />
        <el-option :value="MindShareType.User" :label="$t('mindShare.user')" />
      </el-select>
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
          <div class="min-w-[600px] web:min-w-[750px]">
            <div class="flex gap-2 items-center px-3 py-3 border-b-[0.5px] text-h5 sticky top-0 bg-white z-[99]">
              <div class="min-w-[50px] web:min-w-[80px] hidden web:block">#</div>
              <div class="min-w-[150px] max-w-[150px] web:min-w-[150px] web:max-w-full web:flex-1">Name</div>
              <div class="min-w-[100px] max-w-[80px] web:min-w-[120px] web:max-w-[120px]">Mindshare</div>
              <div class="min-w-[100px] max-w-[100px]">24h</div>
              <div class="min-w-[100px] max-w-[100px]">7d</div>
              <div class="min-w-[100px] max-w-[100px]">Last 7 days</div>
            </div>
            <div class="flex gap-2 items-center px-3 py-3 hover:bg-grey-light border-b-[0.5px] cursor-pointer"
                 @click="gotoProfile(item.twitterUsername)"
                 v-for="(item, index) of mindShareList" :key="item.twitterName">
              <div class="min-w-[50px] web:min-w-[80px] text-sm hidden web:block">{{index+1}}</div>
              <div class="min-w-[150px] max-w-[150px] web:min-w-[150px] web:max-w-full web:flex-1 flex gap-2 items-center">
                <div class="w-6 h-6 min-w-6 web:w-8 web:h-8 web:min-w-8 web:min-h-8 bg-grey-light rounded-lg overflow-hidden">
                  <img class="w-6 h-6 web:w-8 web:h-8" :src="item.profile" alt="">
                </div>
                <div class="flex flex-col">
                  <span class="text-sm web:text-h4 font-medium break-words">{{ item.twitterName }}</span>
                  <span class="text-sm break-words">@{{item.twitterUsername}}</span>
                </div>
              </div>
              <div class="min-w-[100px] max-w-[80px] web:min-w-[120px] web:max-w-[120px] flex gap-2 items-center">
                <div class="text-sm">{{(item.mindSharePercent * 100).toFixed(2) }}%</div>
              </div>
              <div class="min-w-[100px] max-w-[100px]">
                <div v-if="item.delta24h>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta24h?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
              <div class="min-w-[100px] max-w-[100px]">
                <div v-if="item.delta7d>=0" class="flex gap-2 items-center">
                  <i-ep-caret-top color="#34C759"></i-ep-caret-top>
                  <div class="text-sm text-green-34">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
                <div v-else class="flex gap-2 items-center">
                  <i-ep-caret-bottom color="#E6374D"></i-ep-caret-bottom>
                  <div class="text-sm text-red-e6">{{item.delta7d?.toFixed(2)||0.0}}%</div>
                </div>
              </div>
              <div class="min-w-[100px] max-w-[100px]">
                <div class="flex justify-start items-center w-full h-[50px] z-0">
                  <ChartItem :data-series="item.chart ?? []"
                             :mind-share="item"
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
:deep(.c-select .el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent;
  padding: 0 12px;
}
:deep(.c-select .el-input__inner) {
  font-weight: 600;
  color: #000000 !important;
  text-align: right;
  -webkit-text-fill-color: #000000;
}
:deep(.c-select .el-select__caret) {
    color: #000;
}
</style>
