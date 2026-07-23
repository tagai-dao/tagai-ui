<template>
  <div class="flex justify-between py-3 items-center gap-4 flex-1 max-w-425px border-t-[1px] mt-3">
    <!-- reply-->
    <TweetBtnReply :tweet/>
    <!-- retweet -->
    <TweetBtnRetweet :tweet/>
    <!-- like-->
    <!-- <TweetBtnLike :tweet/> -->
    <!-- quote-->
    <TweetBtnQuote :tweet/>
    <!-- share -->
    <TweetShare :tweet/>
    <!-- contextual actions -->
    <TweetMoreActions :tweet/>
    <!-- curate -->
    <TweetBtnCurate v-if="!tweet.isDeployTweet" :tweet/>
  </div>
</template>

<script setup lang="ts">
import type { Tweet } from "@/types";
import TweetBtnLike from "@/components/tweets/TweetBtnLike.vue";
import TweetShare from "@/components/tweets/TweetShare.vue";
import TweetBtnRetweet from "@/components/tweets/TweetBtnRetweet.vue";
import TweetBtnReply from "@/components/tweets/TweetBtnReply.vue";
import TweetBtnQuote from "@/components/tweets/TweetBtnQuote.vue";
import TweetBtnCurate from "./TweetBtnCurate.vue";
import TweetMoreActions from "./TweetMoreActions.vue";

const props = defineProps<{
    tweet: Tweet;
  }>()
</script>

<style scoped></style>
