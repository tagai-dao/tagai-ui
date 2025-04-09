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
          <img class="w-12 h-12 min-w-12 transform rotate-180" src="~@/assets/icons/icon-tips-send.svg" alt="">
          <div class="flex flex-col gap-1">
            <div class="flex-1 truncate flex items-center gap-1 cursor-pointer">
              <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
              <span class="truncate">username tiped $TTAI to you</span>
            </div>
            <div class="text-h3 text-green-34">+10000 $TTAI</div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-h4 bg-white p-3 rounded-xl mb-2">
          <img class="w-12 h-12 min-w-12 transform rotate-180" src="~@/assets/icons/icon-tips-received.svg" alt="">
          <div class="flex flex-col gap-1">
            <div class="flex-1 truncate flex items-center gap-1 cursor-pointer">
              <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
              <span class="truncate">tiped $TTAI to @username</span>
            </div>
            <div class="text-h3 text-red-normal">-10000 $TTAI</div>
            <div class="text-red-normal opacity-80 text-sm">Fail: exceed</div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
