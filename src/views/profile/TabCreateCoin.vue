<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import TagListItem from "@/components/home/TagListItem.vue";
import { getCreatedList } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";
import { getTokenInfo } from "@/utils/pump";
import { formatAmount, formatPrice } from "@/utils/helper";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType } from "@/types";

const accStore = useAccountStore()

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const listData = ref<number []>([])
const scroller = document.querySelector('#profile-tab-scroller')

const capturedFee = computed(() => {
  let captured: any = accStore.ipshare.totalCaptured
  if (typeof(captured) == 'string' || typeof(captured) === 'bigint') {
    // @ts-ignore
    return captured.toString() / 1e18
  }
  return captured
})

const onLoad = async () => {
  if(loading.value || finished.value || !accStore.getAccountInfo.ethAddr || accStore.createdTokenList.length == 0) return
  loading.value = false
};

const onRefresh = async () => {
  if (loading.value || !accStore.getAccountInfo.ethAddr) {
    return;
  }
  try{
    refreshing.value = true
    finished.value = false
    let list: any = await getCreatedList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!)
    if (list && list.length > 0) {
      list = await getTokenInfo(list)
      accStore.createdTokenList = list
      if (list.length < 30) finished.value = true
    }
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
  <div class="min-h-full h-full">
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
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
        <div v-if="accStore.ipshare.ethAddr" class="px-3">
          <div class="flex items-center gap-1 mb-2">
            <span class="font-normal text-sm">{{ $t('profileView.captureTitle') }}</span>
            <el-popover popper-class="c-popper">
              <template #reference>
                <img class="w-4" src="../../assets/icons/icon-warning-gray.svg" alt="">
              </template>
              <template #default>
                <div class="bg-white rounded-xl p-2 shadow-popper-tip">{{ $t('profileView.captureDesc') }}</div>
              </template>
            </el-popover>
          </div>
          <button class="bg-gradient-primary h-16 w-full rounded-xl flex items-center justify-center gap-1 text-white mb-2">
            <span class="text-h1 mr-2">{{ formatPrice(capturedFee * useStateStore().btcPrice) }}</span>
            <!-- <img src="~@/assets/icons/icon-up.svg" alt=""> -->
            <span class="text-sm">($BTC {{ formatAmount(capturedFee) }})</span>
          </button>
        </div>
        <div v-if="accStore.createdTokenList.length>0" class="px-3">
          <TagListItem v-for="(community, i) of accStore.createdTokenList" :key="i"
                       @click="$router.push(`/tag-detail/${community.tick}`)"
                       :community>
            <template #default-btn><div></div></template>
          </TagListItem>
        </div>
        <template v-else>
          <div class="p-3 bg-white rounded-2xl text-center mx-3">
            <button @click="useModalStore().setModalVisible(true, GlobalModalType.CreateCoin)" class="h-12 w-full rounded-full bg-gradient-primary text-h3 text-white web:max-w-[310px]">
              {{$t('profileView.createYourCoin')}}
            </button>
          </div>
          <div class="flex justify-center py-6 w-full">
            <img src="~@/assets/images/empty-data.svg" alt="">
          </div>
        </template>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>

</style>
