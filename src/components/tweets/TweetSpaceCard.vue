<script setup lang="ts">
import { computed } from 'vue'
import type {Tweet} from "@/types";
import {usePost} from "@/composables/usePost";
import { parseSpaceStartTime, parseSpaceLastTime, parseTimestamp } from '@/utils/helper';

const props = defineProps<{tweet: Tweet}>();

const {
  profileImg
} = usePost(props.tweet)

const isEnd = computed(() => {
  return !!(props.tweet?.state == 4)
})

const stateString = computed(() => {
  switch(props.tweet.state) {
    case 1:
      return 'Reminder';
    case 2:
      return 'Living';
    case 3:
      return 'Playing record';
    case 4:
      return 'Canceld';
    default:
      return 'Reminder'
  }
})

const desc = computed(() => {
  switch(props.tweet.state) {
    case 1:
      return parseSpaceStartTime(props.tweet.scheduledStart || props.tweet.startedAt);
    case 2:
      return 'Living | ' + props.tweet.participantCount;
    case 3:
      return `${parseTimestamp(props.tweet.endedAt)} | ${parseSpaceLastTime(props.tweet)} | ${props.tweet.participantCount ?? 0} listeners`;
    case 4:
      return 'Canceld';
    default:
      return 'Reminder'
  }
})

const gotoSpace = () => {
  switch(props.tweet.state) {
    case 1:
    case 2:
    case 3:
      window.open(`https://x.com/${props.tweet.twitterUsername}/status/${props.tweet.tweetId}`)
    case 4:
    default:
      return 'Reminder'
  }
}

</script>

<template>
  <div class="py-5 px-5 rounded-2xl flex flex-col gap-4"
       :class="isEnd?'bg-grey-light-active':'bg-gradient-primary'">
    <div class="flex items-center gap-2">
      <img class="w-6 h-6 rounded-full"
           :src="profileImg" alt="">
      <span class="text-h5 text-grey-normal flex-1 truncate">{{ tweet.twitterName }}</span>
      <!-- <button class="bg-white rounded-md h-5 px-2 text-sm">Host</button> -->
    </div>
    <div>
      <div class="text-h5">
      {{ tweet.title }}
      </div>
      <div class="text-sm font-normal">
      {{ desc }}
      </div>
    </div>
    <button @click.stop="gotoSpace"
            class="text-h5 h-9 rounded-full bg-white disabled:opacity-100"
            :disabled="isEnd">
      <span :class="isEnd?'text-grey-normal':'text-gradient bg-gradient-primary'">
        {{ stateString }}
      </span>
    </button>
  </div>
</template>

<style scoped>

</style>
