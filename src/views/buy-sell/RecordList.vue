<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import { getTokenTradeList } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import type { TokenTrade } from "@/types";
import { formatAddress, formatAmount, formatPastTime, parseTimestamp } from "@/utils/helper";
import { handleErrorTip } from "@/utils/notify";
import emitter from "@/utils/emitter";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const comStore = useCommunityStore()
const listData = ref<TokenTrade []>([])
const scroller = document.querySelector('#trade-record-scroller')

function tradeTime (token: TokenTrade) {
  return formatPastTime(token.timestamp as number)
}

const onLoad = async () => {
  if(finished.value || loading.value || listData.value.length == 0) return
  loading.value = true
  try{
    const list = (await getTokenTradeList(comStore.currentSelectedCommunity!.token, Math.floor((listData.value.length - 1) / 30) + 1)) as TokenTrade[]
    listData.value = listData.value.concat(list)
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }

};

const onRefresh = async () => {
  try{
    if (!comStore.currentSelectedCommunity?.token) {
      return;
    }
    
    finished.value = false;
    const list = await getTokenTradeList(comStore.currentSelectedCommunity!.token)
    listData.value = list as TokenTrade[]
    if (listData.value.length < 30) {
      finished.value = true;
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
};

onMounted(() => {
  onRefresh()
  emitter.on('newTrade', onRefresh);
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
        <div class="grid grid-cols-4 gap-x-2 text-h5 h-10 items-center">
          <span class="col-span-1 text-left">Address</span>
          <span class="col-span-1 text-center">Buy/Sell</span>
          <span class="col-span-1 text-center">${{ comStore.currentSelectedCommunity?.tick }}</span>
          <span class="col-span-1 text-right">$ETH</span>
        </div>

        <div class="flex justify-center items-center h-full my-20 py-10" v-if="listData.length === 0">
          No trade data
        </div>
        <div v-else class="grid grid-cols-4 gap-x-2 h-8 items-center text-h4"
             v-for="(token, i) of listData" :key="i">
          <div class="col-span-1 truncate flex items-center gap-1">
            <!-- <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt=""> -->
            <span class="truncate">{{ formatAddress(token.trader, 5, 4) }}</span>
          </div>
          <span class="col-span-1 text-center" :class="token.isBuy?'text-green-34':'text-red-normal'">
            {{ token.isBuy ? 'Buy' : "Sell" }} {{ formatPastTime(token.timestamp as number) }}
          </span>
          <span class="col-span-1 text-center">{{ formatAmount((token.amount as any)) }}</span>
          <span class="col-span-1 text-right">{{ formatAmount((token.ethAmount as any)) }}</span>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
