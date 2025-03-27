<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityTippedTweets } from "@/apis/api";
import { computed, onMounted, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfoOfTweets } from "@/utils/pump";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";

const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const comStore = useCommunityStore();
const curationStore = useCurationStore()

const showingTweets = computed(() => {
  if (
    comStore.currentSelectedCommunity?.tick &&
    tweetsStore &&
    tweetsStore.communityTippedTweets
  ) {
    return tweetsStore.communityTippedTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
  }
  return [] as Tweet[];
});

async function onRefresh() {
  try {
    finished.value = false;
    refreshing.value = true;
    let list: any = await getCommunityTippedTweets(
      comStore.currentSelectedCommunity!.tick,
      accStore.getAccountInfo?.twitterId
    );

    if (!tweetsStore.communityTippedTweets) {
      tweetsStore.communityTippedTweets = {};
    }
    tweetsStore.communityTippedTweets[
      comStore.currentSelectedCommunity!.tick
    ] = list as Tweet[];
    console.log(tweetsStore.communityTippedTweets[
      comStore.currentSelectedCommunity!.tick
    ])
    tweetsStore.communityTippedTweets[
      comStore.currentSelectedCommunity!.tick
    ] = await getTokenInfoOfTweets(tweetsStore.communityTippedTweets[
      comStore.currentSelectedCommunity!.tick
    ])
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

async function onLoad() {
  try{
    if (refreshing.value || finished.value || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    let list: any = await getCommunityTippedTweets(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, Math.floor((showingTweets.value.length - 1) / 30) + 1)
    tweetsStore.communityTippedTweets![
      comStore.currentSelectedCommunity!.tick
    ] = showingTweets.value.concat(list as Tweet[])
    tweetsStore.communityTippedTweets![
      comStore.currentSelectedCommunity!.tick
    ] = await getTokenInfoOfTweets(tweetsStore.communityTippedTweets![
      comStore.currentSelectedCommunity!.tick
    ])
    if (list.length < 30) {
      finished.value = true
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
        :finished="finished"
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
