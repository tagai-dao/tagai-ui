<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets, getCommunitySpaceTweets, getCommunityTrendingTweets, getCommunityTippedTweets, getCommunityCallouts, getTokenTradeList, type ExternalCalloutSource } from "@/apis/api";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { FeedTokenSheetAsset, FeedTrade, Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import FeedTokenDetailSheet from '@/components/feed/FeedTokenDetailSheet.vue'
import FeedTokenTradeSheet from '@/components/feed/FeedTokenTradeSheet.vue'
import FeedTradeActivity from '@/components/feed/FeedTradeActivity.vue'
import { externalSourceLogos } from '@/assets/externalSourceLogos'

enum ListType {
  All = 'all',
  Trending = 'trending',
  New = 'new',
  Space = 'space',
  Tipped = 'tipped',
  Gmgn = 'gmgn',
  Fomo = 'fomo',
  Pump = 'pump',
}
const PAGE_SIZE = 30
const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref<Record<ListType, boolean>>({
  'all': false,
  'new': false,
  'space': false,
  'trending': false,
  'tipped': false,
  'gmgn': false,
  'fomo': false,
  'pump': false,
});
const comStore = useCommunityStore();
const curationStore = useCurationStore()
const listType = ref<ListType>(ListType.All)
const nextPage = ref<Record<ListType, number>>({
  [ListType.All]: 0,
  [ListType.New]: 0,
  [ListType.Space]: 0,
  [ListType.Trending]: 0,
  [ListType.Tipped]: 0,
  [ListType.Gmgn]: 0,
  [ListType.Fomo]: 0,
  [ListType.Pump]: 0,
})
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null
const selectedFeedToken = ref<FeedTokenSheetAsset | null>(null)
const showFeedTokenSheet = ref(false)
const showFeedTradeSheet = ref(false)
const allCommunityTweets = ref<Tweet[]>([])
const communityTrades = ref<FeedTrade[]>([])
const allPostFinished = ref(false)
const allTradeFinished = ref(false)
let allPostPage = 0
let allTradePage = 0
let activeCommunityTick = ''

const calloutTypes = new Set<ListType>([ListType.Gmgn, ListType.Fomo, ListType.Pump])
const calloutSource = (type: ListType): ExternalCalloutSource => type as ExternalCalloutSource
const calloutStoreKey = (tick: string, source: ExternalCalloutSource) => `${tick}:${source}`

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

function mergeUniqueTweets(existing: Tweet[], incoming: Tweet[]) {
  const unique = new Map<string, Tweet>()
  for (const tweet of [...existing, ...incoming]) unique.set(tweet.tweetId, tweet)
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

const showingTweets = computed(() => {
  if (comStore.currentSelectedCommunity?.tick &&
    tweetsStore) {
      if (listType.value === ListType.All) {
        return allCommunityTweets.value
      }else if (listType.value === ListType.New &&
      tweetsStore.communityTweets) {
        return tweetsStore.communityTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
      }else if (listType.value === ListType.Space &&
      tweetsStore.communitySpaceTweets) {
        return tweetsStore.communitySpaceTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
      }else if (listType.value === ListType.Tipped &&
      tweetsStore.communityTippedTweets) {
        return tweetsStore.communityTippedTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
      }else if (listType.value === ListType.Trending &&
      tweetsStore.communityTrendingTweets) {
        return tweetsStore.communityTrendingTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
      }else if (calloutTypes.has(listType.value) && tweetsStore.communityCalloutTweets) {
        return tweetsStore.communityCalloutTweets[
          calloutStoreKey(comStore.currentSelectedCommunity.tick, calloutSource(listType.value))
        ] as Tweet[];
      }
    }
  return [] as Tweet[];
});

const feedItems = computed(() => {
  const posts = showingTweets.value.map(tweet => ({ type: 'post' as const, tweet }))
  if (listType.value !== ListType.All) return posts
  const toMillis = (value: string | number | Date | undefined) => {
    if (value === undefined || value === null || value === '') return 0
    if (value instanceof Date) return value.getTime()
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
    const parsed = Date.parse(String(value))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const items: Array<{ type: 'post'; tweet: Tweet } | { type: 'trade'; trade: FeedTrade }> = [
    ...posts,
    ...communityTrades.value.map(trade => ({ type: 'trade' as const, trade })),
  ]
  return items.sort((a, b) => {
    const aTime = a.type === 'post' ? toMillis(a.tweet.tweetTime) : toMillis(a.trade.timestamp)
    const bTime = b.type === 'post' ? toMillis(b.tweet.tweetTime) : toMillis(b.trade.timestamp)
    return bTime - aTime
  })
})

async function loadCommunityTrades(page = 0, replace = false) {
  try {
    const community = comStore.currentSelectedCommunity
    if (!community?.token) return 0
    const requestedToken = community.token
    const rows = (await getTokenTradeList(community.token, page) || []) as FeedTrade[]
    if (comStore.currentSelectedCommunity?.token !== requestedToken) return -1
    const next = rows.map(row => ({
      ...row,
      tick: row.tick || community.tick,
      token: row.token || community.token,
      name: row.name || community.name,
      logo: row.logo || community.logo,
      marketCap: row.marketCap ?? community.marketCap,
      price: row.price ?? community.price,
      isImport: row.isImport ?? community.isImport,
      version: row.version ?? community.version ?? undefined,
      pair: row.pair ?? community.pair,
      dexVersion: row.dexVersion ?? community.dexVersion ?? undefined,
    }))
    communityTrades.value = mergeUniqueTrades(replace ? [] : communityTrades.value, next)
    return rows.length
  } catch (error) {
    console.warn('[TagContent] community trade feed unavailable', error)
    if (replace) communityTrades.value = []
    return -1
  }
}

async function onRefresh() {
  const activeListType = listType.value
  try {
    refreshing.value = true;
    finished.value[activeListType] = false;
    nextPage.value[activeListType] = 0
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    if (activeListType === ListType.All) {
      const [postRows, tradeCount] = await Promise.all([
        getCommunityNewTweets(tick, twitterId, 0),
        loadCommunityTrades(0, true),
      ])
      if (comStore.currentSelectedCommunity?.tick !== tick) return
      list = postRows as Tweet[]
      allCommunityTweets.value = await getTokenInfoOfTweets(list)
      allPostPage = 1
      allTradePage = tradeCount >= 0 ? 1 : 0
      allPostFinished.value = list.length < PAGE_SIZE
      allTradeFinished.value = tradeCount >= 0 && tradeCount < PAGE_SIZE
      finished.value[ListType.All] = allPostFinished.value && allTradeFinished.value
    } else if (activeListType === ListType.New) {
      list = await getCommunityNewTweets(tick, twitterId, 0);

      if (!tweetsStore.communityTweets) {
        tweetsStore.communityTweets = {};
      }
      tweetsStore.communityTweets[
        tick
      ] = list as Tweet[];
      tweetsStore.communityTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communityTweets[tick])
    } else if (activeListType === ListType.Trending) {
      list = await getCommunityTrendingTweets(tick, twitterId, 0)
      if (!tweetsStore.communityTrendingTweets) {
        tweetsStore.communityTrendingTweets = {};
      }
      tweetsStore.communityTrendingTweets[tick] = list as Tweet[];
      tweetsStore.communityTrendingTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communityTrendingTweets[tick])
    } else if (activeListType === ListType.Space) {
      list = await getCommunitySpaceTweets(tick, twitterId, 0)

      if (!tweetsStore.communitySpaceTweets) {
        tweetsStore.communitySpaceTweets = {};
      }
      tweetsStore.communitySpaceTweets[tick] = list as Tweet[];
      tweetsStore.communitySpaceTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communitySpaceTweets[tick])
    } else if (activeListType === ListType.Tipped) {
      list = await getCommunityTippedTweets(tick, twitterId, 0)

      if (!tweetsStore.communityTippedTweets) {
        tweetsStore.communityTippedTweets = {};
      }
      tweetsStore.communityTippedTweets[tick] = list as Tweet[];
      tweetsStore.communityTippedTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communityTippedTweets[tick])
    } else if (calloutTypes.has(activeListType)) {
      const source = calloutSource(activeListType)
      const key = calloutStoreKey(tick, source)
      list = await getCommunityCallouts(tick, source, twitterId, 0)
      if (!tweetsStore.communityCalloutTweets) tweetsStore.communityCalloutTweets = {}
      tweetsStore.communityCalloutTweets[key] = await getTokenInfoOfTweets(list as Tweet[])
    }

    if (activeListType !== ListType.All) {
      const receivedCount = Array.isArray(list) ? list.length : 0
      nextPage.value[activeListType] = receivedCount > 0 ? 1 : 0
      finished.value[activeListType] = receivedCount < PAGE_SIZE
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  const activeListType = listType.value
  try{
    if (loading.value || refreshing.value || finished.value[activeListType] || feedItems.value.length === 0) {
      return;
    }
    loading.value = true
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    const page = nextPage.value[activeListType]
    if (activeListType === ListType.All) {
      const [postRows, tradeCount] = await Promise.all([
        allPostFinished.value
          ? Promise.resolve([] as Tweet[])
          : getCommunityNewTweets(tick, twitterId, allPostPage),
        allTradeFinished.value
          ? Promise.resolve(0)
          : loadCommunityTrades(allTradePage),
      ])
      if (comStore.currentSelectedCommunity?.tick !== tick) return
      list = postRows as Tweet[]
      if (!allPostFinished.value) {
        const enriched = list.length ? await getTokenInfoOfTweets(list) : []
        allCommunityTweets.value = mergeUniqueTweets(allCommunityTweets.value, enriched)
        allPostPage += 1
        allPostFinished.value = list.length < PAGE_SIZE
      }
      if (!allTradeFinished.value && tradeCount >= 0) {
        allTradePage += 1
        allTradeFinished.value = tradeCount < PAGE_SIZE
      }
      finished.value[ListType.All] = allPostFinished.value && allTradeFinished.value
    } else if (activeListType === ListType.New) {
      list = await getCommunityNewTweets(tick, twitterId, page)
      tweetsStore.communityTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communityTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communityTweets![
        tick
      ])
    } else if (activeListType === ListType.Trending) {
      list = await getCommunityTrendingTweets(tick, twitterId, page)
      tweetsStore.communityTrendingTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communityTrendingTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communityTrendingTweets![
        tick
      ])
    } else if (activeListType === ListType.Space) {
      list = await getCommunitySpaceTweets(tick, twitterId, page)
      tweetsStore.communitySpaceTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communitySpaceTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communitySpaceTweets![
        tick
      ])
    } else if (activeListType === ListType.Tipped) {
      list = await getCommunityTippedTweets(tick, twitterId, page)
      tweetsStore.communityTippedTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communityTippedTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communityTippedTweets![
        tick
      ])
    } else if (calloutTypes.has(activeListType)) {
      const source = calloutSource(activeListType)
      const key = calloutStoreKey(tick, source)
      list = await getCommunityCallouts(tick, source, twitterId, page)
      if (!tweetsStore.communityCalloutTweets) tweetsStore.communityCalloutTweets = {}
      tweetsStore.communityCalloutTweets[key] = await getTokenInfoOfTweets(showingTweets.value.concat(list as Tweet[]))
    }
    if (activeListType !== ListType.All) {
      const receivedCount = Array.isArray(list) ? list.length : 0
      nextPage.value[activeListType] = page + 1
      finished.value[activeListType] = receivedCount < PAGE_SIZE
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

async function observeLoadMoreSentinel() {
  await nextTick()
  loadMoreObserver?.disconnect()
  if (!loadMoreSentinel.value || typeof IntersectionObserver === 'undefined') return

  const scrollRoot = loadMoreSentinel.value.closest<HTMLElement>('.mobile-scroll-container')
  loadMoreObserver = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        void onLoad()
      }
    },
    {
      root: scrollRoot,
      rootMargin: '0px 0px 100px 0px',
    },
  )
  loadMoreObserver.observe(loadMoreSentinel.value)
}

function resetAllFeed() {
  allCommunityTweets.value = []
  communityTrades.value = []
  allPostFinished.value = false
  allTradeFinished.value = false
  allPostPage = 0
  allTradePage = 0
  finished.value[ListType.All] = false
  nextPage.value[ListType.All] = 0
  closeFeedSheets()
}

watch(() => comStore.currentSelectedCommunity?.tick, tick => {
  if (!tick || tick === activeCommunityTick) return
  activeCommunityTick = tick
  resetAllFeed()
  void onRefresh()
})

onMounted(async () => {
  while (!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.5);
  }
  activeCommunityTick = comStore.currentSelectedCommunity.tick
  await onRefresh();
  await observeLoadMoreSentinel()
  emitter.on('tweeted', onRefresh);
  emitter.on('login', onRefresh);
  emitter.on('mainTabNavigate', closeFeedSheets)
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect()
  emitter.off('tweeted', onRefresh)
  emitter.off('login', onRefresh)
  emitter.off('mainTabNavigate', closeFeedSheets)
})
</script>

<template>
  <div class="flex items-center gap-1.5 mb-2 min-w-0">
    <div class="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto no-scroll-bar pr-1">
      <button class="feed-filter-chip" :class="listType === ListType.All ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.All; onRefresh()">
        <img class="feed-filter-chip__icon" :src="externalSourceLogos.X" alt="">
        <span>All</span>
      </button>
      <button class="feed-filter-chip" :class="listType === ListType.Fomo ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Fomo; onRefresh()">
        <img class="feed-filter-chip__icon" :src="externalSourceLogos.FOMO" alt="">
        <span>FOMO</span>
      </button>
      <button class="feed-filter-chip" :class="listType === ListType.Gmgn ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Gmgn; onRefresh()">
        <img class="feed-filter-chip__icon" :src="externalSourceLogos.GMGN" alt="">
        <span>GMGN</span>
      </button>
      <button class="feed-filter-chip" :class="listType === ListType.Pump ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Pump; onRefresh()">
        <img class="feed-filter-chip__icon" :src="externalSourceLogos.PUMP" alt="">
        <span>Pump</span>
      </button>
      <button class="feed-filter-chip" :class="(listType === ListType.Tipped) ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Tipped; onRefresh()">
        {{ $t('Tipped') }}
      </button>
      <button class="feed-filter-chip" :class="(listType === ListType.Space) ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Space; onRefresh()">
        {{ $t('Space') }}
      </button>
    </div>
  </div>
  <div class="flex-1">
    <van-pull-refresh class="h-full min-h-full"
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished[listType]"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
      >
        <div v-for="item of feedItems" :key="item.type === 'post' ? item.tweet.tweetId : tradeIdentity(item.trade)" class="mb-2">
          <FeedTradeActivity
            v-if="item.type === 'trade'"
            :trade="item.trade"
            @open-details="openFeedTokenSheet"
          />
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
        <div ref="loadMoreSentinel" class="h-px" aria-hidden="true"></div>
      </van-list>
    </van-pull-refresh>
  </div>
  <FeedTokenDetailSheet v-model="showFeedTokenSheet" :asset="selectedFeedToken" @buy="openBuy" />
  <FeedTokenTradeSheet v-model="showFeedTradeSheet" :asset="selectedFeedToken" />
</template>

<style scoped>
.feed-filter-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  height: 2rem;
  padding: 0 0.625rem;
  border-radius: 9999px;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0;
}

.feed-filter-chip__icon {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  border-radius: 9999px;
  object-fit: contain;
}

.feed-filter-select {
  width: 5.25rem;
  height: 2rem;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.feed-filter-select :deep(.el-select__wrapper) {
  min-height: 2rem;
  padding: 0 0.625rem;
  box-shadow: none;
}

.feed-filter-select :deep(.el-select__selected-item) {
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

@media (min-width: 804px) {
  .feed-filter-chip {
    gap: 0.375rem;
    padding: 0 0.75rem;
    font-size: 16px;
    line-height: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .feed-filter-select {
    width: 6.25rem;
    height: 2.5rem;
    font-size: 16px;
    line-height: 20px;
    font-weight: 700;
  }

  .feed-filter-select :deep(.el-select__wrapper) {
    min-height: 2.5rem;
    padding: 0 0.75rem;
  }

  .feed-filter-select :deep(.el-select__selected-item) {
    font-size: 16px;
    line-height: 20px;
    font-weight: 700;
  }
}
</style>
