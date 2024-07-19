<script setup lang="ts">
import {onMounted, ref, unref} from "vue";
import MsgItem from "@/components/common/MsgItem.vue";
import {useModalStore} from "@/stores/common";
import { useCommunityStore } from "@/stores/community";
import {GlobalModalType, type Community} from "@/types";
import TagGroup from "@/views/tag-detail/TagGroup.vue";
import TagContent from "@/views/tag-detail/TagContent.vue";
import TagCredit from "@/views/tag-detail/TagCredit.vue";
import TagToken from "@/views/tag-detail/TagToken.vue";
import {useRoute, useRouter} from "vue-router";
import { getCommunityDetail } from "@/apis/api";
import { getTokenInfo } from '@/utils/pump'
import { useInterval } from "@/composables/useTools";

const tabOptions = [
  {label: 'Group', key: 'group'},
  {label: 'Content', key: 'content'},
  {label: 'Credit', key: 'credit'},
  {label: 'Token', key: 'token'},
]
const activeTab = ref('group')
const modalStore = useModalStore()
const comStore = useCommunityStore()
const tweetTypeRef = ref()
const route = useRoute()
const router = useRouter()
const tokenInfo = ref()
const { setInter } = useInterval()

const onTweetType = (type: GlobalModalType) => {
  tweetTypeRef.value.hide()
  modalStore.setModalVisible(true, type)
}

const progressData = ref([
  {trackWidth: 10, value: 0, background: '#FF3D54', desc: 'Social Distributed'},
  {trackWidth: 70, value: 0, background: '#FE913F', desc: 'Bongding Curve'},
  {trackWidth: 20, value: 0, background: '#FFCC00', desc: 'Listed'}
])

async function updateProgress() {
  getTokenInfo(comStore.currentSelectedCommunity!.token).then((ti: any) => {
    if (!ti) return;
    tokenInfo.value = ti
    progressData.value = [
      {...progressData.value[0], value: (ti.totalClaimedSocialRewards.toString() / 1e18 / 10000)},
      {...progressData.value[1], value: (ti.bondingCurveSupply.toString() / 1e18 / 70000)},
      {...progressData.value[2], value: 100, desc: ti.listed ? 'Listed' : 'Pending List'}
    ]
  }).catch(e => {
    console.error(2, e)
  })
}

onMounted(async () => {
  if (!comStore.currentSelectedCommunity?.tick){
    const tick = route.params.id;
    if (typeof(tick) !== 'string') {
      router.replace('/')
      return;
    }
    comStore.currentSelectedCommunity = await getCommunityDetail(tick) as any
  }
  setInter(updateProgress, 3000);

})
</script>

<template>
  <div class="h-full overflow-auto py-2 flex flex-col gap-3 px-3 relative">
    <div class="bg-white rounded-2xl py-5 px-3.5 flex gap-3">
      <div class="w-20 h-20 rounded-2xl bg-grey-normal-active shadow-tag-logo flex items-center justify-center">
        <img class="w-15" :src="comStore.currentSelectedCommunity?.logo" alt="">
      </div>
      <div class="flex-1 py-1">
        <div class="flex gap-4 items-center">
          <span class="text-black text-h2">{{ comStore.currentSelectedCommunity?.tick }}</span>
          <!-- <img class="w-4 h-4" src="../../assets/icons/icon-circle-x.svg" alt="">
          <div class="w-4 h-4 min-w-4 min-h-4 bg-purple-c1 rounded-full"></div> -->
        </div>
        <div class="whitespace-pre-line text-h5 mt-1">
          {{ comStore.currentSelectedCommunity?.description }}
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl py-5 px-3.5 flex flex-col gap-3">
      <div class="text-base font-medium flex items-center gap-1">
        <span>Bonding curve progress：{{ progressData[1].value.toFixed(2) }}%</span>
        <el-popover popper-class="c-popper">
          <template #reference>
            <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
          </template>
          <template #default>
            <div class="bg-white rounded-xl p-2 shadow-popper-tip">
              {{ $t('community.distributionTip') }}
            </div>
          </template>
        </el-popover>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative flex justify-between items-center rounded-full h-3 overflow-hidden w-full
                    bg-white gap-[2px]">
          <el-tooltip v-for="(data, index) of (progressData ? progressData : [])" :key="index"
                      placement="top-start">
            <template #content>
              <div class="flex gap-1">
                <span class="text-sm">{{data.desc}}</span>
                <span class="font-semibold text-base">{{data.value.toFixed(2)}}%</span>
              </div>
            </template>
            <div class="w-full h-full bg-grey-light" :style="{width:`${data.trackWidth}%`}">
              <div class="h-full"
                   :style="{background: data.background, width:`${data.value.toFixed(2)}%`}" >
              </div>
            </div>
          </el-tooltip>
        </div>
        <el-popover popper-class="c-popper" placement="bottom-end" width="200" ref="tweetTypeRef" trigger="click">
          <template #reference>
            <button class="bg-black px-3 h-8 text-white text-sm rounded-full whitespace-nowrap">
              Build & Earn
            </button>
          </template>
          <template #default>
            <div class="bg-black rounded-2xl px-3 py-4 w-[200px] shadow-popper-tip text-white text-lg flex flex-col gap-2 items-start">
              <button @click="onTweetType(GlobalModalType.CreateTweet)"
                      class="whitespace-nowrap">Tweet on-chain</button>
              <button @click="onTweetType(GlobalModalType.CreateTweetSpace)"
                      class="whitespace-nowrap">Tweet an onchain Space</button>
            </div>
          </template>
        </el-popover>
      </div>
      <div class="flex justify-center text-white">
        <button class="w-1/2 bg-gradient-primary text-h5 rounded-full h-11"
                @click="$router.push(`/buy-sell/${$route.params?.id??''}`)">Trade</button>
      </div>
    </div>
    <div class="flex justify-between gap-2">
      <button v-for="tab of tabOptions" :key="tab.key"
              class="px-3 rounded-full h-6 text-h3"
              :class="tab.key===activeTab?'bg-grey-normal text-white':'text-grey-3f'"
              @click="activeTab=tab.key">{{tab.label}}</button>
    </div>
    <TagGroup v-if="activeTab==='group'" class="flex-1 overflow-hidden"/>
    <TagContent v-if="activeTab==='content'"/>
    <TagCredit v-if="activeTab==='credit'"/>
    <TagToken v-if="activeTab==='token'"/>
  </div>
</template>

<style scoped>

</style>
