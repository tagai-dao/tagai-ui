<script setup lang="ts">

import BackHeader from "@/layout/BackHeader.vue";
import {testTweets} from "@/assets/test-data";
import TweetItem from "@/components/tweets/TweetItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";
import SpaceComments from "@/views/space-detail/SpaceComments.vue";

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
    <div class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2" id="space-detail-scroller">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 bg-green-b6 rounded-full"></div>
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
      <div class="bg-white rounded-2xl py-4 px-3 flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <div class="text-base flex-1 text-h5">
            Rewards
          </div>
          <button class="bg-yellow-fa h-8 px-3 rounded-full text-sm">
            Settled
          </button>
        </div>
        <div class="flex items-center justify-end">
          <div class="border-[1px] border-grey-c9 rounded-xl h-8 px-3 w-max flex items-center">
            4.76 M $LATC（$100）
          </div>
        </div>
        <div class="grid grid-cols-2 gap-y-3 gap-x-1">
          <div class="col-span-1 border-[1px] border-grey-c9 rounded-xl px-3 py-4 flex gap-2">
            <div class="w-4 h-4 bg-grey-bd/80 rounded-full"></div>
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">Curator</div>
                <span>1</span>
              </div>
              <div class="text-h5">1.19M $LATC</div>
            </div>
          </div>
          <div class="col-span-1 border-[1px] border-grey-c9 rounded-xl px-3 py-4 flex gap-2">
            <div class="w-4 h-4 bg-grey-bd/80 rounded-full"></div>
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">Host</div>
                <span>1</span>
              </div>
              <div class="text-h5">1</div>
            </div>
          </div>
          <div class="col-span-1 border-[1px] border-grey-c9 rounded-xl px-3 py-4 flex gap-2">
            <div class="w-4 h-4 bg-grey-bd/80 rounded-full"></div>
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">Co-Host</div>
                <span>1</span>
              </div>
              <div class="text-h5">1.19M $LATC</div>
            </div>
          </div>
          <div class="col-span-1 border-[1px] border-grey-c9 rounded-xl px-3 py-4 flex gap-2">
            <div class="w-4 h-4 bg-grey-bd/80 rounded-full"></div>
            <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-h4">
                <div class="flex-1">Speaker</div>
                <span>1</span>
              </div>
              <div class="text-h5">1.19M $LATC</div>
            </div>
          </div>
        </div>
        <div class="flex justify-center gap-10">
          <button class="bg-green-b6 h-9 rounded-full px-3 flex items-center justify-center gap-2">
            <span class="text-h5">Curator</span>
            <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
          <button class="bg-yellow-fa h-9 rounded-full px-3 flex items-center justify-center gap-2">
            <span class="text-h5">Space</span>
            <img src="~@/assets/icons/icon-arrow-forward.svg" alt="">
          </button>
        </div>
      </div>
      <SpaceComments/>
    </div>
</div>
</template>

<style scoped>

</style>
