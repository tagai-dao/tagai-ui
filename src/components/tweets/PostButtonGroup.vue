<template>
  <div class="flex justify-between py-2 items-center gap-88px flex-1 max-w-425px">
    <!-- like-->
    <TweetBtnLike :post="post"/>

    <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
      <button @click.stop class="flex items-center gap-2">
        <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5"/>
        <i v-else class="w-5 h-5 min-w-5"
          :class="post?.retweeted ? 'btn-icon-retweet-active' : 'btn-icon-retweet'"></i>
        <span class="text-sm"
              :class="post.retweeted ? 'text-gradient bg-gradient-primary' : 'text-gray-a6'">
          {{ (post.countRetweet ?? 0) + (post.countQuote ?? 0) }}</span>
      </button>
      <template #content>
        <div class="flex flex-col gap-10px px-15px py-10px min-w-80px">
          <!-- retweet -->
          <TweetBtnRetweet :post="post"/>
          <!-- quote-->
          <TweetBtnQuote :post="post"/>
        </div>
      </template>

    </el-tooltip>

    <!-- reply-->
    <TweetBtnReply :post="post"/>
  </div>
</template>

<script setup lang="ts">
import { useTimer } from "@/composables/useTools";
import { usePost } from "@/composables/usePost";
import { computed, defineProps, ref, withDefaults } from "vue";
import type { Tweet } from "@/types";
import { useTweetTip } from "@/composables/useTweetTips";
import {useTweet} from "@/composables/useTweet";
import {useCreateTweet} from "@/composables/useCreateTweet";
import TweetBtnLike from "@/components/tweets/TweetBtnLike.vue";
import TweetBtnRetweet from "@/components/tweets/TweetBtnRetweet.vue";
import TweetBtnReply from "@/components/tweets/TweetBtnReply.vue";
import TweetBtnQuote from "@/components/tweets/TweetBtnQuote.vue";

const props = withDefaults(
  defineProps<{
    post: Tweet;
  }>(),
  {
    post: {},
  }
);
const isRetweeting = ref(false);
const clickRetweetView = () => {
  try {
    const info = JSON.parse(props.post.retweetInfo);
    window.open(`https://twitter.com/${info.author.username}/status/${info.id}`);
  } catch (error) {}
};
</script>

<style scoped></style>
