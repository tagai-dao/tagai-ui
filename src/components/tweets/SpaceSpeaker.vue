<script setup lang="ts">
import type { Tweet, CurateRecord } from "@/types";
import {computed, onMounted, ref, type PropType} from "vue";
import { getSpaceCurationList } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { formatAmount } from "@/utils/helper";

const refreshing = ref(false)
const finished = ref(false)


const curateList = ref<CurateRecord[]>([])

const props = defineProps<{
  tweet: Tweet,
  curationType: number
}>()

const hostList = computed(() => {
  if (curateList.value.length > 0) {
    console.log(1, curateList.value.filter((record: CurateRecord) => (record.curateRecord & 4) === 4))
    return curateList.value.filter((record: CurateRecord) => (record.curateRecord & 4) === 4)
  }
  return []
})

const cohostList = computed(() => {
  if (curateList.value.length > 0) {
    console.log(2, curateList.value.filter((record: CurateRecord) => (record.curateRecord & 8) === 8))
    return curateList.value.filter((record: CurateRecord) => (record.curateRecord & 8) === 8)
  }
  return []
})

const speakerList = computed(() => {
  if (curateList.value.length > 0) {
    console.log(3, curateList.value.filter((record: CurateRecord) => (record.curateRecord & 16) === 16))
    return curateList.value.filter((record: CurateRecord) => (record.curateRecord & 16) === 16)
  }
  return []
})

const getSpeakerData = async () => {
  try{
    if (props.tweet.tweetId) {
      const list: any = await getSpaceCurationList(props.tweet.tweetId)
      console.log(list)
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
  console.log(1, props.curationType, props.tweet)
  getSpeakerData()
})
</script>

<template>
  <div class="max-h-[80vh] overflow-auto no-scroll-bar">
    <div v-for="(curate, i) of hostList" :key="i + 'host'"
         v-if="props.curationType === 1"
         class="bg-white rounded-2xl py-3 px-3.5 flex items-center gap-3 mb-2">
      <div class="relative">
        <img class="w-10 h-10 min-w-10 min-h-10 rounded-full" :src="curate.profile" alt="">
        <div class="bg-gradient-primary text-white text-xs font-medium rounded-full h-4 flex justify-center items-center
                    px-2 absolute transform -translate-x-1/2 -translate-y-1/2 left-2 top-1 rotate-[-30deg]">{{$t('postView.host')}}</div>
      </div>
      <span class="flex-1 text-grey-normal font-bold truncate">@{{ curate.twitterUsername }}</span>
      <div class="whitespace-pre-line text-grey-normal font-normal">
        {{ formatAmount(curate.hostAmount) }}
      </div>
    </div>
    <div v-for="(curate, i) of cohostList" :key="i + 'cohost'"
         v-if="props.curationType === 2"
         class="bg-white rounded-2xl py-3 px-3.5 flex items-center gap-3 mb-2">
      <div class="relative">
        <img class="w-10 h-10 min-w-10 min-h-10 rounded-full" :src="curate.profile" alt="">
        <div class="bg-gradient-primary text-white text-xs font-medium rounded-full h-4 flex justify-center items-center
                    px-2 absolute transform -translate-x-1/2 -translate-y-1/2 left-2 top-1 rotate-[-30deg]">{{$t('postView.co-host')}}</div>
      </div>
      <span class="flex-1 text-grey-normal font-bold truncate">@{{ curate.twitterUsername }}</span>
      <div class="whitespace-pre-line text-grey-normal font-normal">
        {{ formatAmount(curate.cohostAmount) }}
      </div>
    </div>
    <div v-for="(curate, i) of speakerList" :key="i + 'speaker'"
         v-if="props.curationType === 3"
         class="bg-white rounded-2xl py-3 px-3.5 flex items-center gap-3 mb-2">
      <div class="relative">
        <img class="w-10 h-10 min-w-10 min-h-10 rounded-full" :src="curate.profile" alt="">
        <div class="bg-gradient-primary text-white text-xs font-medium rounded-full h-4 flex justify-center items-center
                    px-2 absolute transform -translate-x-1/2 -translate-y-1/2 left-2 top-1 rotate-[-30deg]">Speaker</div>
      </div>
      <div class="flex-1">
        <div class="text-grey-normal font-bold truncate">@{{ curate.twitterUsername }}</div>
        <div>
          {{ curate.speakerTime }} Min
        </div>
      </div>
      <div class="whitespace-pre-line text-grey-normal font-normal">
        {{ formatAmount(curate.speakerAmount) }}
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
