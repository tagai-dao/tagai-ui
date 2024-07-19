<script setup lang="ts">
import {ref} from "vue";
import {checkAccessToken, newLike} from "@/apis/api";
import {handleServerError} from "@/utils/notify";
import {useStateStore} from "@/stores/common";
import { type Tweet } from "@/types";

const props = defineProps<{
    tweet: Tweet;
  }>()
const emits = defineEmits(['newLike'])
const stateStore = useStateStore()
const isLiking = ref(false);

const userLike = async () => {
  
};
</script>

<template>
  <button class="flex justify-center items-center gap-2"
          :disabled="isLiking || (tweet.liked ?? 0) > 1"
          @click.stop="userLike">
    <i-ep-loading v-if="isLiking" class="animate-spin w-5 h-5"/>
    <i v-else class="w-5 h-5 min-w-5"
       :class="tweet.liked ? 'btn-icon-like-active' : 'btn-icon-like'"></i>
    <span class="text-sm font-bold"
          :class="tweet.liked ? 'text-red-ff' : 'text-grey-bd'">
        {{ tweet.likeCount ?? 0 }}</span>
  </button>
</template>

<style scoped>

</style>
