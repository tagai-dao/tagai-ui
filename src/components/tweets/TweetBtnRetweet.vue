<script setup lang="ts">

import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import { type Tweet } from "@/types";

const props = defineProps<{
    tweet: Tweet;
  }>()
const stateStore = useStateStore()

const isRetweeting = ref(false);
const userRetweet = async () => {
};
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="userRetweet">
    <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5 "/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="(tweet.retweeted ?? 0) > 0 ? 'btn-icon-retweet-active' : 'btn-icon-retweet'"></i>
    <span class="text-sm font-bold"
          :class="tweet.retweeted ? 'text-red-ff' : 'text-grey-bd'">
     {{ tweet.retweetCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
