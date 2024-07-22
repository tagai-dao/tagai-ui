<script setup lang="ts">
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import { testTweets } from "@/assets/test-data";
import { useTweetsStore } from "@/stores/tweets";
import { useAccountStore } from "@/stores/web3";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets } from "@/apis/api";
import { computed, onMounted, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { Tweet } from "@/types";
import { handleErrorTip } from "@/utils/notify";

const tweetsStore = useTweetsStore();
const accStore = useAccountStore();
const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);
const comStore = useCommunityStore();

const showingTweets = computed(() => {
  if (
    comStore.currentSelectedCommunity?.tick &&
    tweetsStore &&
    tweetsStore.communityTweets
  ) {
    return tweetsStore.communityTweets[comStore.currentSelectedCommunity.tick] as Tweet[];
  }
  return [] as Tweet[];
});

async function onRefresh() {
  try {
    if (refreshing.value) return;
    finished.value = false;
    refreshing.value = true;
    let list: any = await getCommunityNewTweets(
      comStore.currentSelectedCommunity!.tick,
      accStore.getAccountInfo?.twitterId
    );
    if (!tweetsStore.communityTweets) {
      tweetsStore.communityTweets = {};
    }
    tweetsStore.communityTweets[
      comStore.currentSelectedCommunity!.tick
    ] = list as Tweet[];
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
    if (refreshing.value || finished.value || loading.value || showingTweets.value.length === 0) {
      return;
    }
    loading.value = true
    let list: any = await getCommunityNewTweets(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo.twitterId, Math.floor((showingTweets.value.length - 1) / 30) + 1)
    tweetsStore.communityTweets![
      comStore.currentSelectedCommunity!.tick
    ] = showingTweets.value.concat(list as Tweet[])
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
});
</script>

<template>
  <div>
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      loading-text="Loading"
      pulling-text="Pull to refresh data"
      loosing-text="Release to refresh"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        finished-text="No more"
        :offset="50"
        @load="onLoad"
      >
        <div v-for="(tweet, index) of showingTweets" :key="index" class="mb-2">
          <SpaceItem
            v-if="tweet.spaceId"
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @click.stop="$router.push(`/space-detail/${tweet.spaceId}`)"
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
            @click.stop="$router.push(`/post-detail/${tweet.tweetId}`)"
          >
            <template #tweet-action-bar>
              <PostButtonGroup
                @click.stop
                :tweet="tweet"
              />
            </template>

            <template #tweet-trade v-if="tweet.commerceId">
             <CommerceBtn></CommerceBtn>
            </template>
          </TweetItem>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
