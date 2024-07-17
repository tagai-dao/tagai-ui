<script setup lang="ts">
import {onMounted, ref} from "vue";
import { getTokenTradeList } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import type { TokenTrade } from "@/types";
import { formatAddress, formatAmount } from "@/utils/helper";
import { handleErrorTip } from "@/utils/notify";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const comStore = useCommunityStore()
const listData = ref<TokenTrade []>([])
const scroller = document.querySelector('#trade-record-scroller')
const onLoad = () => {
  if(loading.value || finished.value) return
  loading.value = true
  
};

const onRefresh = async () => {
  try{
    if (refreshing.value = true || !comStore.currentSelectedCommunity?.token) {
      return;
    }
    refreshing.value = true;
    const list = await getTokenTradeList(comStore.currentSelectedCommunity!.token)
    listData.value = list as TokenTrade[]
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

onMounted(() => {
  onRefresh()
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
          <span class="col-span-2 pl-8">Address</span>
          <span class="col-span-1 text-center">buy/sell</span>
          <span class="col-span-1 text-center">$BTC</span>
          <span class="col-span-1 text-right">${{ comStore.currentSelectedCommunity?.tick }}</span>
        </div>
        <div class="grid grid-cols-5 gap-x-2 h-8 items-center text-h4"
             v-for="(token, i) of listData" :key="i">
          <div class="col-span-2 truncate flex items-center gap-1">
            <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt="">
            <span class="truncate">{{ formatAddress(token.trader) }}</span>
          </div>
          <span class="col-span-1 text-center">{{ token.isBuy ? 'Buy' : "Sell" }}</span>
          <span class="col-span-1 text-center">{{ formatAmount((token.ethAmount as any) / 1e18) }}</span>
          <span class="col-span-1 text-right">{{ formatAmount((token.amount as any) / 1e18) }}</span>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
