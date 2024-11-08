<template>
  <div class="flex justify-between py-3 items-center gap-88px flex-1 max-w-425px border-t-[1px] mt-3">
    <!-- reply-->
    <TweetBtnReply :tweet/>
    <!-- retweet -->
    <TweetBtnRetweet :tweet/>
    <!-- like-->
    <TweetBtnLike :tweet/>
    <!-- quote-->
    <TweetBtnQuote :tweet/>
    <!-- curate -->
    <TweetBtnCurate :tweet/>
  </div>
</template>

<script setup lang="ts">
import type { Tweet } from "@/types";
import TweetBtnLike from "@/components/tweets/TweetBtnLike.vue";
import TweetBtnRetweet from "@/components/tweets/TweetBtnRetweet.vue";
import TweetBtnReply from "@/components/tweets/TweetBtnReply.vue";
import TweetBtnQuote from "@/components/tweets/TweetBtnQuote.vue";
import TweetBtnCurate from "./TweetBtnCurate.vue";

const props = defineProps<{
    tweet: Tweet;
  }>()
</script>

<style scoped></style>
