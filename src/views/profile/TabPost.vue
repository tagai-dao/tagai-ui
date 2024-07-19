<script setup lang="ts">
import CreativeIncomeItem from "@/components/profile/CreativeIncomeItem.vue";
import {ref} from "vue";
import TweetItem from "@/components/tweets/TweetItem.vue";
import {testTweets} from "@/assets/test-data";
import SpaceItem from "@/components/tweets/SpaceItem.vue";
import PostButtonGroup from "@/components/tweets/PostButtonGroup.vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<number []>([])
const scroller = document.querySelector('#profile-tab-scroller')
const onLoad = () => {
  if(loading.value || finished.value) return
  // loading.value = true
};

const onRefresh = () => {
  finished.value = false;
  onLoad();
};

</script>

<template>
  <div class="min-h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full"
                      loading-text="Loading"
                      pulling-text="Pull to refresh data"
                      loosing-text="Release to refresh">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                finished-text="No more"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div class="flex items-center gap-1 px-3">
          <span class="font-normal text-sm">创作 or Space 收入</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-white rounded-xl p-2 shadow-popper-tip">tips</div>
            </template>
          </el-popover>
        </div>
        <div class="w-full flex gap-3 scroll-pl-3 overflow-x-auto no-scroll-bar mt-1 snap-x">
          <div class="snap-start shrink-0 first:pl-3 last:pr-3" v-for="i of 4" :key="i">
            <CreativeIncomeItem/>
          </div>
        </div>
        <div class="px-3">
          <div v-for="tweet of testTweets" :key="tweet.postId">
            <div class="flex items-center gap-2 py-3">
              <div class="w-4 h-4 bg-green-normal rounded-full"></div>
              <div class="text-base flex-1">
                #trump • Market cap $50,409.00
              </div>
              <button class="bg-green-normal h-8 px-3 min-w-16 rounded-full text-sm">
                Buy
              </button>
            </div>
            <div class="bg-white rounded-2xl mb-3">
              <SpaceItem v-if="tweet.spaceId" :tweet="tweet">
                <template #tweet-action-bar>
                  <PostButtonGroup :post="tweet"/>
                </template>
              </SpaceItem>
              <TweetItem v-else :tweet="tweet">
                <template #tweet-action-bar>
                  <PostButtonGroup :post="tweet"/>
                </template>
              </TweetItem>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
