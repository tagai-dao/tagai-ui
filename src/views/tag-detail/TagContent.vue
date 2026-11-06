<script setup lang="ts">
import PageDataStatus from '@/components/common/PageDataStatus.vue'
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets, getCommunitySpaceTweets, getCommunityTrendingTweets, getCommunityTippedTweets, getCommunityCallouts, getTokenTradeList, getEventMarketMetrics, type ExternalCalloutSource } from "@/apis/api";
import { attachEventMarketMetrics } from '@/utils/eventMarketMetrics'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useCommunityStore } from "@/stores/community";
import type { FeedTokenSheetAsset, FeedTrade, Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets as enrichTweetTokens } from "@/utils/pump";

async function getTokenInfoOfTweets(rows: Tweet[]) {
  try { return await enrichTweetTokens(rows, true) }
  catch (error) {
    console.warn('[TagContent] optional token metrics unavailable', error)
    return rows
  }
}
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import FeedTokenTradeSheet from '@/components/feed/FeedTokenTradeSheet.vue'
import FeedTradeActivity from '@/components/feed/FeedTradeActivity.vue'
import { externalSourceLogos } from '@/assets/externalSourceLogos'
import { useChainStore } from '@/stores/chain'
import { readPublicSnapshot, writePublicSnapshot } from '@/utils/publicSnapshot'
import { feedPageBoundary, mergeCommunityFeed, needsFeedPage } from '@/utils/communityFeed'

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
const pullRefreshing = ref(false);
const loading = ref(false);
const loadFailed = ref(false);
const usingSnapshot = ref(false)
const tradesLoading = ref(false);
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
const chainStore = useChainStore()
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
const showFeedTradeSheet = ref(false)
const allCommunityTweets = ref<Tweet[]>([])
const communityTrades = ref<FeedTrade[]>([])
const allPostFinished = ref(false)
const allTradeFinished = ref(false)
const allPostBoundary = ref(0)
const allTradeBoundary = ref(0)
let allPostFailed = false
let allTradeFailed = false
let allPostPage = 0
let allTradePage = 0
let refreshSequence = 0

const calloutTypes = new Set<ListType>([ListType.Gmgn, ListType.Fomo, ListType.Pump])
const calloutSource = (type: ListType): ExternalCalloutSource => type as ExternalCalloutSource
const calloutStoreKey = (tick: string, source: ExternalCalloutSource) => `${tick}:${source}`
const communitySnapshotScope = (tick: string, type: ListType) =>
  `${chainStore.activeChainId}:community:${tick.toLowerCase()}:feed:${type}`
const communityTradeSnapshotScope = (tick: string) =>
  `${chainStore.activeChainId}:community:${tick.toLowerCase()}:account-trades-v1`

function publicTweets(rows: Tweet[]) {
  return rows.slice(0, 120).map(row => {
    const tweet = { ...row } as Partial<Tweet> & Record<string, unknown>
    for (const field of ['liked', 'retweeted', 'replied', 'quoted', 'curated', 'accessToken', 'expiresAt', 'authLike', 'authPost', 'lastReadMessageTime']) {
      delete tweet[field]
    }
    return tweet as Tweet
  })
}

function assignCommunityTweets(type: ListType, tick: string, rows: Tweet[]) {
  if (type === ListType.All) {
    allCommunityTweets.value = rows
  } else if (type === ListType.New) {
    if (!tweetsStore.communityTweets) tweetsStore.communityTweets = {}
    tweetsStore.communityTweets[tick] = rows
  } else if (type === ListType.Trending) {
    if (!tweetsStore.communityTrendingTweets) tweetsStore.communityTrendingTweets = {}
    tweetsStore.communityTrendingTweets[tick] = rows
  } else if (type === ListType.Space) {
    if (!tweetsStore.communitySpaceTweets) tweetsStore.communitySpaceTweets = {}
    tweetsStore.communitySpaceTweets[tick] = rows
  } else if (type === ListType.Tipped) {
    if (!tweetsStore.communityTippedTweets) tweetsStore.communityTippedTweets = {}
    tweetsStore.communityTippedTweets[tick] = rows
  } else if (calloutTypes.has(type)) {
    if (!tweetsStore.communityCalloutTweets) tweetsStore.communityCalloutTweets = {}
    tweetsStore.communityCalloutTweets[calloutStoreKey(tick, calloutSource(type))] = rows
  }
}

function saveCommunitySnapshot(type: ListType, tick: string, rows: Tweet[]) {
  if (rows.length) writePublicSnapshot(communitySnapshotScope(tick, type), publicTweets(rows))
}

function restoreCommunitySnapshot(type: ListType, tick: string) {
  const rows = readPublicSnapshot<Tweet[]>(communitySnapshotScope(tick, type))
  if (!rows?.length) return false
  assignCommunityTweets(type, tick, rows)
  if (type === ListType.All) {
    communityTrades.value = readPublicSnapshot<FeedTrade[]>(communityTradeSnapshotScope(tick)) ?? []
  }
  usingSnapshot.value = true
  return true
}

function tradeIdentity(trade: FeedTrade) {
  if (trade.curationSourceId) return `${trade.token.toLowerCase()}:${trade.curationSourceId}`
  const hash = trade.transHash?.trim().toLowerCase()
  if (hash) return `hash:${hash}:${trade.token.toLowerCase()}:${trade.logIndex ?? ''}`
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

function openFeedTradeSheet(asset: FeedTokenSheetAsset) {
  selectedFeedToken.value = asset
  showFeedTradeSheet.value = true
}

function closeFeedSheets() {
  showFeedTradeSheet.value = false
  selectedFeedToken.value = null
}

const showingTweets = computed(() => {
  if (comStore.currentSelectedCommunity?.tick &&
    tweetsStore) {
      if (listType.value === ListType.All) {
        return allCommunityTweets.value
      }else if (listType.value === ListType.New &&
      tweetsStore.communityTweets) {
        return tweetsStore.communityTweets[comStore.currentSelectedCommunity.tick] ?? [];
      }else if (listType.value === ListType.Space &&
      tweetsStore.communitySpaceTweets) {
        return tweetsStore.communitySpaceTweets[comStore.currentSelectedCommunity.tick] ?? [];
      }else if (listType.value === ListType.Tipped &&
      tweetsStore.communityTippedTweets) {
        return tweetsStore.communityTippedTweets[comStore.currentSelectedCommunity.tick] ?? [];
      }else if (listType.value === ListType.Trending &&
      tweetsStore.communityTrendingTweets) {
        return tweetsStore.communityTrendingTweets[comStore.currentSelectedCommunity.tick] ?? [];
      }else if (calloutTypes.has(listType.value) && tweetsStore.communityCalloutTweets) {
        return tweetsStore.communityCalloutTweets[
          calloutStoreKey(comStore.currentSelectedCommunity.tick, calloutSource(listType.value))
        ] ?? [];
      }
    }
  return [] as Tweet[];
});

const feedItems = computed(() => {
  const posts = showingTweets.value.map(tweet => ({ type: 'post' as const, tweet }))
  if (listType.value !== ListType.All) return posts
  return mergeCommunityFeed(showingTweets.value, communityTrades.value, Math.max(allPostBoundary.value, allTradeBoundary.value))
})

async function loadAllFeedPage(replace: boolean, isCurrent: () => boolean) {
  const community = comStore.currentSelectedCommunity!
  const chainId = chainStore.activeChainId
  const tick = community.tick
  const loadPosts = replace || allPostFailed || (!allTradeFailed && needsFeedPage(allPostBoundary.value, allPostFinished.value, allTradeBoundary.value, allTradeFinished.value))
  const loadTrades = replace || allTradeFailed || (!allPostFailed && needsFeedPage(allTradeBoundary.value, allTradeFinished.value, allPostBoundary.value, allPostFinished.value))
  tradesLoading.value = loadTrades
  // Wait for both first pages before publishing either source. Later requests
  // advance only the source limiting the visible chronological window.
  const [posts, trades] = await Promise.allSettled([
    loadPosts ? getCommunityNewTweets(tick, accStore.getAccountInfo?.twitterId, replace ? 0 : allPostPage) : Promise.resolve(null),
    // Issued tokens retain their inner/outer market history in the same table.
    // Filter account membership BEFORE pagination so public DEX traders cannot
    // displace every platform activity from the first page after graduation.
    loadTrades && community.token ? getTokenTradeList(community.token, replace ? 0 : allTradePage, !community.isImport) : Promise.resolve(loadTrades ? [] : null),
  ])
  if (!isCurrent()) return
  tradesLoading.value = false
  if (posts.status === 'fulfilled' && posts.value !== null) {
    allPostFailed = false
    const rawRows = (posts.value || []) as Tweet[]
    const rows = mergeUniqueTweets([], rawRows)
    allCommunityTweets.value = mergeUniqueTweets(replace ? [] : allCommunityTweets.value, rows)
    allPostPage = replace ? 1 : allPostPage + 1
    allPostFinished.value = rawRows.length < PAGE_SIZE
    allPostBoundary.value = allPostFinished.value ? 0 : feedPageBoundary(rows.map(row => row.tweetTime))
    const currentRows = allCommunityTweets.value
    void getTokenInfoOfTweets(rows).then(enriched => {
      if (!isCurrent() || allCommunityTweets.value !== currentRows) return
      allCommunityTweets.value = mergeUniqueTweets(currentRows, enriched)
      saveCommunitySnapshot(ListType.All, tick, allCommunityTweets.value)
    })
  }
  if (trades.status === 'fulfilled' && trades.value !== null) {
    allTradeFailed = false
    const rows = (trades.value || []) as FeedTrade[]
    // The token trade endpoint also serves full market history. Community
    // Feed includes only identities verified by the API (including imports).
    // Keep the raw row count below for pagination: a filtered page is not EOF.
    const next = rows.filter(row => row.isPlatformAccount === true).map(row => ({
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
    allTradePage = replace ? 1 : allTradePage + 1
    allTradeFinished.value = rows.length < PAGE_SIZE
    allTradeBoundary.value = allTradeFinished.value ? 0 : feedPageBoundary(rows.map(row => row.timestamp))
    if (communityTrades.value.length) {
      writePublicSnapshot(communityTradeSnapshotScope(community.tick), communityTrades.value.slice(0, 120))
    }
    void attachEventMarketMetrics(next, chainId, getEventMarketMetrics).then(enriched => {
      if (!isCurrent()) return
      const byEvent = new Map(enriched.map(row => [tradeIdentity(row), row]))
      communityTrades.value = communityTrades.value.map(row => byEvent.get(tradeIdentity(row)) ?? row)
      writePublicSnapshot(communityTradeSnapshotScope(community.tick), communityTrades.value.slice(0, 120))
    }).catch(error => console.warn('[TagContent] optional event metrics unavailable', error))
  }
  // A failed source keeps its cursor and buffered rows. Pause automatic loading
  // until an explicit retry instead of repeatedly reading the same page.
  if (posts.status === 'rejected' || trades.status === 'rejected') {
    allPostFailed = posts.status === 'rejected'
    allTradeFailed = trades.status === 'rejected'
    if (replace) {
      if (posts.status === 'rejected') allPostBoundary.value = 0
      if (trades.status === 'rejected') allTradeBoundary.value = 0
    }
    throw posts.status === 'rejected' ? posts.reason : trades.status === 'rejected' ? trades.reason : new Error('Feed unavailable')
  }
  finished.value[ListType.All] = allPostFinished.value && allTradeFinished.value
}

function requestPostPage(type: ListType, tick: string, page: number) {
  const twitterId = accStore.getAccountInfo?.twitterId
  if (type === ListType.Trending) return getCommunityTrendingTweets(tick, twitterId, page)
  if (type === ListType.Space) return getCommunitySpaceTweets(tick, twitterId, page)
  if (type === ListType.Tipped) return getCommunityTippedTweets(tick, twitterId, page)
  if (calloutTypes.has(type)) return getCommunityCallouts(tick, calloutSource(type), twitterId, page)
  return getCommunityNewTweets(tick, twitterId, page)
}

function currentRequest(sequence: number, chainId: number, tick: string, token: string | undefined, type: ListType) {
  return sequence === refreshSequence && chainId === chainStore.activeChainId &&
    tick === comStore.currentSelectedCommunity?.tick && token === comStore.currentSelectedCommunity?.token && type === listType.value
}

async function onPullRefresh() {
  try {
    await onRefresh()
  } finally {
    pullRefreshing.value = false
  }
}

async function onRefresh() {
  const sequence = ++refreshSequence
  loading.value = false
  tradesLoading.value = false
  loadFailed.value = false
  const activeListType = listType.value
  const tick = comStore.currentSelectedCommunity?.tick
  if (!tick) {
    refreshing.value = false
    return
  }
  const token = comStore.currentSelectedCommunity?.token
  const chainId = chainStore.activeChainId
  const isCurrent = () => currentRequest(sequence, chainId, tick, token, activeListType)
  try {
    refreshing.value = true;
    finished.value[activeListType] = false;
    nextPage.value[activeListType] = 0
    if (activeListType === ListType.All) {
      await loadAllFeedPage(true, isCurrent)
    } else {
      const list = await requestPostPage(activeListType, tick, 0) as Tweet[]
      if (!isCurrent()) return
      const rows = await getTokenInfoOfTweets(mergeUniqueTweets([], list))
      if (!isCurrent()) return
      assignCommunityTweets(activeListType, tick, rows)
      nextPage.value[activeListType] = 1
      finished.value[activeListType] = list.length < PAGE_SIZE
    }
    if (!isCurrent()) return
    saveCommunitySnapshot(activeListType, tick, showingTweets.value)
    usingSnapshot.value = false
  } catch (e) {
    if (!isCurrent()) return
    const retained = feedItems.value.length > 0 || restoreCommunitySnapshot(activeListType, tick)
    usingSnapshot.value = retained
    loadFailed.value = true
    if (!retained) handleErrorTip(e)
  } finally {
    if (isCurrent()) {
      refreshing.value = false
      tradesLoading.value = false
    }
  }
}

async function onLoad() {
  const activeListType = listType.value
  const sequence = refreshSequence
  const tick = comStore.currentSelectedCommunity?.tick
  if (!tick) return
  const token = comStore.currentSelectedCommunity?.token
  const chainId = chainStore.activeChainId
  const isCurrent = () => currentRequest(sequence, chainId, tick, token, activeListType)
  if (loadFailed.value || tradesLoading.value || loading.value || refreshing.value || finished.value[activeListType]) return
  try{
    loading.value = true
    const page = nextPage.value[activeListType]
    if (activeListType === ListType.All) {
      await loadAllFeedPage(false, isCurrent)
    } else {
      const list = await requestPostPage(activeListType, tick, page) as Tweet[]
      if (!isCurrent()) return
      const rows = await getTokenInfoOfTweets(list)
      if (!isCurrent()) return
      assignCommunityTweets(activeListType, tick, mergeUniqueTweets(showingTweets.value, rows))
      nextPage.value[activeListType] = page + 1
      finished.value[activeListType] = list.length < PAGE_SIZE
    }
    if (!isCurrent()) return
    saveCommunitySnapshot(activeListType, tick, showingTweets.value)
  } catch (e) {
    if (!isCurrent()) return
    usingSnapshot.value = feedItems.value.length > 0
    loadFailed.value = true
    if (!usingSnapshot.value) handleErrorTip(e)
  } finally {
    if (isCurrent()) {
      loading.value = false
      tradesLoading.value = false
    }
  }
}

function retryLoadMore() {
  loadFailed.value = false
  void onLoad()
}

function onBackgroundUpdated() {
  if (refreshing.value || loading.value) return
  // A delayed first-page SWR result must not reset a reader's paginated feed.
  if (listType.value === ListType.All ? allPostPage > 1 || allTradePage > 1 : nextPage.value[listType.value] > 1) return
  void onRefresh()
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
  allPostBoundary.value = 0
  allTradeBoundary.value = 0
  allPostFailed = false
  allTradeFailed = false
  allPostPage = 0
  allTradePage = 0
  finished.value[ListType.All] = false
  nextPage.value[ListType.All] = 0
  closeFeedSheets()
}

watch(() => [chainStore.activeChainId, comStore.currentSelectedCommunity?.tick, comStore.currentSelectedCommunity?.token], () => {
  refreshSequence++
  resetAllFeed()
  void onRefresh()
}, { immediate: true })

onMounted(async () => {
  await observeLoadMoreSentinel()
  emitter.on('tweeted', onRefresh);
  emitter.on('login', onRefresh);
  emitter.on('mainTabNavigate', closeFeedSheets)
});

onBeforeUnmount(() => {
  refreshSequence++
  loadMoreObserver?.disconnect()
  emitter.off('tweeted', onRefresh)
  emitter.off('login', onRefresh)
  emitter.off('mainTabNavigate', closeFeedSheets)
})
</script>

<template>
  <PageDataStatus :paths="['/curation/community']" :scope="comStore.currentSelectedCommunity?.tick" @retry="onRefresh" @updated="onBackgroundUpdated" />
  <PageDataStatus v-if="listType === ListType.All" :paths="['/community/tradeList']" :scope="comStore.currentSelectedCommunity?.token" @retry="onRefresh" @updated="onBackgroundUpdated" />
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
      v-model="pullRefreshing"
      @refresh="onPullRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading || refreshing"
        :error="loadFailed"
        :error-text="$t('network.retry')"
        @update:error="retryLoadMore"
        @load="onLoad"
        :finished="finished[listType]"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
      >
        <div v-for="item of feedItems" :key="item.type === 'post' ? `post:${item.tweet.tweetId}` : `trade:${tradeIdentity(item.trade)}`" class="mb-2">
          <FeedTradeActivity
            v-if="item.type === 'trade'"
            :trade="item.trade"
            @open-details="openFeedTradeSheet"
          />
          <SpaceItem
            historical-metrics
            v-else-if="item.tweet.spaceId"
            class="bg-white rounded-2xl"
            :tweet="item.tweet"
            @open-token-details="openFeedTradeSheet"
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
            historical-metrics
            v-else
            hide-community-hashtag
            class="bg-white rounded-2xl"
            :tweet="item.tweet"
            @open-token-details="openFeedTradeSheet"
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
