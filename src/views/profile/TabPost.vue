<script setup lang="ts">
import TagCurationReward from "@/components/profile/TagCurationReward.vue";
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import {onMounted, ref} from "vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import { getUserTweets } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import { getTokenInfoOfTweets, getTokenOnchainInfo } from '@/utils/pump'
import { formatPrice } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { getMyCurationRewards } from '@/apis/api'
import { type CurationReward } from "@/types";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";

const accStore = useAccountStore()
const stateStore = useStateStore()
const curationStore = useCurationStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const scroller = document.querySelector('#profile-tab-scroller')
const listData = ref<CurationReward[]>([])

const onLoad = async () => {
  if(finished.value || refreshing.value || accStore.tweetsList.length == 0) return
  // loading.value = true
  try{
    loading.value = true;
    let list : any = await getUserTweets(accStore.getAccountInfo.twitterId, Math.floor((accStore.tokenHoldingList.length - 1) / 30) + 1)
    if (list && list.length > 0) {
      accStore.tweetsList = accStore.tweetsList.concat(await getTokenInfoOfTweets(list))
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
    const list: any = await getUserTweets(accStore.getAccountInfo.twitterId)
    if (list && list.length > 0) {
      accStore.tweetsList = await getTokenInfoOfTweets(list)
      if (list.length < 30) finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

function updateReward() {
  getMyCurationRewards(accStore.getAccountInfo.twitterId).then((list: any) => {
    if (list && list.length > 0) {
      getTokenOnchainInfo(list.map((l: any) => l.token)).then((tokeninfo: any) => {
        for (let t of list) {
          t.price = (tokeninfo[t.token].price ?? 0) * useStateStore().ethPrice;
          // t.price = t.price ? t.price.toString() / 1e18 * useStateStore().ethPrice : 0
        }
        listData.value = list
      })
    }
  })
}

onMounted(() => {
  onRefresh()
  updateReward();
  emitter.on('claimedReward', updateReward)
})

</script>

<template>
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
                      loading-text="Loading"
                      pulling-text="Pull to refresh data"
                      loosing-text="Release to refresh">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                finished-text="No more"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div class="flex items-center gap-1 px-3" v-if="listData.length > 0">
          <span class="font-normal text-sm">Curation or Space Rewards</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-white rounded-xl p-2 shadow-popper-tip">{{ $t('curation.curationTip') }}</div>
            </template>
          </el-popover>
        </div>
        <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar mt-1 snap-x">
          <div class="snap-start shrink-0 first:pl-3 last:pr-3" v-for="reward of listData" :key="reward.tick">
            <TagCurationReward :reward/>
          </div>
        </div>
        <div class="px-3">
          <div v-for="tweet of accStore.tweetsList" :key="tweet.tweetId">
            <div class="flex items-center gap-2 py-3">
              <div class="w-4 h-4 bg-green-normal rounded-full"></div>
              <router-link :to="`/tag-detail/${tweet.tick}`" class="text-base flex-1">
                #{{ tweet.tick }} • Market cap {{ formatPrice((tweet.marketCap ?? 0) * stateStore.ethPrice) }}
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
        <div v-if="!loading && !refreshing && accStore.tweetsList.length===0"
             class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
