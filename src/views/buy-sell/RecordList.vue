<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from "vue";
import { getTokenTradeList } from "@/apis/api";
import { useCommunityStore } from "@/stores/community";
import type { TokenTrade } from "@/types";
import { formatAddress, formatAmount, formatPastTime } from "@/utils/helper";
import { handleErrorTip } from "@/utils/notify";
import emitter from "@/utils/emitter";
import { useTools } from "@/composables/useTools";
import { useChainStore } from '@/stores/chain'
import emptyProfile from '@/assets/icons/icon-default-avatar-v2.png'
import AccountOriginBadges from '@/components/common/AccountOriginBadges.vue'

const chainStore = useChainStore()
const nativeSymbol = computed(() => chainStore.nativeCurrency.symbol)

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

const isRegisteredTrader = (trade: TokenTrade) => Boolean(trade.twitterId)

const traderAvatar = (trade: TokenTrade) =>
  trade.profile?.replace('normal', '200x200') ||
  (trade.twitterId ? `https://profile-images.heywallet.com/${trade.twitterId}` : emptyProfile)

const traderName = (trade: TokenTrade) =>
  trade.twitterUsername ? `@${trade.twitterUsername}` : (trade.username || formatAddress(trade.trader, 5, 4))

const quoteSymbol = (trade: TokenTrade) => {
  const symbol = trade.quoteSymbol || nativeSymbol.value
  if (symbol === 'WBNB' && nativeSymbol.value === 'BNB') return 'BNB'
  if (symbol === 'WETH' && nativeSymbol.value === 'ETH') return 'ETH'
  return symbol
}

const replaceEmptyProfile = (event: Event) => {
  const image = event.target as HTMLImageElement
  image.onerror = null
  image.src = emptyProfile
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
onUnmounted(() => {
  emitter.off('newTrade', onRefresh);
})
</script>

<template>
  <div>
    <div class="bg-white rounded-2xl p-3">
      <div class="grid grid-cols-4 gap-x-2 text-h5 h-10 items-center">
        <span class="col-span-1 text-left">{{$t('address')}}</span>
        <span class="col-span-1 text-center">{{ $t('buy') }}/{{$t('sell')}}</span>
        <span class="col-span-1 text-center">${{ comStore.currentSelectedCommunity?.tick }}</span>
        <span class="col-span-1 text-right">
          {{ comStore.currentSelectedCommunity?.isImport ? 'Quote' : `$${nativeSymbol}` }}
        </span>
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
          <div v-else class="grid grid-cols-4 gap-x-2 min-h-9 items-center text-h4"
               v-for="(token, i) of listData" :key="i">
            <div class="col-span-1 truncate flex items-center gap-1 cursor-pointer" :title="token.trader" @click="onCopy(token.trader)">
              <img
                v-if="isRegisteredTrader(token)"
                class="h-5 w-5 min-w-5 rounded-full object-cover"
                :src="traderAvatar(token)"
                :alt="traderName(token)"
                referrerpolicy="no-referrer"
                @error="replaceEmptyProfile"
              >
              <span class="truncate">{{ traderName(token) }}</span>
              <AccountOriginBadges :sources="token.accountSources" :account-type="token.accountType" :wallet-type="token.walletType" :eth-addr="token.trader" />
            </div>
            <span class="col-span-1 text-center" :class="token.isBuy?'text-green-34':'text-red-normal'">
            {{ token.isBuy ? $t('buy') : $t('sell') }} {{ formatPastTime(token.timestamp as number) }}
          </span>
            <span class="col-span-1 text-center">{{ formatAmount((token.amount as any)) }}</span>
            <span class="col-span-1 text-right">
              {{ formatAmount((token.ethAmount as any)) }}
              <span v-if="comStore.currentSelectedCommunity?.isImport" class="text-grey-64 text-xs">
                {{ quoteSymbol(token) }}
              </span>
            </span>
          </div>
        </van-list>
      </van-pull-refresh>
    </div>
  </div>
</template>

<style scoped>

</style>
