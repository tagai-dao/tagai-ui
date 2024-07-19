<script setup lang="ts">

import BackHeader from "@/layout/BackHeader.vue";
import {testTweets} from "@/assets/test-data";
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import Comments from "@/components/tweets/Comments.vue";
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19 ">
          It is my time, follow me！
        </div>
      </template>
    </BackHeader>
    <div class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2" id="comment-list-scroller">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 bg-green-normal rounded-full"></div>
        <div class="text-base flex-1">
          #trump • Market cap $50,409.00
        </div>
        <button class="bg-yellow-fa h-8 px-3 rounded-full text-sm">
          Buy $trump
        </button>
      </div>
      <div class="bg-white rounded-2xl py-2">
        <TweetItem :tweet="testTweets[0]">
          <template #tweet-action-bar>
            <PostButtonGroup :post="testTweets[0]"/>
          </template>
        </TweetItem>
      </div>
      <button class="h-11 min-h-11 bg-gradient-primary rounded-full text-white text-h5">
        {{$t('tips')}}
      </button>
      <div class="border-[1px] gradient-border bg-gradient-primary shadow-insert-white h-11 min-h-11 rounded-full
                  flex items-center justify-between px-4">
        <span>8 guys has curated</span>
        <div class="flex items-center gap-2">
          <div class="flex">
            <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-30">
              <img src="" alt="">
            </div>
            <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 h-8 z-20 -ml-2">
              <img src="" alt="">
            </div>
            <div class="border-[1px] border-white rounded-full bg-gray-400 w-8 z-10 -ml-2">
              <img src="" alt="">
            </div>
          </div>
          <button class="flex items-center gap-1.5">
            <span>more</span>
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
        </div>
      </div>
      <div class="text-h5 mt-2 px-3">Comments</div>
      <Comments/>
    </div>
  </div>
</template>

<style scoped>

</style>
