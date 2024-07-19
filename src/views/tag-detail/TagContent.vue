<script setup lang="ts">

import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import {testTweets} from "@/assets/test-data";
import {useTweetsStore} from "@/stores/tweets";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { getCommunityNewTweets } from "@/apis/api";
import { computed, onMounted, ref } from "vue";
import { useCommunityStore } from "@/stores/community";
import { sleep } from "@/utils/helper";
import type { Tweet } from "@/types";

const tweetsStore = useTweetsStore()
const refreshing = ref(false)
const loading = ref(false)
const comStore = useCommunityStore()

const showingTweets = computed(() => {
  if (comStore.currentSelectedCommunity?.tick && tweetsStore && tweetsStore.communityTweets) {
    return tweetsStore.communityTweets[comStore.currentSelectedCommunity.tick] as Tweet[]
  }
  return [] as Tweet[]
})

function newLike(tweetId: string) {

}

function newComment(tweetId: string, commentId: string, text: string) {

}

async function refresh() {
  try{
    if (refreshing.value) return;
    refreshing.value = true
    const list = await getCommunityNewTweets(comStore.currentSelectedCommunity!.tick)
    console.log(545, list)
    if (!tweetsStore.communityTweets){
      tweetsStore.communityTweets = {}
    }
    tweetsStore.communityTweets[comStore.currentSelectedCommunity!.tick] = list as Tweet[]
  } catch (e) {
    
  } finally {
    refreshing.value = false
  }
}

async function loadmore() {

}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.5)
  }
  refresh()
})

</script>

<template>
  <div>
    <div v-for="(tweet, index) of showingTweets" :key="index" class="mb-2">
      <SpaceItem v-if="tweet.spaceId" class="bg-white rounded-2xl" :tweet="tweet"
                 @click.stop="$router.push(`/space-detail/${tweet.spaceId}`)">
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop @newLike="newLike" @newComment="newComment" :tweet="tweet"/>
        </template>
      </SpaceItem>
      <TweetItem v-else class="bg-white rounded-2xl" :tweet="tweet"
                 @click.stop="$router.push(`/post-detail/${tweet.tweetId}`)">
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop @newLike="newLike" @newComment="newComment" :tweet="tweet"/>
        </template>
      </TweetItem>
    </div>
  </div>
</template>

<style scoped>

</style>
