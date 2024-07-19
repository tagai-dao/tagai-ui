<template>
  <div class="flex justify-between py-3 items-center gap-88px flex-1 max-w-425px">
    <!-- like-->
    <TweetBtnLike :tweet="tweet"/>
    <!-- retweet -->
    <TweetBtnRetweet :tweet="tweet"/>
    <!-- reply-->
    <TweetBtnReply :tweet="tweet"/>
    <!-- quote-->
    <TweetBtnQuote :tweet="tweet"/>
  </div>
</template>

<script setup lang="ts">
import { useTimer } from "@/composables/useTools";
import { usePost } from "@/composables/usePost";
import { computed, defineProps, ref, withDefaults } from "vue";
import type { Tweet } from "@/types";
import {useTweet} from "@/composables/useTweet";
import {useCreateTweet} from "@/composables/useCreateTweet";
import TweetBtnLike from "@/components/tweets/TweetBtnLike.vue";
import TweetBtnRetweet from "@/components/tweets/TweetBtnRetweet.vue";
import TweetBtnReply from "@/components/tweets/TweetBtnReply.vue";
import TweetBtnQuote from "@/components/tweets/TweetBtnQuote.vue";

const props = defineProps<{
    tweet: Tweet;
  }>()
</script>

<style scoped></style>
