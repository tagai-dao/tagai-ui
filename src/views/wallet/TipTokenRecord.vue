<script setup lang="ts">

import { formatAddress, formatAmount, formatPastTime } from "@/utils/helper";
import { ref } from "vue";
import BackHeader from "@/layout/BackHeader.vue";
import { getTipRecord } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useSocialAccountModalStore } from "@/stores/wallet";
import { type TwitterTipRecord, TwitterTipStatus, TwitterTipClaimStatus, TwitterTipErrorType } from "@/types";

const accStore = useAccountStore()
const socialAccountModalStore = useSocialAccountModalStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)

const gotoTweet = (tweet?: any) => {
  window.open(`https://twitter.com/${tweet.twitterUsername}/status/${tweet.tweetId}`)
}

const onLoad = async () => {

}

const onRefresh = async () => {
  try {
    if (refreshing.value) return
    refreshing.value = true
    const res = await getTipRecord(accStore.getAccountInfo.twitterId)
    socialAccountModalStore.tipTokenRecords = res as TwitterTipRecord[]
  } catch (error) {
    handleErrorTip(error)
  } finally {
    refreshing.value = false
  }
}

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">{{$t('profileView.tipRecord')}}</div>
      </template>
    </BackHeader>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list class="px-3"
                :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :offset="50"
                @load="onLoad">
        <div class="flex items-center gap-3 text-h4 bg-white p-3 rounded-xl mb-2">
          <img class="w-10 h-10 min-w-10 transform rotate-180" src="~@/assets/icons/icon-tips-send.svg" alt="">
          <div class="flex-1 flex justify-between flex-col gap-1 web:flex-row web:items-stretch">
            <div class="flex-1 truncate flex items-center gap-1 cursor-pointer">
              <img class="w-5 h-5 min-w-5" src="~@/assets/icons/icon-default-avatar.svg" alt="">
              <span class="truncate text-lg">username tiped $TTAI to you</span>
            </div>
            <div class="flex items-center">
              <div class="text-h3 text-green-34">+10000 $TTAI</div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-h4 bg-white p-3 rounded-xl mb-2">
          <img class="w-10 h-10 min-w-10 transform rotate-180" src="~@/assets/icons/icon-tips-received.svg" alt="">
          <div class="flex-1 flex flex-col gap-1">
            <div class="flex justify-between flex-col gap-1 web:flex-row web:items-stretch">
              <div class="flex flex-col gap-1">
                <div class="truncate flex items-center gap-1 cursor-pointer">
                  <div class="flex items-center">
                    <img class="w-5 h-5 min-w-5" src="~@/assets/icons/icon-default-avatar.svg" alt="">
                    <img class="w-5 h-5 min-w-5 -ml-[6px] z-9" src="~@/assets/icons/icon-default-coin.svg" alt="">
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="truncate text-lg">tiped $TTAI to @username</span>
                    <span class="mx-4px"> · </span>
                    <button @click="gotoTweet">
                      <img class="w-4 h-4" src="~@/assets/icons/icon-link-x.svg" alt="">
                    </button>
                    <button @click="gotoTweet">
                      <img class="w-4 h-4" src="~@/assets/icons/icon-link-official.svg" alt="">
                    </button>
                  </div>
                </div>
                <div class="h-7 hidden web:flex items-center">
                  <div class="text-red-normal opacity-80 text-sm">Fail: exceed</div>
                </div>
              </div>
              <div class="flex justify-between items-center web:flex-col web:items-end">
                <div class="text-h3 text-red-normal leading-6">-10000 $TTAI</div>
                <button class="bg-orange-normal text-white h-7 rounded-full px-4">{{$t('claim')}}</button>
              </div>
              <div class="web:hidden">
                <div class="text-red-normal opacity-80 text-sm">Fail: exceed</div>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
