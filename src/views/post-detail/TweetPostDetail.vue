<script setup lang="ts">

import BackHeader from "@/layout/BackHeader.vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import Comments from "@/components/tweets/Comments.vue";
import {onMounted, ref} from "vue";
import CuratorsList from "@/components/tweets/CuratorsList.vue";
import { useCurationStore } from "@/stores/curation";
import { useRoute, useRouter } from "vue-router";
import { getTweetById } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import CommerceBtn from "@/components/tweets/CommerceBtn.vue";
import { getTokenInfoOfTweets } from "@/utils/pump";

const curatorsModalVisible = ref(false)
const router = useRouter()
const route = useRoute()

const curationStore = useCurationStore()
const accStore = useAccountStore()

onMounted(async () => {
  const tweetId = route.params.id;
  if (typeof(tweetId) !== 'string') {
    router.replace('/')
    return;
  }
  if (curationStore.currentSelectedTweet?.tweetId !== tweetId) {
    curationStore.currentSelectedTweet = null
  }
  curationStore.currentSelectedTweet = await getTweetById(tweetId, accStore.getAccountInfo?.twitterId) as any
  if (!curationStore.currentSelectedTweet) return

  if (curationStore.currentSelectedTweet.spaceId) {
    router.replace('/space-detail/' + tweetId)
  }

  let ts = await getTokenInfoOfTweets([curationStore.currentSelectedTweet!])
  curationStore.currentSelectedTweet = ts[0]
})

</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3" v-if="curationStore.currentSelectedTweet?.tweetId">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">
          #{{ curationStore.currentSelectedTweet.tick }}
        </div>
      </template>
    </BackHeader>
    <div class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2" id="comment-list-scroller">
      <!-- <div class="flex items-center gap-2">
        <div class="w-4 h-4 bg-green-normal rounded-full"></div>
        <div class="text-base flex-1">
          #{{ curationStore.currentSelectedTweet.tick }} • Market cap $50,409.00
        </div>
      </div> -->
      <div class="bg-white rounded-2xl py-2">
        <TweetItem :tweet="curationStore.currentSelectedTweet" :multiline="true">
          <template #tweet-action-bar>
            <PostButtonGroup :tweet="curationStore.currentSelectedTweet"/>
          </template>
          <template #tweet-trade>
            <CommerceBtn :tweet="curationStore.currentSelectedTweet"/>
          </template>
        </TweetItem>
      </div>
      <div v-if="curationStore.currentSelectedTweet.curateCount" class="border-[1px] gradient-border bg-gradient-purple shadow-insert-white h-[50px] min-h-[50px] rounded-full
                  flex items-center justify-between px-4 mt-3">
        <span>{{$t('postView.curatedCount', {count: curationStore.currentSelectedTweet.curateCount})}}</span>
        <div class="flex items-center gap-2">
          <div class="flex">
            <!-- <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
              <img src="" alt="">
            </div>
            <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-20 -ml-2">
              <img src="" alt="">
            </div>
            <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 z-10 -ml-2">
              <img src="" alt="">
            </div> -->
          </div>
          <button class="flex items-center gap-1.5" @click="curatorsModalVisible=true">
            <span>{{ $t('more') }}</span>
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
        </div>
      </div>
      <div class="text-h5 mt-2 px-3">{{$t('postView.comments')}}</div>
      <Comments />
    </div>
    <el-dialog v-model="curatorsModalVisible"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px] bg-grey-f4"
               width="90%" :show-close="false" align-center destroy-on-close>
      <CuratorsList :tweet="curationStore.currentSelectedTweet"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
