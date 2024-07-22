<script setup lang="ts">
import {ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const curatorsList = ref([])

const onLoad = async () => {
}
const onRefresh = async () => {
}
</script>

<template>
  <div class="max-h-[80vh] overflow-auto no-scroll-bar">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full"
                      loading-text="Loading"
                      pulling-text="Pull to refresh data"
                      loosing-text="Release to refresh">
      <van-list :loading="loading"
                :finished="finished"
                :immediate-check="false"
                finished-text="No more"
                :offset="50"
                @load="onLoad">
        <div v-for="i of 10" :key="i"
             class="bg-white rounded-2xl py-3 px-3.5 flex gap-3 mb-2">
          <div class="flex-1 flex items-center gap-2">
            <img class="w-6 h-6" src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <span class="text-grey-normal text-h5">Username</span>
            <span class="text-grey-8d font-normal">@asmonmy</span>
          </div>
          <div class="whitespace-pre-line text-grey-normal font-normal">
            2 minutes ago
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
