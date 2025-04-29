<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets, getCommunitySpaceTweets, getCommunityTrendingTweets, getCommunityTippedTweets } from "@/apis/api";
import { computed, onMounted, ref, watch } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";

enum ListType {
  // Trending = 'trending',
  New = 'new',
  Space = 'space',
  Tipped = 'tipped'
}
const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref({
  'new': false,
  'space': false,
  // 'trending': false,
  'tipped': false
});
const comStore = useCommunityStore();
const curationStore = useCurationStore()
const listType = ref<ListType>(ListType.New)

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
      }
    }
  return [] as Tweet[];
});

async function onRefresh() {
  try {
    refreshing.value = true;
    finished.value[listType.value as ListType] = false;
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    if (listType.value === ListType.New) {
      list = await getCommunityNewTweets(tick, twitterId);

      if (!tweetsStore.communityTweets) {
        tweetsStore.communityTweets = {};
      }
      tweetsStore.communityTweets[
        tick
      ] = list as Tweet[];
      tweetsStore.communityTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communityTweets[tick])
    } else if (listType.value === ListType.Space) {
      list = await getCommunitySpaceTweets(tick, twitterId)

      if (!tweetsStore.communitySpaceTweets) {
        tweetsStore.communitySpaceTweets = {};
      }
      tweetsStore.communitySpaceTweets[tick] = list as Tweet[];
      tweetsStore.communitySpaceTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communitySpaceTweets[tick])
    } else if (listType.value === ListType.Tipped) {
      list = await getCommunityTippedTweets(tick, twitterId)

      if (!tweetsStore.communityTippedTweets) {
        tweetsStore.communityTippedTweets = {};
      }
      tweetsStore.communityTippedTweets[tick] = list as Tweet[];
      tweetsStore.communityTippedTweets[tick] = await getTokenInfoOfTweets(tweetsStore.communityTippedTweets[tick])
    }

    if (list.length < 30) {
      finished.value[listType.value as ListType] = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  try{
    if (refreshing.value || finished.value[listType.value as ListType] || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    let list: any;
    const tick = comStore.currentSelectedCommunity!.tick;
    const twitterId = accStore.getAccountInfo?.twitterId;
    const page = Math.floor((showingTweets.value.length - 1) / 30) + 1;
    if (listType.value === ListType.New) {
      list = await getCommunityNewTweets(tick, twitterId, page)
      tweetsStore.communityTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communityTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communityTweets![
        tick
      ])
    } else if (listType.value === ListType.Space) {
      list = await getCommunitySpaceTweets(tick, twitterId, page)
      tweetsStore.communitySpaceTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communitySpaceTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communitySpaceTweets![
        tick
      ])
    } else if (listType.value === ListType.Tipped) {
      list = await getCommunityTippedTweets(tick, twitterId, page)
      tweetsStore.communityTippedTweets![
        tick
      ] = showingTweets.value.concat(list as Tweet[])
      tweetsStore.communityTrendingTweets![
        tick
      ] = await getTokenInfoOfTweets(tweetsStore.communityTrendingTweets![
        tick
      ])
    }
    if (list && list.length < 30) {
      finished.value[listType.value as ListType] = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  while (!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.5);
  }
  onRefresh();
  emitter.on('tweeted', onRefresh);
});
</script>

<template>
  <div class="flex justify-end mr-2 mb-2">
    <el-select
        v-model="listType"
        class="bg-white rounded-full overflow-hidden max-w-[100px] c-select h-10 flex items-center text-h3 text-black"
        popper-class="c-select-popper rounded-xl"
        :disabled="refreshing || loading"
        @change="onRefresh"
      >
        <el-option :value="ListType.New" :label="$t('new')" />
        <el-option :value="ListType.Tipped" :label="$t('Tipped')" />
        <el-option :value="ListType.Space" :label="$t('Space')" />
      </el-select>
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
</template>

<style scoped></style>
