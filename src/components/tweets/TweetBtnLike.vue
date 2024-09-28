<script setup lang="ts">
import {ref} from "vue";
import {handleErrorTip} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import { type Tweet } from "@/types";
import { OperateType, useTweet } from "@/composables/useTweet";
import errCode from "@/errCode";

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const isLiking = ref(false);

const { preCheckCuration, userLike } = useTweet()

async function like() {
  try{
    isLiking.value = true
    if (!(await preCheckCuration(OperateType.LIKE, props.tweet))) {
      return;
    }
    const res = await userLike(props.tweet, props.tweet.tick!)
    props.tweet.likeCount += 1;
    props.tweet.liked = 1;
  } catch (e) {
    if (e === errCode.TWITTER_ERR) {
      e = errCode.LIKE_FREQUENT
    }
    handleErrorTip(e)
  } finally {
    isLiking.value = false
  }
}

</script>

<template>
  <button class="flex justify-center items-center gap-2"
          :disabled="isLiking"
          @click.stop="like">
    <i-ep-loading v-if="isLiking" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="tweet.liked ? 'btn-icon-like-active' : 'btn-icon-like'"></i>
    <span class="text-sm font-bold"
          :class="tweet.liked ? 'text-red-e6' : 'text-grey-bd'">
        {{ tweet.likeCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
