<script setup lang="ts">
import TagCurationReward from "@/components/profile/TagCurationReward.vue";
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import { onMounted, ref, watch, type PropType } from "vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import { getUserTweets, getMyCurationRewards, userUnclaimableCurationRewards } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { useAccountStore } from "@/stores/web3";
import { getTokenInfoOfTweets, getTokenOnchainInfo } from '@/utils/pump'
import { formatPrice } from "@/utils/helper";
import { useStateStore } from "@/stores/common";
import { type CurationReward, type Tweet } from "@/types";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import { DefaultCommunityTick } from "@/config";
import { type Account } from "@/types";

const accStore = useAccountStore()
const stateStore = useStateStore()
const curationStore = useCurationStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const tweetsList = ref<Tweet[]>([])
const scroller = document.querySelector('#profile-tab-scroller')
const claimableRewards = ref<CurationReward[]>([])
const unclaimableRewards = ref<CurationReward[]>([])

let tabOptions = ['Processing', 'Claimable']
const rewardType = ref('Processing');

const props = defineProps({
  userInfo: {
    type: Object as PropType<Account>,
    required: false
  }
})

watch(() => rewardType.value, (val) => {
  updateReward();
})

const onLoad = async () => {
  if (finished.value || refreshing.value || tweetsList.value.length == 0) return
  // loading.value = true
  try {
    loading.value = true;
    const acc = props.userInfo ?? accStore.getAccountInfo
    let list: any = await getUserTweets(acc.twitterId, Math.floor((tweetsList.value.length - 1) / 30) + 1)
    if (list && list.length > 0) {
      tweetsList.value = tweetsList.value.concat(await getTokenInfoOfTweets(list))
    }
    if (list.length === 0) {
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
  try {
    refreshing.value = true
    finished.value = false
    const acc = props.userInfo ?? accStore.getAccountInfo
    const list: any = await getUserTweets(acc.twitterId)
    if (list && list.length > 0) {
      tweetsList.value = await getTokenInfoOfTweets(list)
      if (list.length < 30) finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

function updateReward() {
  const acc = props.userInfo ?? accStore.getAccountInfo
  if (rewardType.value === 'Claimable') {
    getMyCurationRewards(acc.twitterId).then((list: any) => {
      if (list && list.length > 0) {
        let versions: Record<string, number> = {}
        for (let t of list) {
          versions[t.token] = t.version ?? 2
        }
        getTokenOnchainInfo(list.map((l: any) => l.token), versions).then((tokeninfo: any) => {
          for (let t of list) {
            t.price = (tokeninfo[t.token].price ?? 0) * useStateStore().ethPrice;
          }
          claimableRewards.value = list
        })
      }else {
        claimableRewards.value = []
      }
    })
  } else {
    userUnclaimableCurationRewards(acc.twitterId).then((list: any) => {
      if (list && list.length > 0) {
        let versions: Record<string, number> = {}
        for (let t of list) {
          versions[t.token] = t.version ?? 2
        }
        getTokenOnchainInfo(list.map((l: any) => l.token), versions).then((tokeninfo: any) => {
          for (let t of list) {
            t.price = (tokeninfo[t.token].price ?? 0) * useStateStore().ethPrice;
          }
          unclaimableRewards.value = list
        })
      }else {
        unclaimableRewards.value = []
      }
    })
  }
}

onMounted(() => {
  if (props.userInfo) {
    tabOptions = ['Claimable', 'Processing']
    rewardType.value = 'Claimable'
  } else {
    tabOptions = ['Processing', 'Claimable']
    rewardType.value = 'Processing'
  }
  onRefresh()
  updateReward();
  emitter.on('claimedReward', updateReward)
})

</script>

<template>
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="min-h-full h-full overflow-auto"
      :loading-text="$t('loading')" :lpulling-text="$t('pullToRefreshData')" :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading" :finished="finished" :immediate-check="false" :finished-text="$t('noMore')"
        :scroller="scroller" :offset="50" @load="onLoad">
        <div class="flex items-center gap-1 px-3">
          <span class="font-normal text-sm">{{$t('postView.postReward')}}</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-white rounded-xl p-2 shadow-popper-tip">{{ $t('curation.curationTip') }}</div>
            </template>
          </el-popover>
        </div>
        <div v-if="userInfo || accStore.getAccountInfo.twitterId" class="my-3 gap-2 bg-white rounded-xl py-3 mx-3">
          <div class="flex justify-start mb-2">
            <button v-for="tab of tabOptions" :key="tab" class="px-3 rounded-full h-6 text-h3 whitespace-nowrap"
              :class="tab === rewardType ? 'text-gradient bg-gradient-primary' : 'text-grey-normal'"
              @click="rewardType = tab">{{ tab }}</button>
          </div>

          <div v-show="rewardType == 'Claimable'"
            class="w-full flex gap-3 scroll-pl-3 overflow-x-auto overflow-y-auto no-scroll-bar mt-1 snap-x">
            <div v-if="claimableRewards.length > 0" class="pb-5 snap-start shrink-0 first:pl-3 last:pr-3"
              v-for="reward of claimableRewards" :key="reward.tick + 'claimable'">
              <TagCurationReward v-if="reward.amount > 0" :reward :can-claim="true" :is-profile="!userInfo"/>
            </div>
            <div v-else class="w-full flex my-8 justify-center items-center">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
          </div>

          <div v-show="rewardType == 'Processing'"
            class="w-full flex gap-3 scroll-pl-3 overflow-x-auto overflow-y-auto no-scroll-bar mt-1 snap-x">
            <div v-if="unclaimableRewards.length > 0" class="snap-start shrink-0 first:pl-3 last:pr-3"
              v-for="reward of unclaimableRewards" :key="reward.tick + 'unclaimable'">
              <TagCurationReward v-if="reward.amount > 0" :reward :can-claim="false" :is-profile="!userInfo"/>
            </div>
            <div v-else class="w-full flex my-8 justify-center items-center">
              <img src="~@/assets/images/empty-data.svg" alt="">
            </div>
          </div>
        </div>
        <div class="px-3">
          <div v-for="tweet of tweetsList" :key="tweet.tweetId">
            <div v-if="tweet.tick !== DefaultCommunityTick" class="flex items-center gap-2 py-3">
              <div class="w-4 h-4 bg-green-normal rounded-full"></div>
              <router-link :to="`/tag-detail/${tweet.tick}`" class="text-base flex-1">
                #{{ tweet.tick }} • Market cap {{ formatPrice((tweet.marketCap ?? 0) * stateStore.ethPrice) }}
              </router-link>
            </div>
            <div class="bg-white rounded-2xl mb-3">
              <SpaceItem v-if="tweet.spaceId" :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet; $router.push(`/space-detail/${tweet.tweetId}`)">
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet" />
                </template>
              </SpaceItem>
              <TweetItem v-else :tweet="tweet"
                @click.stop="curationStore.currentSelectedTweet = tweet; $router.push(`/post-detail/${tweet.tweetId}`)">
                <template #tweet-trade v-if="tweet.commerceId">
                  <CommerceBtn :tweet="tweet"></CommerceBtn>
                </template>
                <template #tweet-action-bar>
                  <PostButtonGroup :tweet="tweet" />
                </template>
              </TweetItem>
            </div>
          </div>
        </div>
        <div v-if="!loading && !refreshing && tweetsList.length === 0" class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
