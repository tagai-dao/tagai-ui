<script setup lang="ts">
import { getAgentTweets } from '@/apis/api'
import { useCommunityStore } from '@/stores/community'
import type { Tweet } from '@/types'
import { sleep } from '@/utils/helper'
import { handleErrorTip } from '@/utils/notify'
import { onMounted, ref } from 'vue'
import TweetItem from "@/components/tweets/TweetItem.vue";
import CommerceBtn from '@/components/tweets/CommerceBtn.vue'
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import { useCurationStore } from "@/stores/curation";
import { getTokenInfoOfTweets } from '@/utils/pump'

const agentTweets = ref<Tweet[]>([])
const comStore = useCommunityStore()
const finished = ref(false)
const refreshing = ref(false)
const loading = ref(false)
const curationStore = useCurationStore()

const onRefresh = async () => {
  try {
    finished.value = false;
    refreshing.value = true;
    let list: any = await getAgentTweets(
        comStore.currentSelectedCommunity!.tick
    );

    if (list.length < 30) {
      finished.value = true
    }
    agentTweets.value = await getTokenInfoOfTweets(list)
  } catch (e) {
    console.log(3, e)
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

const onLoad = async () => {
  try {
    loading.value = true
    if (loading.value || finished.value || agentTweets.value.length == 0) return
    // @ts-ignore
    const list: any = await getAgentTweets(comStore.currentSelectedCommunity!.tick, Math.floor((agentTweets.value.length - 1) / 30) + 1)
    agentTweets.value = agentTweets.value.concat(await getTokenInfoOfTweets(list as Tweet[]))
    if (list.length < 30) {
      finished.value = true
    }
  } catch (error) {
    handleErrorTip(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  agentTweets.value = []
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.2);
  }
  await onRefresh()
})
</script>

<template>
  <van-pull-refresh v-if="agentTweets.length>0" class="h-full min-h-full overflow-auto no-scroll-bar"
                    v-model="refreshing"
                    @refresh="onRefresh"
                    loading-text="Loading"
                    pulling-text="Pull to refresh data"
                    loosing-text="Release to refresh"
  >
    <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        finished-text="No more"
        :offset="50"
        @load="onLoad"
    >
      <div v-for="(tweet, index) of agentTweets" :key="tweet.tweetId" class="mb-2">
        <SpaceItem
            v-if="tweet.spaceId"
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/space-detail/${tweet.tweetId}`)"
        >
        </SpaceItem>
        <TweetItem
            v-else
            class="bg-white rounded-2xl"
            :tweet="tweet"
            @click.stop="curationStore.currentSelectedTweet = tweet;$router.push(`/post-detail/${tweet.tweetId}`)"
        >
          <!-- <template #tweet-trade v-if="tweet.commerceId">
            <CommerceBtn :tweet="tweet"/>
          </template> -->
        </TweetItem>
      </div>
    </van-list>
  </van-pull-refresh>
  <div v-else class="bg-white py-3 web:py-5 px-4 rounded-2xl flex flex-col gap-2 web:gap-3
                    w-full">
    <div class="w-full flex my-8 justify-center items-center">
      <img src="~@/assets/images/empty-data.svg" alt="">
    </div>
  </div>
</template>

<style scoped>

</style>
