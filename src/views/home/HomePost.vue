<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import {TweetListType, useTweetsStore} from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getNewTweets, getTrendingTweets} from "@/apis/api";
import {computed, onActivated, onMounted, ref, watch} from "vue";
import { useCommunityStore } from "@/stores/community";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { useCurationStore } from "@/stores/curation";
import UserList from "@/views/home/UserList.vue";
import TopTagCoin from "@/components/home/TopTagCoin.vue";
import TopOnlineSpaces from "@/components/home/TopOnlineSpaces.vue";
import { getTokenInfoOfTweets } from "@/utils/pump";
import {usePageScroll} from "@/composables/useTools";
import emitter from "@/utils/emitter";

const { pageScroll, pageScrollTo} = usePageScroll()
const pageScrollRef = ref()
const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref({
  'new': false,
  'trending': false
});
const comStore = useCommunityStore();
const curationStore = useCurationStore()

const showingTweets = computed(() => {
  if(tweetsStore && tweetsStore.homeTweetType === TweetListType.New) {
    return tweetsStore.newTweets
  }
  if(tweetsStore && tweetsStore.homeTweetType === TweetListType.Trending) {
    return tweetsStore.trendingTweets
  }
  return [] as Tweet[];
});

async function onRefresh() {
  try {
    refreshing.value = true;
    finished.value[tweetsStore.homeTweetType as TweetListType] = false;
    let list: Tweet[] = []
    if (tweetsStore.homeTweetType === TweetListType.New) {
      list = await getNewTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      tweetsStore.newTweets = await getTokenInfoOfTweets(list)
    } else if (tweetsStore.homeTweetType === TweetListType.Trending) {
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      tweetsStore.trendingTweets = await getTokenInfoOfTweets(list)
    }

    if (list.length < 30) {
      finished.value[tweetsStore.homeTweetType] = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  try{
    if (refreshing.value || finished.value[tweetsStore.homeTweetType as TweetListType] || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    let list: Tweet[] = []
    if (tweetsStore.homeTweetType === TweetListType.New) {
      list = await getNewTweets(accStore.getAccountInfo?.twitterId, Math.floor((showingTweets.value.length - 1) / 30) + 1) as Tweet[]
      list = await getTokenInfoOfTweets(list)
      tweetsStore.newTweets = tweetsStore.newTweets.concat(list)
    } else if (tweetsStore.homeTweetType === TweetListType.Trending) {
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId, Math.floor((showingTweets.value.length - 1) / 30) + 1) as Tweet[]
      list = await getTokenInfoOfTweets(list)
      tweetsStore.trendingTweets = tweetsStore.trendingTweets.concat(list)
    }
    if (list && list.length < 30) {
      finished.value[tweetsStore.homeTweetType] = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await onRefresh();
  emitter.on('login', onRefresh);
});

watch([() => tweetsStore.homeTweetType], async () => {
  await onRefresh()
})

onActivated(() => {
  if(pageScrollRef.value)
    pageScrollTo(pageScrollRef.value)
})

</script>

<template>
  <div class="flex-1 overflow-hidden grid grid-cols-2 web:grid-cols-3 gap-3 px-3">
    <div class="col-span-2 h-full overflow-hidden">
      <div class="h-full overflow-auto no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <van-pull-refresh class="min-h-full"
                          v-model="refreshing"
                          @refresh="onRefresh"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <van-list
              :loading="loading"
              :finished="finished[tweetsStore.homeTweetType]"
              :immediate-check="false"
              :finished-text="$t('noMore')"
              :offset="50"
              @load="onLoad"
          >
            <div v-for="(tweet, index) of showingTweets" :key="tweet.tweetId" class="mb-2">
              <SpaceItem
                  v-if="tweet.spaceId"
                  class="bg-white rounded-2xl"
                  :tweet="tweet"
                  @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/space-detail/${tweet.tweetId}`)"
              >
                <template #tweet-action-bar>
                  <PostButtonGroup
                      @click.stop
                      :tweet="tweet"
                  />
                </template>
              </SpaceItem>
              <TweetItem
                  v-else
                  class="bg-white rounded-2xl"
                  :tweet="tweet"
                  @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/post-detail/${tweet.tweetId}`)"
              >
                <template #tweet-trade v-if="tweet.commerceId">
                  <CommerceBtn :tweet="tweet"/>
                </template>
                <template #tweet-action-bar>
                  <PostButtonGroup
                      @click.stop
                      :tweet="tweet"
                  />
                </template>
              </TweetItem>
            </div>
          </van-list>
        </van-pull-refresh>
      </div>
    </div>
    <div class="col-span-1 h-full overflow-hidden hidden web:block">
      <div class="h-full flex flex-col gap-3">
        <!-- Live Spaces -->
        <TopOnlineSpaces />
        <!-- Top TagCoin -->
        <TopTagCoin />
        <!-- Top X Creators -->
        <div class="h-auto max-h-full bg-white rounded-2xl flex flex-col">
          <div class="font-bold text-h3 py-3 px-4">Top X Creators</div>
          <div class="flex-1 overflow-auto no-scroll-bar">
            <UserList/>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped></style>
