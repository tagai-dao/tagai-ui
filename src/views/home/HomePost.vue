<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import {TweetListType, useTweetsStore} from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getNewTweets, getTrendingTweets} from "@/apis/api";
import {computed, onMounted, ref, watch} from "vue";
import { useCommunityStore } from "@/stores/community";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { useCurationStore } from "@/stores/curation";
import UserList from "@/views/home/UserList.vue";


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
    let list: Tweet[]
    if (tweetsStore.homeTweetType === TweetListType.New) {
      list = await getNewTweets() as Tweet[]
      tweetsStore.newTweets = list
    } else if (tweetsStore.homeTweetType === TweetListType.Trending) {
      list = await getTrendingTweets() as Tweet[]
      tweetsStore.trendingTweets = list
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
      list = await getNewTweets(Math.floor((showingTweets.value.length - 1) / 30) + 1) as Tweet[]
      tweetsStore.newTweets = tweetsStore.newTweets.concat(list)
    } else if (tweetsStore.homeTweetType === TweetListType.Trending) {
      list = await getTrendingTweets(Math.floor((showingTweets.value.length - 1) / 30) + 1) as Tweet[]
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
});

watch([() => tweetsStore.homeTweetType], async () => {
  await onRefresh()
})
</script>

<template>
  <div class="flex-1 overflow-hidden grid grid-cols-2 web:grid-cols-3 gap-3 px-3">
    <div class="col-span-2 h-full overflow-auto no-scroll-bar">
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
    <div class="hidden web:block col-span-1 flex-col bg-white rounded-2xl">
      <div class="font-bold text-h3 py-3 px-4">User</div>
      <div class="flex-1 h-full overflow-auto no-scroll-bar">
        <UserList/>
      </div>
    </div>

  </div>
</template>

<style scoped></style>
