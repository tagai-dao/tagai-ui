<script setup lang="ts">
import type { Tweet, CurateRecord } from "@/types";
import {onMounted, ref} from "vue";
import { getSpaceCurateList } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { formatAmount, parseTimestamp } from "@/utils/helper";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const curateList = ref<CurateRecord[]>([])

const props = defineProps<{tweet: Tweet}>()

const getSpeakerData = async () => {
  try{
    if (props.tweet.tweetId) {
      const list: any = await getSpaceCurateList(props.tweet.tweetId)
      curateList.value = list
      if (list.length < 30) {
        finished.value = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  getSpeakerData()
})
</script>

<template>
  <div class="max-h-[80vh] overflow-auto no-scroll-bar">
    <div v-for="(curate, i) of curateList" :key="i"
         class="bg-white rounded-2xl py-3 px-3.5 flex items-center gap-3 mb-2">
      <div class="relative">
        <img class="w-10 h-10 min-w-10 min-h-10 rounded-full" :src="curate.profile" alt="">
        <div class="bg-gradient-primary text-white text-xs font-medium rounded-full h-4 flex justify-center items-center
                    px-2 absolute transform -translate-x-1/2 -translate-y-1/2 left-2 top-1 rotate-[-30deg]">Host</div>
      </div>
      <span class="flex-1 text-grey-normal font-bold truncate">@{{ curate.twitterUsername }}</span>
      <div class="whitespace-pre-line text-grey-normal font-normal">
        {{ formatAmount(curate.amount) }}
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
