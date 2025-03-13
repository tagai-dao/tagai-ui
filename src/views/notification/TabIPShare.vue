<script setup lang="ts">
import {ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
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
                    :loading-text="$t('loading')"
                    :lpulling-text="$t('pullToRefreshData')"
                    :loosing-text="$t('releaseToRefresh')">
    <van-list :loading="loading"
              :finished="finished"
              :immediate-check="false"
              :finished-text="$t('noMore')"
              :offset="50"
              @load="onLoad">
      <div class="bg-white p-4 rounded-2xl flex items-center gap-1.5 mb-2"
           v-for="i of 2" :key="i">
        <img class="h-10 w-10 min-h-10 rounded-full"
             src="~@/assets/icons/icon-default-avatar.svg" alt="">
        <div class="flex-1">
          <div class="flex justify-between items-center">
            <div>
              <span class="text-grey-normal font-bold text-lg">Username</span>
              <span class="text-sm text-grey-8d"> • 23 days ago</span>
            </div>
            <div class="font-medium text-grey-3f">0.003 ETH</div>
          </div>
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-1 text-grey-8d">
              <span>@username</span>
              <span class="mx-4px"> · </span>
              <button>
                <img class="w-4 h-4" src="~@/assets/icons/icon-x.svg" alt="">
              </button>
            </div>
            <span class="text-red-e6 font-medium">Sell</span>
<!--            <span class="text-green-500 font-medium">Buy</span>-->
          </div>
        </div>
      </div>
    </van-list>
  </van-pull-refresh>
</template>

<style scoped>

</style>
