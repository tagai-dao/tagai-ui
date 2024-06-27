<script setup lang="ts">
import {onMounted, ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<number []>([])
const scroller = document.querySelector('#trade-record-scroller')
const onLoad = () => {
  if(loading.value || finished.value) return
  loading.value = true
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      listData.value.push(listData.value.length + 1);
    }
    loading.value = false;
    if (listData.value.length >= 20) {
      finished.value = true;
    }
  }, 1000);
};

const onRefresh = () => {
  finished.value = false;
  onLoad();
};

onMounted(() => {
  onLoad()
})
</script>

<template>
  <div class="bg-white py-5 px-4 rounded-2xl">
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
        <div class="grid grid-cols-5 gap-x-2 text-h5 h-10 items-center">
          <span class="col-span-2 pl-8">Account</span>
          <span class="col-span-1 text-center">buy/sell</span>
          <span class="col-span-1 text-center">$BTC</span>
          <span class="col-span-1 text-right">$TRUMP</span>
        </div>
        <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
             v-for="i of listData" :key="i">
          <div class="col-span-2 truncate flex items-center gap-1">
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <span class="truncate">0x……F263</span>
          </div>
          <span class="col-span-1 text-center">buy 1s</span>
          <span class="col-span-1 text-center">0.102</span>
          <span class="col-span-1 text-right">10.02M</span>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
