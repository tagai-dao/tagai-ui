<script setup lang="ts">

import {useStateStore} from "@/stores/common";
import {ref} from "vue";
import { type Tweet } from "@/types";
import { OperateType, useTweet } from "@/composables/useTweet";
import { handleErrorTip } from "@/utils/notify";
import errCode from "@/errCode";

const props = defineProps<{
    tweet: Tweet;
  }>()
const stateStore = useStateStore()

const isRetweeting = ref(false);
const { preCheckCuration, userRetweet } = useTweet()

async function retweet() {
  try{
    isRetweeting.value = true
    if (!await preCheckCuration(OperateType.RETWEET, props.tweet)) {
      return;
    }
    const res = await userRetweet(props.tweet, props.tweet.tick!)


    props.tweet.retweetCount += 1;
    props.tweet.retweeted = 1;
  } catch (e) {
    if (e === errCode.TWITTER_ERR) {
      e = errCode.RETWEET_FREQUENT
    }
    handleErrorTip(e)
  } finally {
    isRetweeting.value = false
  }
}
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="retweet">
    <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5 "/>
    <i v-else class="w-6 h-6 min-w-6"
       :class="(tweet.retweeted ?? 0) > 0 ? 'btn-icon-retweet-active' : 'btn-icon-retweet'"></i>
    <span class="text-sm font-bold"
          :class="tweet.retweeted ? 'text-green-34' : 'text-grey-bd'">
     {{ tweet.retweetCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
