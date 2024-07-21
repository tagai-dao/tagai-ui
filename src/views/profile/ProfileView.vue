<script setup lang="ts">
import {ref} from "vue";
import TabHoldCoin from "@/views/profile/TabHoldCoin.vue";
import TabPost from "@/views/profile/TabPost.vue";
import TabCreateCoin from "@/views/profile/TabCreateCoin.vue";
import { useAccountStore } from "@/stores/web3";
import { useAccount } from "@/composables/useAccount";
import { MAX_OP, MAX_VP } from "@/config";

const accStore = useAccountStore()
const tabOptions = ['holdCoin', 'post', 'createCoin']
const activeTab = ref('createCoin')
const { profile, replaceEmptyProfile, gotoTwitter, vp, op } = useAccount();
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
                <div class="text-grey-normal py-1">{{ $t('curaiton.opDesc') }}</div>
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
                <div class="text-grey-normal py-1">{{  $t('curation.vpDesc')  }}</div>
              </template>
            </el-tooltip>
          </div>
        </div>
      </div>
      <div class="pl-14 flex items-center gap-4 mt-2">
        <span>{{ accStore.getAccountInfo.followings }} {{ $t('profileView.followings') }}</span>
        <span>{{ accStore.getAccountInfo.followers }} {{ $t('profileView.followers') }}</span>
      </div>
    </div>
    <div class="flex justify-between gap-2 px-3 bg-white rounded-xl py-3">
      <button v-for="tab of tabOptions" :key="tab"
              class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab===activeTab?'text-gradient bg-gradient-primary':'text-grey-normal'"
              @click="activeTab=tab">{{$t('profileView.'+tab)}}</button>
    </div>
    <div class="flex-1 overflow-auto " id="profile-tab-scroller">
      <!-- <TabHoldCoin v-if="activeTab==='holdCoin'"/>
      <TabPost v-if="activeTab==='post'"/>
      <TabCreateCoin v-if="activeTab==='createCoin'"/> -->
    </div>
  </div>
</template>

<style scoped>

</style>
