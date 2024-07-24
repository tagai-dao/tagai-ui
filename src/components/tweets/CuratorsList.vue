<script setup lang="ts">
import type { Tweet, CurateRecord } from "@/types";
import {onMounted, ref} from "vue";
import { getTweetCurateList } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { formatAmount } from "@/utils/helper";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const curateList = ref<CurateRecord[]>([])

const props = defineProps<{tweet: Tweet}>()

const onLoad = async () => {
  if (finished.value || curateList.value.length == 0) return;
  try{
    if (props.tweet.tweetId) {
      const list: any = await getTweetCurateList(props.tweet.tweetId, Math.floor((curateList.value.length - 1) / 30) + 1)
      curateList.value = list
      if (list.length < 30) {
        finished.value = true
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}
const onRefresh = async () => {
  try{
    finished.value = false
    if (props.tweet.tweetId) {
      const list: any = await getTweetCurateList(props.tweet.tweetId)
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
  onRefresh()
})
</script>

<template>
  <div class="max-h-[80vh] overflow-auto no-scroll-bar">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full"
                      loading-text="Loading"
                      pulling-text="Pull to refresh data"
                      loosing-text="Release to refresh">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                finished-text="No more"
                :offset="50"
                @load="onLoad">
        <div v-for="(curate, i) of curateList" :key="i"
             class="bg-white rounded-2xl py-3 px-3.5 flex gap-3 mb-2">
          <div class="flex-1 flex items-center gap-2">
            <img class="w-6 h-6 rounded-full" :src="curate.profile" alt="">
            <!-- <span class="text-grey-normal text-h5">Username</span> -->
            <span class="text-grey-8d font-normal">@{{ curate.twitterUsername }}</span>
          </div>
          <div class="whitespace-pre-line text-grey-normal font-normal">
            {{ formatAmount(curate.amount) }}
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
