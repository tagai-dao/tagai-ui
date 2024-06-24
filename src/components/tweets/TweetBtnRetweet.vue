<script setup lang="ts">

import {useStateStore} from "@/stores/common";
import {useTweetTip} from "@/composables/useTweetTips";
import {ref} from "vue";

const props = defineProps(['post'])
const stateStore = useStateStore()
const { postCondition } = useTweetTip("mint");

const isRetweeting = ref(false);
const userRetweet = async () => {
  if (postCondition.value === 0) {
  } else {
    stateStore.loginTipType = "comment";
    stateStore.globalLoginTip = true;
  }
};
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          @click.stop="userRetweet"
          :disabled="isRetweeting || post.retweeted">
    <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5 "/>
    <span class="text-sm font-bold"
          :class="post.retweeted ? 'text-red-ff' : 'text-grey-bd'">
      {{ $t("postView.retweet") }} {{ post.retweetCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
