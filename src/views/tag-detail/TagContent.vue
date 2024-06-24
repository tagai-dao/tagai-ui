<script setup lang="ts">

import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import {testTweets} from "@/assets/test-data";
import {useTweetsStore} from "@/stores/tweets";

const tweetsStore = useTweetsStore()
function newLike(tweetId: string) {

}

function newComment(tweetId: string, commentId: string, text: string) {

}

</script>

<template>
  <div>
    <div v-for="(tweet, index) of testTweets" :key="index" class="mb-2">
      <TweetItem class="bg-white rounded-2xl" :tweet="tweet">
        <!--        <template #tweet-mint>-->
        <!--          <TweetMint @click.stop :goods="tweet.goods" :tweet-id="tweet.tweetId"/>-->
        <!--        </template>-->
        <template #tweet-action-bar>
          <PostButtonGroup @click.stop @newLike="newLike" @newComment="newComment" :post="tweet"/>
        </template>
      </TweetItem>
    </div>
  </div>
</template>

<style scoped>

</style>
