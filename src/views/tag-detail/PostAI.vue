<script setup lang="ts">
import { getAgentTweets } from '@/apis/api'
import { useCommunityStore } from '@/stores/community'
import type { Tweet } from '@/types'
import { sleep } from '@/utils/helper'
import { handleErrorTip } from '@/utils/notify'
import { onMounted, ref } from 'vue'

const agentTweets = ref<Tweet[]>([])
const comStore = useCommunityStore()
const finished = ref(false)
const refreshing = ref(false)

const onRefresh = async () => {
  try {
    console.log(1)
    finished.value = false;
    refreshing.value = true;
    let list: any = await getAgentTweets(
      comStore.currentSelectedCommunity!.tick
    );
    console.log(2, list)

    if (list.length < 30) {
      finished.value = true
    }
    agentTweets.value = list
  } catch (e) {
    console.log(3, e)
    handleErrorTip(e)
  } finally {
    refreshing.value = false;
  }
}

const onLoad = async () => {
  // @ts-ignore
  const list = await getAgentTweets(comStore.currentSelectedCommunity!.tick, Math.floor((agentTweets.value.length - 1) / 30) + 1)
  agentTweets.value = agentTweets.value.concat(list as Tweet[])
}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.2);
  }
  await onRefresh()
})
</script>

<template>
  <div class="bg-white py-3 web:py-5 px-4 rounded-2xl flex flex-col gap-2 web:gap-3
                    w-full web:w-[340px] web:min-w-[340px]">
<!--    <div class="flex gap-2 items-center">-->
<!--      <img class="w-10 h-10 rounded-full" src="~@/assets/icons/icon-default-avatar.svg" alt="">-->
<!--      <div class="text-h3 text-grey-normal">AI</div>-->
<!--    </div>-->
    <div v-if="agentTweets.length == 0" class="w-full flex my-8 justify-center items-center">
      <img src="~@/assets/images/empty-data.svg" alt="">
    </div>
    <div v-else>
      <div v-for="tweet in agentTweets" :key="tweet.tweetId">
        <div class="text-h3 text-grey-normal">
          {{ tweet.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
