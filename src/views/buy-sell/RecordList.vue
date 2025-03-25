<script setup lang="ts">
import {onMounted, ref} from "vue";
import { getTokenTradeList } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import type { TokenTrade } from "@/types";
import { formatAddress, formatAmount, formatPastTime } from "@/utils/helper";
import { handleErrorTip } from "@/utils/notify";
import emitter from "@/utils/emitter";
import { useTools } from "@/composables/useTools";
import Kline from "@/views/buy-sell/Kline.vue";

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const comStore = useCommunityStore()
const listData = ref<TokenTrade []>([])
const scroller = document.querySelector('#trade-record-scroller')
const { onCopy } = useTools()

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
  <div>
    <div v-if="comStore.currentSelectedCommunity?.tick"
         class="w-full web:hidden min-w-[320px] mb-2">
      <Kline v-if="!comStore.currentSelectedCommunity?.listed" :tick="comStore.currentSelectedCommunity?.tick" chart-id="k-line-chart2"/>
      <iframe v-else :src="`https://dexscreener.com/bsc/${comStore.currentSelectedCommunity?.pair}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=1&loadChartSettings=0&chartDefaultOnMobile=1&chartTheme=light&theme=light&chartStyle=1&chartType=usd&interval=15`" 
        frameborder="0" class="w-full h-[24rem]"></iframe>
    </div>
    <div class="bg-white rounded-2xl p-3">
      <div class="grid grid-cols-4 gap-x-2 text-h5 h-10 items-center">
        <span class="col-span-1 text-left">{{$t('address')}}</span>
        <span class="col-span-1 text-center">{{ $t('buy') }}/{{$t('sell')}}</span>
        <span class="col-span-1 text-center">${{ comStore.currentSelectedCommunity?.tick }}</span>
        <span class="col-span-1 text-right">$BNB</span>
      </div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                        :loading-text="$t('loading')"
                        :lpulling-text="$t('pullToRefreshData')"
                        :loosing-text="$t('releaseToRefresh')">
        <van-list :loading="loading"
                  :finished="finished"
                  :immediate-check="false"
                  :finished-text="$t('noMore')"
                  :scroller="scroller"
                  :offset="50"
                  @load="onLoad">

          <div class="flex justify-center items-center h-full my-20 py-10" v-if="listData.length === 0">
            {{$t('buyAndSell.noTradeData')}}
          </div>
          <div v-else class="grid grid-cols-4 gap-x-2 h-8 items-center text-h4"
               v-for="(token, i) of listData" :key="i">
            <div class="col-span-1 truncate flex items-center gap-1 cursor-pointer" @click="onCopy(token.trader)">
              <!-- <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt=""> -->
              <span class="truncate">{{ formatAddress(token.trader, 5, 4) }}</span>
            </div>
            <span class="col-span-1 text-center" :class="token.isBuy?'text-green-34':'text-red-normal'">
            {{ token.isBuy ? $t('buy') : $t('sell') }} {{ formatPastTime(token.timestamp as number) }}
          </span>
            <span class="col-span-1 text-center">{{ formatAmount((token.amount as any)) }}</span>
            <span class="col-span-1 text-right">{{ formatAmount((token.ethAmount as any)) }}</span>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>
  </div>
</template>

<style scoped>

</style>
