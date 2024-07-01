<script setup lang="ts">
import {ref} from "vue";
import TagListItem from "@/components/home/TagListItem.vue";

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
  <div class="px-3 min-h-full">
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
        <div class="flex items-center gap-1 px-3 mb-2">
          <span class="font-normal text-sm">流入 Coin 部署者的交易手续费</span>
          <el-popover popper-class="c-popper">
            <template #reference>
              <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
            </template>
            <template #default>
              <div class="bg-white rounded-xl p-2 shadow-popper-tip">tips</div>
            </template>
          </el-popover>
        </div>
        <button class="bg-gradient-primary h-14 w-full rounded-xl flex items-center justify-center gap-1 text-white mb-2">
          <span class="text-h2 mr-2">$ 3409.36</span>
          <img src="~@/assets/icons/icon-up.svg" alt="">
          <span>+2%</span>
        </button>
        <TagListItem v-for="i of 10" :key="i" @click="$router.push(`/tag-detail/${i}`)">
          <template #default-btn><div></div></template>
        </TagListItem>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
