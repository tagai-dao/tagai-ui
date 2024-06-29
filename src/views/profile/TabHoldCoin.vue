<script setup lang="ts">
import {ref} from "vue";

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
                      class="h-full"
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
        <div v-for="i of 10" :key="i"
             class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3.5 flex gap-3 mb-2">
          <div class="w-16 min-w-16 h-16 rounded-2xl bg-grey-normal-active shadow-tag-logo flex items-center justify-center
                relative overflow-hidden">
            <img class="w-15" src="~@/assets/logo-v.svg" alt="">
          </div>
          <div class="flex-1">
            <div class="flex gap-2 items-center">
              <span class="text-grey-normal text-h2 font-bold leading-6">LATC</span>
              <img class="w-15" src="~@/assets/icons/icon-circle-x.svg" alt="">
            </div>
            <div class="whitespace-pre-line text-grey-normal text-h5 mt-1">
              Look at the crowd <br>
              Biden stands no chance
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
