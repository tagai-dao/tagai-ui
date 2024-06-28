<script setup lang="ts">

import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import {testTweets} from "@/assets/test-data";
import {useTweetsStore} from "@/stores/tweets";
import SpaceItem from "@/components/tweets/SpaceItem.vue";

const tweetsStore = useTweetsStore()
function newLike(tweetId: string) {

}

function newComment(tweetId: string, commentId: string, text: string) {

}

</script>

<template>
  <div>
    <div v-for="(tweet, index) of testTweets" :key="index" class="mb-2">
      <SpaceItem v-if="tweet.spaceId" class="bg-white rounded-2xl" :tweet="tweet"
                 @click.stop="$router.push(`/space-detail/${tweet.spaceId}`)">
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop @newLike="newLike" @newComment="newComment" :post="tweet"/>
        </template>
      </SpaceItem>
      <TweetItem v-else class="bg-white rounded-2xl" :tweet="tweet"
                 @click.stop="$router.push(`/post-detail/${tweet.postId}`)">
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop @newLike="newLike" @newComment="newComment" :post="tweet"/>
        </template>
      </TweetItem>
    </div>
  </div>
</template>

<style scoped>

</style>
