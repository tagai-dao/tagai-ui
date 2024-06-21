<script setup lang="ts">
import {ref, unref} from "vue";
import MsgItem from "@/components/common/MsgItem.vue";
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";
import TagGroup from "@/views/tag-detail/TagGroup.vue";
import TagContent from "@/views/tag-detail/TagContent.vue";

const tabOptions = [
  {label: 'Group', key: 'group'},
  {label: 'Content', key: 'content'},
  {label: 'Credit', key: 'credit'},
  {label: 'Token', key: 'token'},
]
const activeTab = ref('content')
const modalStore = useModalStore()
const tweetTypeRef = ref()

const onTweetType = (type: GlobalModalType) => {
  tweetTypeRef.value.hide()
  modalStore.setModalVisible(true, type)
}
</script>

<template>
  <div class="h-full overflow-auto py-2 flex flex-col gap-3 px-3 relative">
    <div class="bg-white rounded-2xl py-5 px-3.5 flex gap-3">
      <div class="w-20 h-20 rounded-2xl bg-black-21 shadow-tag-logo flex items-center justify-center">
        <img class="w-15" src="../../assets/logo-v.svg" alt="">
      </div>
      <div class="flex-1 py-1">
        <div class="flex gap-4 items-center">
          <span class="text-black text-xl font-bold leading-6">LATC</span>
          <img class="w-4 h-4" src="../../assets/icons/icon-circle-x.svg" alt="">
          <div class="w-4 h-4 min-w-4 min-h-4 bg-purple-a4 rounded-full"></div>
        </div>
        <div class="whitespace-pre-line font-normal text-black leading-5 mt-1">
          Look at the crowd <br>
          Biden stands no chance
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl py-5 px-3.5 flex flex-col gap-3">
      <div class="text-base font-medium flex items-center gap-1">
        <span>Bonding curve progress：65%</span>
        <el-popover popper-class="c-popper">
          <template #reference>
            <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
          </template>
          <template #default>
            <div class="bg-white rounded-xl p-2 shadow-popper-tip">tips</div>
          </template>
        </el-popover>
      </div>
      <div class="flex items-center gap-3">
        <el-progress :percentage="65" :stroke-width="8" :show-text="false"
                     class="c-gradient-progress c-gradient-progress-purple w-full"/>
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
      <div class="flex gap-6 text-white">
        <button class="flex-1 bg-gradient-primary rounded-full h-11">Buy</button>
        <button class="flex-1 bg-black rounded-full h-11">Sell</button>
      </div>
    </div>
    <div class="bg-white rounded-2xl p-4 flex justify-between gap-2 sticky -top-2 z-50">
      <button v-for="tab of tabOptions" :key="tab.key"
              class="px-3 rounded-full h-8 text-base font-medium"
              :class="tab.key===activeTab?'bg-black text-white':'text-black-3f'"
              @click="activeTab=tab.key">{{tab.label}}</button>
    </div>
    <TagGroup v-if="activeTab==='group'" class="flex-1 overflow-hidden"/>
    <TagContent v-if="activeTab==='content'"/>
  </div>
</template>

<style scoped>

</style>
