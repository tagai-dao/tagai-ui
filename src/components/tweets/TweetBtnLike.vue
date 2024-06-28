<script setup lang="ts">
import {ref} from "vue";
import {checkAccessToken, newLike} from "@/apis/api";
import {handleServerError} from "@/utils/notify";
import {useTweetTip} from "@/composables/useTweetTips";
import {useStateStore} from "@/stores/common";

const props = defineProps(['post'])
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const { postCondition } = useTweetTip("mint");
const isLiking = ref(false);

const userLike = async () => {
  if (postCondition.value === 0) {
    try {
      // check access token
      const v = await checkAccessToken();
      if (!v) {
        stateStore.showTwitterLogin = true;
        return;
      }
      isLiking.value = true;
      await newLike(props.tweet.tweetId);
      emits('newLike', props.tweet.tweetId)
    } catch (e: any) {
      handleServerError(e);
    } finally {
      isLiking.value = false;
    }
  } else if (postCondition.value === 1) {
    stateStore.showBtcLogin = true
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          :disabled="isLiking || post.liked"
          @click.stop="userLike">
    <i-ep-loading v-if="isLiking" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="post.liked ? 'btn-icon-like-active' : 'btn-icon-like'"></i>
    <span class="text-sm font-bold"
          :class="post.liked ? 'text-red-ff' : 'text-grey-bd'">
        {{ post.likeCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
