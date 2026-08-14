<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import {TweetListType, useTweetsStore} from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getNewTweets, getTrendingTweets, getTradeFeed } from "@/apis/api";
import {computed, onActivated, onMounted, onUnmounted, ref, watch} from "vue";
import { useCommunityStore } from "@/stores/community";
import type { Community, FeedTokenSheetAsset, FeedTrade, Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { useCurationStore } from "@/stores/curation";
import UserList from "@/views/home/UserList.vue";
import TopTagCoin from "@/components/home/TopTagCoin.vue";
import TopOnlineSpaces from "@/components/home/TopOnlineSpaces.vue";
import { getTokenInfoOfTweets } from "@/utils/pump";
import {usePageScroll} from "@/composables/useTools";
import emitter from "@/utils/emitter";
import { IgnoreAuthor } from "@/config";
import FeedTradeActivity from '@/components/feed/FeedTradeActivity.vue'
import { getTokenInfo } from '@/utils/pump'
import FeedTokenDetailSheet from '@/components/feed/FeedTokenDetailSheet.vue'
import FeedTokenTradeSheet from '@/components/feed/FeedTokenTradeSheet.vue'

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
const trades = ref<FeedTrade[]>([])
const selectedFeedToken = ref<FeedTokenSheetAsset | null>(null)
const showFeedTokenSheet = ref(false)
const showFeedTradeSheet = ref(false)

function tradeIdentity(trade: FeedTrade) {
  const hash = trade.transHash?.trim().toLowerCase()
  if (hash) return `hash:${hash}`
  return [trade.timestamp, trade.trader, trade.token, trade.isBuy, trade.amount, trade.ethAmount].join(':').toLowerCase()
}

function mergeUniqueTrades(existing: FeedTrade[], incoming: FeedTrade[]) {
  const unique = new Map<string, FeedTrade>()
  for (const trade of [...existing, ...incoming]) unique.set(tradeIdentity(trade), trade)
  return [...unique.values()]
}

function openFeedTokenSheet(asset: FeedTokenSheetAsset) {
  selectedFeedToken.value = asset
  showFeedTradeSheet.value = false
  showFeedTokenSheet.value = true
}

function openBuy() {
  showFeedTradeSheet.value = true
}

function closeFeedSheets() {
  showFeedTradeSheet.value = false
  showFeedTokenSheet.value = false
  selectedFeedToken.value = null
}

watch(showFeedTokenSheet, visible => {
  if (!visible) showFeedTradeSheet.value = false
})

const feedItems = computed(() => {
  if (tweetsStore.homeTweetType !== TweetListType.New || !trades.value.length) return showingTweets.value.map(tweet => ({ type: 'post' as const, tweet }))
  const items: Array<{ type: 'post'; tweet: Tweet } | { type: 'trade'; trade: FeedTrade }> = []
  let tradeIndex = 0
  showingTweets.value.forEach((tweet, index) => {
    items.push({ type: 'post', tweet })
    if ((index + 1) % 3 === 0 && tradeIndex < trades.value.length) items.push({ type: 'trade', trade: trades.value[tradeIndex++]! })
  })
  return items
})

async function loadTrades(page = 0, replace = false) {
  try {
    const rows = (await getTradeFeed(page) || []) as FeedTrade[]
    const pseudo = rows.map(row => ({ ...row, description: '', name: row.name || row.tick, logo: row.logo || '' })) as unknown as Community[]
    const enriched = pseudo.length ? await getTokenInfo(pseudo) : []
    const byToken = new Map(enriched.map(item => [item.token?.toLowerCase(), item]))
    const next = rows.map(row => ({ ...row, ...(byToken.get(row.token?.toLowerCase()) || {}) })) as FeedTrade[]
    trades.value = mergeUniqueTrades(replace ? [] : trades.value, next)
  } catch (error) {
    console.warn('[HomePost] trade feed unavailable', error)
    if (replace) trades.value = []
  }
}

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
      const [tweetRows] = await Promise.all([getNewTweets(accStore.getAccountInfo?.twitterId), loadTrades(0, true)])
      list = tweetRows as Tweet[]
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
      void loadTrades(page)
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
  emitter.on('mainTabNavigate', closeFeedSheets)
});

onUnmounted(() => {
  emitter.off('login', onRefresh)
  emitter.off('mainTabNavigate', closeFeedSheets)
})

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
            <template v-for="item of feedItems" :key="item.type === 'post' ? item.tweet.tweetId : item.trade.transHash">
              <div
                  class="mb-2"
              >
                <FeedTradeActivity v-if="item.type === 'trade'" :trade="item.trade" @open-details="openFeedTokenSheet" />
                <SpaceItem
                    v-else-if="item.tweet.spaceId"
                    class="bg-white rounded-2xl"
                    :tweet="item.tweet"
                    @open-token-details="openFeedTokenSheet"
                    @click.stop="curationStore.currentSelectedTweet = item.tweet;$router.push(`/space-detail/${item.tweet.tweetId}`)"
                >
                  <template #tweet-action-bar>
                    <PostButtonGroup
                        @click.stop
                        :tweet="item.tweet"
                    />
                  </template>
                </SpaceItem>
                <TweetItem
                    v-else
                    class="bg-white rounded-2xl"
                    :tweet="item.tweet"
                    @open-token-details="openFeedTokenSheet"
                    @click.stop="curationStore.currentSelectedTweet = item.tweet;$router.push(`/post-detail/${item.tweet.tweetId}`)"
                >
                  <template #tweet-trade v-if="item.tweet.commerceId">
                    <CommerceBtn :tweet="item.tweet"/>
                  </template>
                  <template #tweet-action-bar>
                    <PostButtonGroup
                        @click.stop
                        :tweet="item.tweet"
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
  <FeedTokenDetailSheet v-model="showFeedTokenSheet" :asset="selectedFeedToken" @buy="openBuy" />
  <FeedTokenTradeSheet v-model="showFeedTradeSheet" :asset="selectedFeedToken" />
</template>

<style scoped></style>
