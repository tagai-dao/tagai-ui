<script setup lang="ts">
import type { Tweet, CurateRecord } from "@/types";
import {onMounted, ref} from "vue";
import { getTweetCurateList } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import { formatAmount, parseTimestamp } from "@/utils/helper";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const curateList = ref<CurateRecord[]>([])

const props = defineProps<{tweet: Tweet}>()

const onLoad = async () => {
  if (finished.value || curateList.value.length == 0 || loading.value) return;
  loading.value = true
  try{
    if (props.tweet.tweetId) {
      const list: any = await getTweetCurateList(props.tweet.tweetId, Math.floor((curateList.value.length - 1) / 30) + 1)
      curateList.value = curateList.value.concat(list)
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
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :offset="50"
                @load="onLoad">
        <div v-for="(curate, i) of curateList" :key="i"
             class="bg-white rounded-2xl py-3 px-3.5 flex items-stretch gap-3 mb-2">
          <div class="py-2">
            <!--            like-->
            <img v-if="(curate.curateRecord & 1) == 1" src="~@/assets/icons/icon-like-active.svg" alt="">
            <!--            retweet-->
            <img v-if="(curate.curateRecord & 2) == 2" class="mt-2" src="~@/assets/icons/btn-retweet-active.svg" alt="">
            <!--            reply-->
            <!--            <img src="~@/assets/icons/btn-reply-active.svg" alt="">-->
            <!--            quote-->
            <!--            <img src="~@/assets/icons/btn-quote-active.svg" alt="">-->
          </div>
          <div class="flex-1 items-center flex">
            <div class="flex items-center gap-2">
              <img class="w-8 h-8 min-w-8 min-h-8 rounded-full" :src="curate.profile" alt="">
            <span class="text-grey-8d font-normal">@{{ curate.twitterUsername }}</span>
            </div>
            <!-- <span class="text-grey-normal text-h5">Username</span> -->
          </div>
          <div class="flex flex-col items-end">
            <div class="whitespace-pre-line text-grey-normal font-normal">
              {{ formatAmount(curate.amount) }}
            </div>
            <div class="text-sm text-grey-light-active">
              {{ parseTimestamp(curate.createAt) }}
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
