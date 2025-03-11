<script setup lang="ts">
import { useCurationStore } from "@/stores/curation";
import { sleep, getRequestPages, parseTimestamp } from "@/utils/helper";
import {onMounted, ref} from "vue";
import { getReplyOfTweet } from '@/apis/api'
import { handleErrorTip } from "@/utils/notify";
import type { Reply } from "@/types";
import emitter from "@/utils/emitter";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<Reply[]>([])
const scroller = document.querySelector('#comment-list-scroller')
const curationStore = useCurationStore()

const onLoad = async () => {
  if(refreshing.value || finished.value || listData.value.length == 0) return
  try{
    if (!curationStore.currentSelectedTweet?.tweetId) return;
    let list: any = await getReplyOfTweet(curationStore.currentSelectedTweet.tweetId, getRequestPages(listData.value.length))
    if (list && list.length > 0) {
      listData.value = list
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
};

const onRefresh = async () => {
  try{
    finished.value = false;
    if (!curationStore.currentSelectedTweet?.tweetId) return;
    refreshing.value = true;
    let list: any = await getReplyOfTweet(curationStore.currentSelectedTweet.tweetId)
    if (list && list.length > 0) {
      listData.value = list
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

const gotoTwitterProfile = (reply: Reply) => {

  window.open(`https://x.com/${reply.twitterUsername}`, '__blank')
}

function gotoReply(reply: Reply) {
  window.open(`https://x.com/${curationStore.currentSelectedTweet?.twitterUsername}/status/${reply.replyId}`, '__blank')
}

onMounted(async () => {
  while(!curationStore.currentSelectedTweet?.tweetId) {
    await sleep(0.2)
  }
  onRefresh()
  emitter.on('newReply', onRefresh);
})
</script>

<template>
  <div>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="$t('noMore')"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div v-for="reply of listData" :key="reply.replyId" class="bg-white px-5 py-4 rounded-2xl">
          <div class="flex gap-2" @click="gotoReply(reply)">
            <img class="h-10 w-10 min-w-10 rounded-full"
                 :src="reply.profile" alt="">
            <div class="flex-1 min-h-10 flex flex-col">
              <div class="text-h3">{{ reply.twitterName }}</div>
              <div class="w-full flex items-center flex-wrap gap-x-2 text-sm font-normal">
                <span class="text-grey-8d">@{{ reply.twitterUsername }}</span>
                <span class="mx-4px"> · </span>
                <button @click.stop="gotoTwitterProfile(reply)">
                  <img class="w-3 h-3" src="../../assets/icons/icon-x.svg" alt="">
                </button>
              </div>
            </div>
            <button class="text-grey-normal text-sm font-light italic">
              {{ parseTimestamp(reply.operateTime) }}
            </button>
          </div>
          <div class="pl-12 mt-2">
            {{ reply.content }}
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
