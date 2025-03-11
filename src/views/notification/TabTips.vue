<script setup lang="ts">
import {ref} from "vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref([
  {type: 'send', value: 1},
  {type: 'received', value: 1},
])
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
      <div class="bg-white p-4 rounded-2xl flex items-center gap-3 mb-2"
           v-for="(item, index) of listData" :key="index">
        <template v-if="item.type==='send'">
          <img class="h-10 w-10 min-h-10 rounded-full"
               src="~@/assets/icons/icon-tips-send.svg" alt="">
          <div class="flex-1 gap-1">
            <div class="text-lg font-medium">Send</div>
            <div class="text-base">to @donut_vrese</div>
            <div class="text-xs">2024年06月04日 下午01:05:26</div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="border-[1px] border-grey-d1 rounded-l-full rounded-r-xl p-0.5 flex items-center">
              <img class="h-6 w-6" src="~@/assets/icons/icon-default-coin.svg" alt="">
              <span class="text-black px-2 text-base">-20 STEEN</span>
            </div>
            <button class="bg-orange-fa rounded-md h-6 px-2">View</button>
          </div>
        </template>
        <template v-if="item.type==='received'">
          <img class="h-10 w-10 min-h-10 rounded-full"
               src="~@/assets/icons/icon-tips-received.svg" alt="">
          <div class="flex-1 gap-1">
            <div class="text-lg font-medium">Received</div>
            <div class="text-base">from @donut_vrese</div>
            <div class="text-xs">2024年06月04日 下午01:05:26</div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="border-[1px] border-grey-d1 rounded-l-full rounded-r-xl p-0.5 flex items-center">
              <img class="h-6 w-6" src="~@/assets/icons/icon-default-coin.svg" alt="">
              <span class="text-black px-2 text-base">+20 STEEN</span>
            </div>
            <button class="bg-orange-fa rounded-md h-6 px-2">View</button>
          </div>
        </template>
      </div>
    </van-list>
  </van-pull-refresh>
</template>

<style scoped>

</style>
