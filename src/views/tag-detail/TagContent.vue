<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets, getCommunitySpaceTweets, getCommunityTrendingTweets, getCommunityTippedTweets, getCommunityCallouts, type ExternalCalloutSource } from "@/apis/api";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { FeedTokenSheetAsset, Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import FeedTokenDetailSheet from '@/components/feed/FeedTokenDetailSheet.vue'
import FeedTokenTradeSheet from '@/components/feed/FeedTokenTradeSheet.vue'
import { externalSourceLogos } from '@/assets/externalSourceLogos'

enum ListType {
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
const listType = ref<ListType>(ListType.New)
const nextPage = ref<Record<ListType, number>>({
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

const calloutTypes = new Set<ListType>([ListType.Gmgn, ListType.Fomo, ListType.Pump])
const calloutSource = (type: ListType): ExternalCalloutSource => type as ExternalCalloutSource
const calloutStoreKey = (tick: string, source: ExternalCalloutSource) => `${tick}:${source}`

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
      if (listType.value === ListType.New &&
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

async function onRefresh() {
  const activeListType = listType.value
  try {
    refreshing.value = true;
    finished.value[activeListType] = false;
    nextPage.value[activeListType] = 0
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    if (activeListType === ListType.New) {
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

    const receivedCount = Array.isArray(list) ? list.length : 0
    nextPage.value[activeListType] = receivedCount > 0 ? 1 : 0
    finished.value[activeListType] = receivedCount < PAGE_SIZE
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  const activeListType = listType.value
  try{
    if (loading.value || refreshing.value || finished.value[activeListType] || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    const page = nextPage.value[activeListType]
    if (activeListType === ListType.New) {
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
    const receivedCount = Array.isArray(list) ? list.length : 0
    nextPage.value[activeListType] = page + 1
    finished.value[activeListType] = receivedCount < PAGE_SIZE
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

onMounted(async () => {
  while (!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.5);
  }
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
      <button class="feed-filter-chip" :class="(listType === ListType.New || listType === ListType.Trending) ? 'bg-gradient-primary text-white' : 'bg-grey-light-active text-white'"
        @click="listType = ListType.Trending; onRefresh()">
        {{ $t('Tweets') }}
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
    <div class="flex-none">
      <el-select
        v-if="listType === ListType.Trending || listType === ListType.New"
        v-model="listType"
        class="feed-filter-select bg-white rounded-full overflow-hidden c-select flex items-center text-black"
        popper-class="c-select-popper rounded-xl"
        :disabled="refreshing || loading"
        @change="onRefresh"
      >
        <el-option :value="ListType.Trending" :label="$t('trending')" />
        <el-option :value="ListType.New" :label="$t('new')" />
      </el-select>
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
        <div v-for="tweet of showingTweets" :key="tweet.tweetId" class="mb-2">
          <SpaceItem
            v-if="tweet.spaceId"
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @open-token-details="openFeedTokenSheet"
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
            @open-token-details="openFeedTokenSheet"
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
