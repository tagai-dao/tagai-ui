<script setup lang="ts">
import {ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<number []>([])
const scroller = document.querySelector('#space-detail-scroller')
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
  <div>
    <div class="text-h5 mb-2 mt-2 px-3">Space Comments</div>
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
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
        <div class="bg-white px-5 py-4 rounded-2xl">
          <div class="flex gap-2">
            <img class="h-10 w-10 min-w-10 rounded-full"
                 src="~@/assets/icons/icon-default-coin.svg" alt="">
            <div class="flex-1 min-h-10 flex flex-col">
              <div class="text-h3">Musk</div>
              <div class="w-full flex items-center flex-wrap gap-x-2 text-sm font-normal">
                <span class="">@asmonmy</span>
                <span class="mx-4px"> · </span>
                <button>
                  <img class="w-3 h-3" src="~@/assets/icons/icon-x.svg" alt="">
                </button>
              </div>
            </div>
            <button class="bg-gradient-primary h-6 rounded-full px-3 text-white text-sm font-semibold">
              $10.01
            </button>
          </div>
          <div class="pl-12 mt-2">
            MemeCoin is the futrue！
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
