<script setup lang="ts">
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import {onMounted, ref, computed} from "vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import { getUserBlinks } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import { getTokenInfoOfTweets } from '@/utils/pump'
import { formatPrice, formatAmount } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { useCurationStore } from "@/stores/curation";

const accStore = useAccountStore()
const stateStore = useStateStore()
const curationStore = useCurationStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')

const capturedFee = computed(() => {
  let captured: any = accStore.ipshare.totalCaptured
  if (typeof(captured) == 'string' || typeof(captured) === 'bigint') {
    // @ts-ignore
    return captured.toString() / 1e18
  }
  return captured
})

const onLoad = async () => {
  if(finished.value || refreshing.value || accStore.blinksList.length == 0) return
  // loading.value = true
  try{
    loading.value = true;
    let list : any = await getUserBlinks(accStore.getAccountInfo.twitterId, Math.floor((accStore.tokenHoldingList.length - 1) / 30) + 1)
    if (list && list.length > 0) {
      accStore.blinksList = accStore.blinksList.concat(await getTokenInfoOfTweets(list))
    }
    if (list.length  === 0) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
};

const onRefresh = async () => {
  if (loading.value) {
    return;
  }
  try{
    refreshing.value = true
    finished.value = false
    const list: any = await getUserBlinks(accStore.getAccountInfo.twitterId)
    if (list && list.length > 0) {
      accStore.blinksList = await getTokenInfoOfTweets(list)
      if (list.length < 30) finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

onMounted(() => {
  onRefresh()
})

</script>

<template>
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div  class="px-3">
          <div class="flex items-center gap-1 mb-2">
            <span class="font-normal text-sm">{{ $t('profileView.captureTitle') }}</span>
            <el-popover popper-class="c-popper">
              <template #reference>
                <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-2 shadow-popper-tip">{{ $t('profileView.captureDesc') }}</div>
              </template>
            </el-popover>
          </div>
          <button class="bg-gradient-primary h-16 w-full rounded-xl flex items-center justify-center gap-1 text-white mb-2">
            <span class="text-h1 mr-2">{{ formatPrice(capturedFee * useStateStore().ethPrice) }}</span>
            <!-- <img src="~@/assets/icons/icon-up.svg" alt=""> -->
            <span class="text-sm">($BNB {{ formatAmount(capturedFee) }})</span>
          </button>
        </div>
        <div class="px-3">
          <div v-for="tweet of accStore.blinksList" :key="tweet.tweetId">
            <div class="flex items-center gap-2 py-3">
              <div class="w-4 h-4 bg-green-normal rounded-full"></div>
              <router-link :to="`/tag-detail/${tweet.tick}`" class="text-base flex-1">
                #{{ tweet.tick }} • Market cap {{ formatPrice(Math.round((tweet.marketCap ?? 0) * stateStore.ethPrice)) }}
              </router-link>
              <!-- <router-link :to="`/buy-sell/${tweet.tick}`" class="justify-center flex items-center bg-green-normal h-8 px-3 min-w-16 rounded-full text-sm">
                Trade
              </router-link> -->
            </div>
            <div class="bg-white rounded-2xl mb-3">
              <SpaceItem v-if="tweet.spaceId" :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/space-detail/${tweet.tweetId}`)">
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet"/>
                </template>
              </SpaceItem>
              <TweetItem v-else :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/post-detail/${tweet.tweetId}`)">
                <template #tweet-trade v-if="tweet.commerceId">
                  <CommerceBtn :tweet="tweet"></CommerceBtn>
                </template>
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet"/>
                </template>
              </TweetItem>
            </div>
          </div>
        </div>
        <div v-if="!loading && !refreshing && accStore.blinksList.length===0"
             class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
