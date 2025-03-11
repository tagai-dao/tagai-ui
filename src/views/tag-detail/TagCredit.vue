<script setup lang="ts">
import { getHolderList } from '@/apis/api'
import { useTools } from '@/composables/useTools';
import { useCommunityStore } from '@/stores/community';
import { type TokenHoldingList } from '@/types';
import { formatAddress, formatAmount, sleep } from '@/utils/helper';
import { handleErrorTip } from '@/utils/notify';
import { onMounted, ref } from 'vue';

const comStore = useCommunityStore()
const refreshing = ref(false);
const loading = ref(false);
const finished = ref(false);

const holdingList = ref<TokenHoldingList[]>([]);
const { onCopy } = useTools()

async function onRefresh() {
  if (loading.value) return;
  refreshing.value = true;
  finished.value = false;
  try{
    let list: any = await getHolderList(comStore.currentSelectedCommunity!.token)
    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = list as TokenHoldingList[];
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    refreshing.value = false
  }
}

async function onLoad() {
  if (refreshing.value || finished.value || holdingList.value.length == 0) return;
  loading.value = true;
  try{
    let list: any = await getHolderList(comStore.currentSelectedCommunity!.token, Math.floor((holdingList.value.length - 1) / 30) + 1);

    if (list && list.length > 0) {
      list = list.map((h: any) => {
        return {
          community: comStore.currentSelectedCommunity,
          amount: h.amount.toString() / 1e18,
          ethAddr: h.holder
        }
      })
      holdingList.value = holdingList.value.concat(list as TokenHoldingList[]);
    }
    if (list.length < 30) {
      finished.value = true
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  while(!comStore.currentSelectedCommunity?.tick) {
    await sleep(0.3)
  }
  onRefresh()
})
</script>

<template>
  <div class="bg-white rounded-2xl p-3" v-if="comStore.currentSelectedCommunity?.tick">
    <div class="grid grid-cols-8 gap-x-2 text-h5 h-10 items-center">
      <span class="col-span-4 pl-8">{{ $t('account') }}</span>
      <span class="col-span-2">#{{ comStore.currentSelectedCommunity.tick }}</span>
      <span class="col-span-2 text-right">Credit</span>
    </div>
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
      :loading-text="$t('loading')"
      :lpulling-text="$t('pullToRefreshData')"
      :loosing-text="$t('releaseToRefresh')"
    >
      <van-list
        :loading="loading"
        :finished="finished"
        :immediate-check="false"
        :finished-text="$t('noMore')"
        :offset="50"
        @load="onLoad"
      >
        <div
          class="grid grid-cols-8 gap-x-2 h-8 items-center text-h4"
          v-for="(holder, i) of holdingList"
          :key="i"
        >
          <div class="col-span-4 truncate flex items-center gap-1">
            <span class="min-w-4">{{ i + 1 }}</span>
            <!-- <img class="w-4 h-4 min-w-4" src="~@/assets/icons/icon-default-avatar.svg" alt=""> -->
            <span @click.stop="onCopy(holder.ethAddr ?? '')" class="truncate font-mono cursor-pointer">{{ formatAddress(holder.ethAddr) }}</span>
          </div>
          <span class="col-span-2">{{ formatAmount(holder.amount) }}</span>
          <span class="col-span-2 text-right">{{ formatAmount(holder.amount) }}</span>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped></style>
