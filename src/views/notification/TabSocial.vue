<script setup lang="ts">
import {ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<number []>([])
const onLoad = () => {
  if(loading.value || finished.value) return
  loading.value = true
};

const onRefresh = () => {
  finished.value = false;
  onLoad();
};

</script>

<template>
  <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                    loading-text="Loading"
                    pulling-text="Pull to refresh data"
                    loosing-text="Release to refresh">
    <van-list :loading="loading"
              :finished="finished"
              :immediate-check="false"
              finished-text="No more"
              :offset="50"
              @load="onLoad">
      <!--reply-->
      <div class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
        <img class="h-6 w-6 min-h-6 rounded-full"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="flex-1 flex-col gap-1.5">
          <div class="flex items-center gap-1 text-grey-8d leading-5 text-lg">
            <span>@username</span>
            <span> · </span>
            <span>5days ago</span>
          </div>
          <div class="text-base">Reply @elonmusk</div>
          <div class="text-base">@wormhole_3 We all will be there for you！</div>
        </div>
      </div>
      <!--like-->
      <div class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
        <div class="px-1 opacity-70">
          <img class="h-4 w-4 min-h-4 rounded-full"
               src="~@/assets/icons/btn-like-active.svg" alt="">
        </div>
        <div class="flex-1 flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <img class="h-10 w-10 min-h-10 rounded-full"
                 src="~@/assets/icons/icon-default-avatar.svg" alt="">
          </div>
          <div class="text-base">@readonlm liked your curation</div>
        </div>
      </div>
      <!--retweet-->
      <div class="bg-white p-4 rounded-2xl flex gap-3 mb-2">
        <div class="px-1 opacity-70">
          <img class="h-4 w-4 min-h-4 rounded-full"
               src="~@/assets/icons/btn-retweet-active.svg" alt="">
        </div>
        <div class="flex-1 flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <img class="h-10 w-10 min-h-10 rounded-full"
                 src="~@/assets/icons/icon-default-avatar.svg" alt="">
          </div>
          <div class="text-base">@readonlm retweeted your curation</div>
        </div>
      </div>
    </van-list>
  </van-pull-refresh>
</template>

<style scoped>

</style>
