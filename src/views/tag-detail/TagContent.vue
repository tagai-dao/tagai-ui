<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets, getCommunitySpaceTweets, getCommunityTrendingTweets, getCommunityTippedTweets } from "@/apis/api";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";

enum ListType {
  Trending = 'trending',
  New = 'new',
  Space = 'space',
  Tipped = 'tipped'
}
const PAGE_SIZE = 30
const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref({
  'new': false,
  'space': false,
  'trending': false,
  'tipped': false
});
const comStore = useCommunityStore();
const curationStore = useCurationStore()
const listType = ref<ListType>(ListType.New)
const nextPage = ref<Record<ListType, number>>({
  [ListType.New]: 0,
  [ListType.Space]: 0,
  [ListType.Trending]: 0,
  [ListType.Tipped]: 0,
})
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

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
});

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect()
  emitter.off('tweeted', onRefresh)
  emitter.off('login', onRefresh)
})
</script>

<template>
  <div class="flex justify-between mb-2">
    <div class="flex items-center justify-between gap-2 ">
      <button class="text-h3 text-black h-8 rounded-full px-3 text-white" :class="(listType === ListType.New || listType === ListType.Trending) ? 'bg-gradient-primary' : 'bg-grey-light-active'"
        @click="listType = ListType.Trending; onRefresh()">
        {{ $t('Tweets') }}
      </button>
      <button class="text-h3 text-black h-8 rounded-full px-3 text-white" :class="(listType === ListType.Tipped) ? 'bg-gradient-primary' : 'bg-grey-light-active'"
        @click="listType = ListType.Tipped; onRefresh()">
        {{ $t('Tipped') }}
      </button>
      <button class="text-h3 text-black h-8 rounded-full px-3 text-white" :class="(listType === ListType.Space) ? 'bg-gradient-primary' : 'bg-grey-light-active'"
        @click="listType = ListType.Space; onRefresh()">
        {{ $t('Space') }}
      </button>
    </div>
    <div>
      <el-select
        v-if="listType === ListType.Trending || listType === ListType.New"
        v-model="listType"
        class="bg-white rounded-full overflow-hidden max-w-[100px] min-w-[100px] c-select h-10 flex items-center text-h3 text-black"
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
        <div ref="loadMoreSentinel" class="h-px" aria-hidden="true"></div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
