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
  <button @click.stop="userRetweet"
          :disabled="isRetweeting || post.retweeted"
          class="flex items-center gap-2">
    <i-ep-loading v-if="isRetweeting" class="animate-spin w-5 h-5 "/>
    <span class="text-sm" :class="post.retweeted ? 'text-gradient bg-gradient-primary' : 'text-gray-a6'">
      {{ $t("postView.retweet") }} {{ post.retweetCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
