<script setup lang="ts">
import {ref} from "vue";
import {handleErrorTip, notify} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import { type Tweet } from "@/types";
import { OperateType, useTweet } from "@/composables/useTweet";
import errCode from "@/errCode";

const props = defineProps<{
    tweet: Tweet;
  }>()


function copyLink() {
    navigator.clipboard.writeText('https://tagai.fun/post-detail/' + props.tweet.tweetId)
    notify({
      message: 'Copied link'
    })
}

</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="copyLink">
    <i class="w-5 h-5 min-w-5 btn-icon-share"></i>
  </button>
</template>

<style scoped>

</style>
