<script setup lang="ts">

import { formatAddress, formatAmount, parseTimestamp } from "@/utils/helper";
import { onMounted, ref, type PropType } from "vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import BackHeader from "@/layout/BackHeader.vue";
import { getTipRecord } from "@/apis/api";
import { handleErrorTip } from "@/utils/notify";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useSocialAccountModalStore } from "@/stores/wallet";
import { ChainConfig } from "@/config";
import { type TwitterTipRecord, TwitterTipStatus, TwitterTipClaimStatus, TwitterTipErrorType, type Account } from "@/types";
import { useRoute } from "vue-router";

const accStore = useAccountStore()
const socialAccountModalStore = useSocialAccountModalStore()
const route = useRoute()

const list = ref<TwitterTipRecord[]>([])

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const props = defineProps({
  userInfo: {
    type: Object as PropType<Account>,
    required: false
  }
})

const isOut = (twitterTipRecord: TwitterTipRecord) => {
  return twitterTipRecord.fromTwitterId === (props.userInfo?.twitterId ?? accStore.getAccountInfo.twitterId)
}

const onLoad = async () => {
  if (finished.value || refreshing.value || loading.value || list.value.length == 0 || list.value.length == 0) return
  try {
    loading.value = true
    const res: any = await getTipRecord(props.userInfo?.twitterId ?? accStore.getAccountInfo.twitterId, (list.value.length - 1) / 30 + 1)
    list.value = list.value.concat(res as TwitterTipRecord[])
    if (res.length < 30) {
      finished.value = true
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  try {
    if (refreshing.value) return
    refreshing.value = true
    const res: any = await getTipRecord(props.userInfo?.twitterId ?? accStore.getAccountInfo.twitterId)
    list.value = res as TwitterTipRecord[]
    if (res.length < 30) {
      finished.value = true
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    refreshing.value = false
  }
}

const gotoTweet = (twitterTipRecord: TwitterTipRecord) => {
  window.open(`https://twitter.com/${twitterTipRecord.fromTwitterUsername}/status/${twitterTipRecord.tweetId}`)
}

const gotoBrowser = (twitterTipRecord: TwitterTipRecord) => {
  window.open(`${ChainConfig.browser}tx/${twitterTipRecord.transHash}`)
}

async function claim() {

}

onMounted(() => {
  onRefresh()
})

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader v-if="route.path.includes('tip-record')" class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">{{$t('profileView.tipRecord')}}</div>
      </template>
    </BackHeader>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')"
                      class="flex-1 overflow-y-auto">
      <van-list class="px-3"
                :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :offset="50"
                @load="onLoad">
        <div v-for="(twitterTipRecord, index) in list" :key="index" class="flex items-center gap-3 text-h4 bg-white p-3 rounded-xl mb-2">
          <img class="w-6 h-6 min-w-6 rotate-180" v-if="isOut(twitterTipRecord)" src="~@/assets/icons/icon-tips-received.svg" alt="">
          <img class="w-6 h-6 min-w-6 rotate-180" v-else src="~@/assets/icons/icon-tips-send.svg" alt="">
          <div class="flex-1 flex flex-col gap-1">
            <div class="flex justify-between flex-col gap-1 web:flex-row web:items-stretch">
              <div class="flex flex-col gap-1">
                <div class="truncate flex items-center gap-1 cursor-pointer">
                  <div class="flex items-center">
                    <UserAvatar :profile-img="twitterTipRecord.fromProfile" :name="twitterTipRecord.fromTwitterName" :username="twitterTipRecord.fromTwitterUsername"
                      :followers="twitterTipRecord.fromFollowers" :followings="twitterTipRecord.fromFollowings"
                      :eth-addr="twitterTipRecord.fromEthAddr" :twitter-id="twitterTipRecord.fromTwitterId"
                      :steem-id="''" :teleported="true" :credit="0">
                      <template #avatar-img>
                          <img class="w-7 h-7 min-w-7 rounded-full cursor-pointer bg-color2A" :src="twitterTipRecord.fromProfile" alt="">
                      </template>
                    </UserAvatar>
                    <UserAvatar class="-ml-[6px] z-9" :profile-img="twitterTipRecord.toProfile" :name="twitterTipRecord.toTwitterName" :username="twitterTipRecord.toTwitterUsername"
                      :followers="twitterTipRecord.toFollowers" :followings="twitterTipRecord.toFollowings"
                      :eth-addr="twitterTipRecord.toEthAddr" :twitter-id="twitterTipRecord.toTwitterId"
                      :steem-id="''" :teleported="true" :credit="0">
                      <template #avatar-img>
                          <img class="w-7 h-7 min-w-7 rounded-full cursor-pointer bg-color2A" :src="twitterTipRecord.toProfile" alt="">
                      </template>
                    </UserAvatar>
                  </div>
                  <div class="flex items-center gap-1 ml-2">
                    <span v-if="isOut(twitterTipRecord)" class="truncate text-lg">{{$t('profileView.tipOut', {tick: twitterTipRecord.tick, username: twitterTipRecord.toTwitterUsername})}}</span>
                    <span v-else class="truncate text-lg">{{$t('profileView.receiveTip', {tick: twitterTipRecord.tick, username: twitterTipRecord.fromTwitterUsername})}}</span>
                    <span class="mx-4px"> · </span>
                    <span class="text-sm text-gray-normal">{{ parseTimestamp(new Date(twitterTipRecord.time).getTime() - 8000 * 3600) }}</span>
                    <span class="mx-4px"> · </span>
                    <button v-if="twitterTipRecord.tweetId" @click="gotoTweet(twitterTipRecord)">
                      <img class="w-4 h-4" src="~@/assets/icons/icon-x.svg" alt="">
                    </button>
                  </div>
                </div>
                <div class="h-7 hidden web:flex items-center">
                  <button v-if="twitterTipRecord.status === TwitterTipStatus.Success" class="text-sm text-green-400 underline">
                    {{ $t('profileView.viewOnBrowser') }}
                  </button>
                  <div v-else-if="twitterTipRecord.status === TwitterTipStatus.Pending" class="text-yellow-400 opacity-80 text-sm">
                    {{ $t('profileView.pending') }}
                  </div>
                  <div v-else-if="twitterTipRecord.errorType != TwitterTipErrorType.Success" class="text-red-normal opacity-80 text-sm">
                      <span>{{ $t('profileView.fail') }}: </span>
                      <span>{{ $t(`profileView.tipError${twitterTipRecord.errorType}`) }}</span> 
                  </div>
                </div>
              </div>
              <div class="flex justify-between items-center web:flex-col web:items-end">
                <div class="text-h3 leading-6" :class="isOut(twitterTipRecord) ? 'text-red-normal' : 'text-green-400'">{{ (isOut(twitterTipRecord) ? '-' : "+")  + formatAmount(twitterTipRecord.amount) }} ${{ twitterTipRecord.tick }}</div>
                <button v-if="twitterTipRecord.claimStatus === TwitterTipClaimStatus.PendingClaim" 
                  class="bg-orange-normal text-white h-7 rounded-full px-4"
                  @claim="claim">
                  {{$t('claim')}}
                </button>
              </div>
              <div class="web:hidden">
                <button v-if="twitterTipRecord.status === TwitterTipStatus.Success" 
                  class="text-sm text-green-400 underline"
                  @click="gotoBrowser(twitterTipRecord)">
                    {{ $t('profileView.viewOnBrowser') }}
                  </button>
                <div v-else-if="twitterTipRecord.status === TwitterTipStatus.Pending" class="text-yellow-400 opacity-80 text-sm">
                  {{ $t('profileView.pending') }}
                </div>
                <div v-else-if="twitterTipRecord.errorType != TwitterTipErrorType.Success" class="text-red-normal opacity-80 text-sm">
                    <span>{{ $t('profileView.fail') }}: </span>
                    <span>{{ $t(`profileView.tipError${twitterTipRecord.errorType}`) }}</span> 
                </div>
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
