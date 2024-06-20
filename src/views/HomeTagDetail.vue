<script setup lang="ts">
import {ref, unref} from "vue";
import MsgItem from "@/components/common/MsgItem.vue";
import {useModalStore} from "@/stores/common";
import {GlobalModalType} from "@/types";

const tabOptions = ['group', 'content', 'credit', 'token']
const activeTab = ref('group')
const modalStore = useModalStore()
const tweetTypeRef = ref()

const onTweetType = (type: GlobalModalType) => {
  tweetTypeRef.value.hide()
  modalStore.setModalVisible(true, type)
}
</script>

<template>
  <div class="h-full overflow-auto py-2 flex flex-col gap-3 px-3">
    <div class="bg-white rounded-2xl py-5 px-3.5 flex gap-3">
      <div class="w-20 h-20 rounded-2xl bg-black-21 shadow-tag-logo flex items-center justify-center">
        <img class="w-15" src="~@/assets/logo-v.svg" alt="">
      </div>
      <div class="flex-1 py-1">
        <div class="flex gap-4 items-center">
          <span class="text-black text-xl font-bold leading-6">LATC</span>
          <img class="w-4 h-4" src="~@/assets/icons/icon-circle-x.svg" alt="">
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
            <img class="w-4" src="~@/assets/icons/icon-warning-gray.svg" alt="">
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
    <div class="bg-white rounded-2xl p-4 flex justify-between gap-2">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-8 text-base font-medium"
              :class="tab===activeTab?'bg-black text-white':'text-black-3f'"
              @click="activeTab=tab">{{tab}}</button>
    </div>
    <div v-if="activeTab==='group'" class="flex-1 overflow-hidden bg-white rounded-2xl flex flex-col p-4">
      <div class="flex-1 overflow-auto no-scroll-bar flex flex-col gap-3">
        <MsgItem :msg-data="{content: 'test1', sendUserName: 'AAA', sendTime: new Date().getTime(), profileImg: ''}"/>
        <MsgItem :msg-data="{content: 'test2', sendUserName: 'AAA', sendTime: new Date().getTime(), profileImg: ''}"/>
        <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
        <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
        <MsgItem :msg-data="{content: 'test3', sendUserName: 'user', sendTime: new Date().getTime(), profileImg: ''}"/>
      </div>
      <div class="h-10 px-4 rounded-full bg-gradient-primary w-full flex items-center gap-2 mt-2">
        <div class="flex">
          <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
            <img src="" alt="">
          </div>
          <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-20 -ml-2">
            <img src="" alt="">
          </div>
          <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 z-10 -ml-2">
            <img src="" alt="">
          </div>
        </div>
        <div class="text-white font-400 flex-1 truncate flex gap-2">
          <span class="font-bold">+220</span>
          <span class="truncate">Mint or buy to join the group</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
