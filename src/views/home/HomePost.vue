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
import { IgnoreAuthor } from "@/config";

// 新手引导卡：可关闭，关闭后持久记忆
const ONBOARD_KEY = 'onboard-card-dismissed'
const onboardDismissed = ref(localStorage.getItem(ONBOARD_KEY) === 'true')
function dismissOnboard() {
  onboardDismissed.value = true
  localStorage.setItem(ONBOARD_KEY, 'true')
}

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

/** 防止快速切 Tab / 连续刷新时，旧的补价结果写回新列表 */
let enrichSeq = 0

const showingTweets = computed(() => {
  if (tweetsStore?.homeTweetType === TweetListType.New) {
    return tweetsStore.newTweets
  }
  if (tweetsStore?.homeTweetType === TweetListType.Trending) {
    return tweetsStore.trendingTweets
  }
  return [] as Tweet[]
});

/** 按 tweetId 把链上补价写回当前列表（不挡首屏） */
const enrichHomeTweets = async (type: TweetListType, batch: Tweet[], seq: number) => {
  if (!batch.length) return
  try {
    const enriched = await getTokenInfoOfTweets(batch)
    // 已过期：用户切走了 Tab 或又点了刷新
    if (seq !== enrichSeq || tweetsStore.homeTweetType !== type) return
    const byId = new Map(enriched.map((t) => [t.tweetId, t]))
    const merge = (rows: Tweet[]) => rows.map((t) => byId.get(t.tweetId) ?? t)
    if (type === TweetListType.New) {
      tweetsStore.newTweets = merge(tweetsStore.newTweets)
    } else {
      tweetsStore.trendingTweets = merge(tweetsStore.trendingTweets)
    }
  } catch (e) {
    console.warn('[HomePost] enrich tweets failed', e)
  }
}

async function onRefresh() {
  const type = tweetsStore.homeTweetType as TweetListType
  const seq = ++enrichSeq
  try {
    refreshing.value = true;
    finished.value[type] = false;
    let list: Tweet[] = []
    if (type === TweetListType.New) {
      list = await getNewTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      // API 一到先出列表，补价后台回填
      tweetsStore.newTweets = list
    } else if (type === TweetListType.Trending) {
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      tweetsStore.trendingTweets = list
    }

    if (list.length < 30) {
      finished.value[type] = true
    }
    // 转圈结束：内容已可见，不必等链上价
    refreshing.value = false
    void enrichHomeTweets(type, list, seq)
  } catch (e) {
    handleErrorTip(e)
    refreshing.value = false
  }
}

async function onLoad() {
  const type = tweetsStore.homeTweetType as TweetListType
  try{
    if (refreshing.value || finished.value[type] || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    const page = Math.floor((showingTweets.value.length - 1) / 30) + 1
    let list: Tweet[] = []
    if (type === TweetListType.New) {
      list = await getNewTweets(accStore.getAccountInfo?.twitterId, page) as Tweet[]
      tweetsStore.newTweets = tweetsStore.newTweets.concat(list)
    } else if (type === TweetListType.Trending) {
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId, page) as Tweet[]
      tweetsStore.trendingTweets = tweetsStore.trendingTweets.concat(list)
    }
    if (list && list.length < 30) {
      finished.value[type] = true
    }
    loading.value = false
    // 分页同样：先追加再补价
    void enrichHomeTweets(type, list, enrichSeq)
  } catch (e) {
    handleErrorTip(e)
    loading.value = false
  }
}

onMounted(() => {
  void onRefresh();
  emitter.on('login', onRefresh);
});

watch([() => tweetsStore.homeTweetType], () => {
  void onRefresh()
})

onActivated(() => {
  if(pageScrollRef.value)
    pageScrollTo(pageScrollRef.value)
})

</script>

<template>
  <!-- 内容列限宽 600px（阅读行长上限）；中间档（804-1080）单列居中，≥1080 右栏 340px -->
  <div class="flex-1 min-h-0 overflow-hidden grid grid-cols-1 web:grid-cols-[minmax(0,600px)] desk:grid-cols-[minmax(0,600px)_minmax(280px,340px)] web:justify-center gap-3 px-3">
    <div class="h-full min-h-0 overflow-hidden min-w-0">
      <div class="h-full mobile-scroll-container no-scroll-bar" ref="pageScrollRef" @scroll="pageScroll(pageScrollRef)">
        <van-pull-refresh class="min-h-full"
                          v-model="refreshing"
                          @refresh="onRefresh"
                          :loading-text="$t('loading')"
                          :lpulling-text="$t('pullToRefreshData')"
                          :loosing-text="$t('releaseToRefresh')">
          <!-- 新手三步引导卡（可关闭） -->
          <div v-if="!onboardDismissed" class="bg-white rounded-2xl p-4 mb-2 border-[1px] border-orange-normal/20">
            <div class="flex items-center justify-between mb-2">
              <span class="text-h3">{{ $t('onboard.title') }}</span>
              <button class="text-sm text-grey-64 px-2 py-1 hover:text-black" @click="dismissOnboard">✕ {{ $t('onboard.dismiss') }}</button>
            </div>
            <ol class="text-sm text-grey-5a flex flex-col gap-1.5 list-decimal list-inside">
              <li>{{ $t('onboard.step1') }}</li>
              <li>{{ $t('onboard.step2') }}</li>
              <li>{{ $t('onboard.step3') }}</li>
            </ol>
            <router-link to="/about" class="inline-block mt-2 text-sm text-orange-normal font-semibold hover:underline">
              {{ $t('onboard.learnMore') }} →
            </router-link>
          </div>
          <van-list
              :loading="loading"
              :finished="finished[tweetsStore.homeTweetType]"
              :immediate-check="false"
              :finished-text="$t('noMore')"
              :offset="50"
              @load="onLoad"
          >
            <!-- 用 template 包 v-for，避免与 v-if 同元素时 v-if 优先导致 tweet 被解析为 api.tweet 函数 -->
            <template v-for="(tweet, index) of showingTweets" :key="tweet.tweetId">
              <div
                  class="mb-2"
              >
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
            </template>
          </van-list>
        </van-pull-refresh>
      </div>
    </div>
    <div class="h-full overflow-hidden hidden desk:block">
      <div class="h-full flex flex-col gap-3 overflow-y-auto no-scroll-bar">
        <!-- Live Spaces -->
        <TopOnlineSpaces />
        <!-- Top TagCoin -->
        <TopTagCoin />
        <!-- Top X Creators -->
        <div class="h-auto max-h-full bg-white rounded-2xl flex flex-col">
          <div class="font-bold text-h3 py-3 px-4">{{ $t('rightRail.topXCreators') }}</div>
          <div class="flex-1 overflow-auto no-scroll-bar">
            <UserList/>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped></style>
