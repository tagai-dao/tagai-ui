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
const aggregatePostFinished = ref(false)
const aggregateTradeFinished = ref(false)
const tradeLoading = ref(false)
let aggregatePostPage = 0
let aggregateTradePage = 0
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
  if (tweetsStore.homeTweetType !== TweetListType.New || tweetsStore.homeNewSource !== 'x' || !trades.value.length) return showingTweets.value.map(tweet => ({ type: 'post' as const, tweet }))
  const toMillis = (value: string | number | Date | undefined) => {
    if (value === undefined || value === null || value === '') return 0
    if (value instanceof Date) return value.getTime()
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
    const parsed = Date.parse(String(value))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const items: Array<{ type: 'post'; tweet: Tweet } | { type: 'trade'; trade: FeedTrade }> = [
    ...showingTweets.value.map(tweet => ({ type: 'post' as const, tweet })),
    ...trades.value.map(trade => ({ type: 'trade' as const, trade })),
  ]
  return items.sort((a, b) => {
    const aTime = a.type === 'post' ? toMillis(a.tweet.tweetTime) : toMillis(a.trade.timestamp)
    const bTime = b.type === 'post' ? toMillis(b.tweet.tweetTime) : toMillis(b.trade.timestamp)
    return bTime - aTime
  })
})

async function loadTrades(page = 0, replace = false) {
  const seq = enrichSeq
  tradeLoading.value = true
  try {
    const rows = (await getTradeFeed(page) || []) as FeedTrade[]
    if (seq !== enrichSeq || tweetsStore.homeNewSource !== 'x') return -1
    trades.value = mergeUniqueTrades(replace ? [] : trades.value, rows)
    const pseudo = rows.map(row => ({ ...row, description: '', name: row.name || row.tick, logo: row.logo || '' })) as unknown as Community[]
    // Publish API rows immediately; optional RPC metadata must not block posts.
    void getTokenInfo(pseudo).then(enriched => {
      if (seq !== enrichSeq) return
      const byToken = new Map(enriched.map(item => [item.token?.toLowerCase(), item]))
      trades.value = trades.value.map(row => {
        const metrics = byToken.get(row.token?.toLowerCase())
        return metrics ? { ...row, price: metrics.price, marketCap: metrics.marketCap, totalSupply: metrics.totalSupply, logo: row.logo || metrics.logo } : row
      })
    }).catch(error => console.warn('[HomePost] trade enrichment unavailable', error))
    return rows.length
  } catch (error) {
    console.warn('[HomePost] trade feed unavailable', error)
    return -1
  } finally {
    if (seq === enrichSeq) tradeLoading.value = false
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
  const source = tweetsStore.homeNewSource
  const seq = ++enrichSeq
  try {
    refreshing.value = true;
    finished.value[type] = false;
    let list: Tweet[] = []
    if (type === TweetListType.New) {
      if (source === 'x') {
        aggregatePostFinished.value = false
        aggregateTradeFinished.value = false
        void loadTrades(0, true).then(count => {
          if (seq !== enrichSeq) return
          aggregateTradePage = count >= 0 ? 1 : 0
          aggregateTradeFinished.value = count >= 0 && count < 30
          finished.value[type] = aggregatePostFinished.value && aggregateTradeFinished.value
        })
      }
      const tweetRows = await getNewTweets(accStore.getAccountInfo?.twitterId, 0, source === 'x' ? undefined : source)
      list = tweetRows as Tweet[]
      if (seq !== enrichSeq || tweetsStore.homeTweetType !== type || tweetsStore.homeNewSource !== source) return
      if (source === 'x') {
        aggregatePostPage = 1
        aggregatePostFinished.value = list.length < 30
        finished.value[type] = aggregatePostFinished.value && aggregateTradeFinished.value
      } else {
        trades.value = []
        aggregatePostFinished.value = false
        aggregateTradeFinished.value = false
        finished.value[type] = list.length < 30
      }
      // API 一到先出列表，补价后台回填
      tweetsStore.newTweets = list
    } else if (type === TweetListType.Trending) {
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId) as Tweet[]
      if (seq !== enrichSeq || tweetsStore.homeTweetType !== type) return
      tweetsStore.trendingTweets = list
    }

    if (type !== TweetListType.New && list.length < 30) {
      finished.value[type] = true
    }
    // 转圈结束：内容已可见，不必等链上价
    refreshing.value = false
    void enrichHomeTweets(type, list, seq)
  } catch (e) {
    if (seq !== enrichSeq) return
    handleErrorTip(e)
    refreshing.value = false
  }
}

async function onLoad() {
  const seq = enrichSeq
  const type = tweetsStore.homeTweetType as TweetListType
  const source = tweetsStore.homeNewSource
  try{
    if (loading.value || refreshing.value || finished.value[type] || feedItems.value.length === 0 || (source === 'x' && tradeLoading.value)) {
      return;
    }
    loading.value = true
    let list: Tweet[] = []
    if (type === TweetListType.New) {
      if (source === 'x') {
        const [tweetRows, tradeCount] = await Promise.all([
          aggregatePostFinished.value
            ? Promise.resolve([] as Tweet[])
            : getNewTweets(accStore.getAccountInfo?.twitterId, aggregatePostPage),
          aggregateTradeFinished.value
            ? Promise.resolve(0)
            : loadTrades(aggregateTradePage),
        ])
        list = tweetRows as Tweet[]
        if (seq !== enrichSeq || tweetsStore.homeTweetType !== type || tweetsStore.homeNewSource !== source) {
          loading.value = false
          return
        }
        if (!aggregatePostFinished.value) {
          aggregatePostPage += 1
          aggregatePostFinished.value = list.length < 30
          tweetsStore.newTweets = tweetsStore.newTweets.concat(list)
        }
        if (!aggregateTradeFinished.value && tradeCount >= 0) {
          aggregateTradePage += 1
          aggregateTradeFinished.value = tradeCount < 30
        }
        finished.value[type] = aggregatePostFinished.value && aggregateTradeFinished.value
      } else {
        const page = Math.floor((showingTweets.value.length - 1) / 30) + 1
        list = await getNewTweets(accStore.getAccountInfo?.twitterId, page, source) as Tweet[]
        if (seq !== enrichSeq || tweetsStore.homeTweetType !== type || tweetsStore.homeNewSource !== source) {
          loading.value = false
          return
        }
        tweetsStore.newTweets = tweetsStore.newTweets.concat(list)
        if (list.length < 30) finished.value[type] = true
      }
    } else if (type === TweetListType.Trending) {
      const page = Math.floor((showingTweets.value.length - 1) / 30) + 1
      list = await getTrendingTweets(accStore.getAccountInfo?.twitterId, page) as Tweet[]
      if (seq !== enrichSeq || tweetsStore.homeTweetType !== type) {
        loading.value = false
        return
      }
      tweetsStore.trendingTweets = tweetsStore.trendingTweets.concat(list)
    }
    if (type === TweetListType.Trending && list && list.length < 30) {
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
  enrichSeq++
  emitter.off('login', onRefresh)
  emitter.off('mainTabNavigate', closeFeedSheets)
})

watch([() => tweetsStore.homeTweetType, () => tweetsStore.homeNewSource], ([type, source], [, previousSource]) => {
  if (type === TweetListType.New && source !== previousSource) tweetsStore.newTweets = []
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
            <template v-for="item of feedItems" :key="item.type === 'post' ? item.tweet.tweetId : tradeIdentity(item.trade)">
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
