<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import { getHoldingList } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const accStore = useAccountStore()
const showingNoEth = computed(() => {
  return !accStore.getAccountInfo.ethAddr
})

const scroller = document.querySelector('#profile-tab-scroller')
const onLoad = async () => {
  if(loading.value || finished.value || refreshing.value || accStore.tokenHoldingList.length == 0 || showingNoEth.value) return
  // loading.value = true
  try{
    loading.value = true
    let list: any = await getHoldingList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!, Math.floor((accStore.tokenHoldingList.length - 1) / 30) + 1)
    accStore.tokenHoldingList = accStore.tokenHoldingList.concat(list)
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
};

const onRefresh = async () => {
  if (refreshing.value || showingNoEth.value) return;
  try{
    refreshing.value = true
    finished.value = false;
    let list: any = await getHoldingList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!)
    if (list && list.length > 0) {
      accStore.tokenHoldingList = list
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch(e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

onMounted(async () => {
  onRefresh()
})

</script>

<template>
  <div class="h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
                      loading-text="Loading"
                      pulling-text="Pull to refresh data"
                      loosing-text="Release to refresh">
      <van-list class="px-3"
                :loading="loading"
                :finished="finished"
                :immediate-check="false"
                finished-text="No more"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div v-for="(holding, i) of accStore.tokenHoldingList" :key="i"
             class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3.5 flex gap-3 mb-2">
          <div class="w-16 min-w-16 h-16 rounded-2xl bg-grey-normal-active shadow-tag-logo flex items-center justify-center
                relative overflow-hidden">
            <img class="w-15" :src="holding.community.logo" alt="">
          </div>
          <div class="flex-1">
            <div class="flex gap-2 items-center">
              <span class="text-grey-normal text-h2 font-bold leading-6">{{ holding.community.tick }}</span>
              <!-- <img class="w-15" src="~@/assets/icons/icon-circle-x.svg" alt=""> -->
            </div>
            <div class="whitespace-pre-line text-grey-normal text-h5 mt-1">
              {{ holding.community.description }}
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
