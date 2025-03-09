<script setup lang="ts">
import {onMounted, ref} from "vue";
import TabBlink from "@/views/profile/TabBlink.vue";
import TabPost from "@/views/profile/TabPost.vue";
import TabCreateCoin from "@/views/profile/TabCreateCoin.vue";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";
import { getIpshareInfo } from '@/apis/api'
import { useInterval } from "@/composables/useTools";
import FarcasterBtn from "@/components/login/FarcasterBtn.vue";
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";

const accStore = useAccountStore()
const tabOptions = ['post', 'createCoin']
const activeTab = ref('post')
const { profile, replaceEmptyProfile, gotoTwitter, vp, op, logout, updateBalance } = useAccount();
const { setInter } = useInterval()

const profileTableData = ref([
  { action: 'Curation', vp: 'Selected vp', op: 'Selected vp'},
  { action: 'Tweet', vp: '0', op: '200'},
  { action: 'Quote', vp: '0', op: '200'},
  { action: 'Reply', vp: '0', op: '50'},
  { action: 'Retweet', vp: '0', op: '5'},
  { action: 'Like', vp: '0', op: '3'},
])

async function updateIPShare() {
  const acc = useAccountStore().getAccountInfo;

  try {
    if (acc.ethAddr) {
      updateBalance();
      const ipshare: any = await getIpshareInfo(acc.ethAddr);
      useAccountStore().ipshare = ipshare;
    }
  } catch (error) {

  }
}

onMounted(() => {
  updateIPShare()
  setInter(updateIPShare, 100000)
})

</script>

<template>
  <div class="h-full overflow-hidden py-2 flex flex-col gap-3">
    <div class="bg-white py-3 px-3 rounded-2xl mx-3">
      <div class="flex gap-2 items-center">
        <img class="w-10 h-10 min-w-10 rounded-full cursor-pointer bg-color2A"
             :src="profile" @error="replaceEmptyProfile" alt="">
        <div class="h-full flex-1">
          <div class="text-h3">{{ accStore.getAccountInfo.twitterName }}</div>
          <div class="flex items-center gap-1 leading-5">
            <span class="text-grey-8d">@{{ accStore.getAccountInfo.twitterUsername }}</span>
            <span class="mx-4px"> · </span>
            <button @click="gotoTwitter" >
              <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-[65px] flex flex-col items-center gap-1">
            <div class="w-full flex justify-between text-sm px-1 text-grey-normal">
              <span>{{ (op * 100 / MAX_OP).toFixed(2) }}%</span>
              <span>OP</span>
            </div>
            <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
              <el-progress :percentage="op * 100 / MAX_OP" :stroke-width="6" :show-text="false"
                           class="c-gradient-progress c-gradient-progress-green w-full"/>
              <template #content>
                <div class="max-w-[400px] py-4">
                  <div class="text-grey-normal py-1">{{ $t('curation.opDesc') }}</div>
                  <el-table :data="profileTableData" border style="width: 100%">
                    <el-table-column prop="action" label="Action"/>
                    <el-table-column prop="vp" label="VP" width="120" />
                    <el-table-column prop="op" label="OP" width="120" />
                  </el-table>
                </div>
              </template>
            </el-tooltip>
          </div>
          <div class="w-[65px] flex flex-col items-center gap-1">
            <div class="w-full flex justify-between text-sm px-1 text-grey-normal">
              <span>{{ (vp * 100 / MAX_VP).toFixed(2) }}%</span>
              <span>VP</span>
            </div>
            <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
              <el-progress :percentage="vp * 100 / MAX_VP" :stroke-width="6" :show-text="false"
                           class="c-gradient-progress c-gradient-progress-orange w-full"/>
              <template #content>
                <div class="max-w-[400px]">
                  <div class="text-grey-normal py-1">{{  $t('curation.vpDesc')  }}</div>
                </div>
              </template>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="pl-14 flex justify-between items-center gap-3a mt-2">
        <div class="flex-1 flex items-center flex-wrap gap-4">
          <span>{{ accStore.getAccountInfo.followings }} {{ $t('profileView.followings') }}</span>
          <span>{{ accStore.getAccountInfo.followers }} {{ $t('profileView.followers') }}</span>
        </div>
        <button @click="logout();$router.replace('/')">
          <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-logout.svg" alt="">
        </button>
      </div>
      <div v-if="accStore.getAccountInfo.farcasterName && accStore.getAccountInfo.isAuthFarcaster" class="pl-14 flex justify-start items-center gap-3a mt-2">
        <img class="w-4 h-4" src="~@/assets/icons/icon-farcaster.svg" alt="">
        <div class="ml-2 text-sm">
          {{ accStore.getAccountInfo.farcasterName }}
        </div>
      </div>
      <!-- <div v-else class="flex pl-14 justify-start items-center gap-3a mt-2 ">
        <button @click="useModalStore().setModalVisible(true, GlobalModalType.Register)" class="bg-gradient-primary flex items-center px-2 py-1 rounded-full">
          <img class="w-4 h-4 mr-2" src="~@/assets/icons/icon-farcaster.svg" alt="">
          <span class="text-white text-sm">
            {{$t('profileView.bindFacaster')}}
          </span>
        </button>
      </div> -->
    </div>
    <div class="flex justify-between gap-2 bg-white rounded-xl py-3 mx-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <!-- <TabHoldCoin v-if="activeTab==='holdCoin'"/> -->
      <TabPost v-if="activeTab==='post'"/>
      <TabBlink v-if="activeTab==='blink'"/>
      <TabCreateCoin v-if="activeTab==='createCoin'"/>
    </div>
  </div>
</template>

<style scoped>

</style>
