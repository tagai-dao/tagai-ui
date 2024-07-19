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
          @click.stop="userRetweet"
          :disabled="isRetweeting || (tweet.retweeted ?? 0) > 0">
    <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5 "/>
    <span class="text-sm font-bold"
          :class="tweet.retweeted ? 'text-red-ff' : 'text-grey-bd'">
      {{ $t("postView.retweet") }} {{ tweet.retweetCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
