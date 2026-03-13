<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import { getHoldingList, getImportedCommunityInfo } from '@/apis/api'
import { useAccountStore } from "@/stores/web3";
import { handleErrorTip } from "@/utils/notify";
import { useModalStore, useStateStore } from "@/stores/common";
import { GlobalModalType, type Community } from "@/types";
import { formatAmount, formatPrice } from "@/utils/helper";
import { getImportTokenOnchainInfo, getTokenOnchainInfo } from "@/utils/pump";
import { useRouter } from "vue-router";
import errCode from "@/errCode";
import TransferTokenModal from "@/components/common/TransferTokenModal.vue";
import BuyAndSellView from "@/views/buy-sell/BuyAndSellView.vue";
import { useAccount } from "@/composables/useAccount";
import { getTokenBalances } from "@/utils/web3";

enum ModalType {
  transfer,
  trade
}

const refreshing = ref(false)
const loading = ref(false)
const finished = ref(false)
const accStore = useAccountStore()
const router = useRouter()
const currentHolding = ref<any>(null)
const showModal = ref(false)
const modalType = ref(ModalType.transfer)
const { ethPrice } = useStateStore()
const showingNoEth = computed(() => {
  return !accStore.getAccountInfo.ethAddr
})
let currentLenth = 0
const { updateHoldingValue } = useAccount()

const scroller = document.querySelector('#profile-tab-scroller')
const onLoad = async () => {
  if(finished.value || refreshing.value || currentLenth == 0 || showingNoEth.value) return
  try{
    loading.value = true
    let list: any = await getHoldingList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!, Math.floor((currentLenth - 1) / 30) + 1)
    const priceList = await getTokenOnchainInfo(
      list.map((item: any) => item.token),
      generateTokenVersions(list),
      generatePairMap(list)
    )
      accStore.tokenHoldingList = accStore.tokenHoldingList.concat(list.map((item: any) => ({
        ...item,
        price: priceList[item.token]?.price
      }))).sort((a: any, b: any) => (b.amount?.toString() as any) * b.price - (a.amount?.toString() as any) * a.price)
      updateHoldingValue(accStore.tokenHoldingList);
      currentLenth += list.length;
    if (list.length == 0) finished.value = true;
  } catch (e) {
    console.log('onLoad error', e)
    handleErrorTip(e)
  } finally {
    loading.value = false
  }
};

const onRefresh = async () => {
  if (showingNoEth.value) return;
  try{
    refreshing.value = true
    finished.value = false;
    // 获取外部导入代币的余额
    let importedCommunities: any = await getImportedCommunityInfo();
    let importedBalanceList: any = await getTokenBalances(importedCommunities.map((item: any) => item.token));
    let importedPriceList: any =(importedCommunities && importedCommunities.length > 0) ? (await getImportTokenOnchainInfo(importedCommunities)) : []

    importedCommunities = importedCommunities.map((item: any) => ({
      community: item,
      account: accStore.getAccountInfo.ethAddr,
      amount: importedBalanceList[item.token],
      token: item.token,
      tick: item.tick
    }))


    let list: any = await getHoldingList(accStore.getAccountInfo.twitterId, accStore.getAccountInfo.ethAddr!)
    if (list && list.length > 0) {
      const priceList = await getTokenOnchainInfo(
        list.map((item: any) => item.token),
        generateTokenVersions(list),
        generatePairMap(list)
      )
      accStore.tokenHoldingList = list.map((item: any) => ({
        ...item,
        price: priceList[item.token]?.price
      })).concat(importedCommunities.map((item: any) => ({
        ...item,
        price: importedPriceList[item.token]?.price
      }))).sort((a: any, b: any) => (b.amount?.toString() as any) * b.price - (a.amount?.toString() as any) * a.price)
    
      updateHoldingValue(accStore.tokenHoldingList);
    }
    if (list.length === 0) {
      finished.value = true
    }
    currentLenth = list.length;
  } catch(e) {
    console.error(6234, e)
    handleErrorTip(e)
    if (e === errCode.InvalidAccessToken) {
      accStore.clear();
      router.replace('/')
    }
  } finally {
    refreshing.value = false
  }
};

const generateTokenVersions = (list: any) => {
  if (!list || list.length === 0) return {};
  let versions: any = {};
  for(let item of list) {
    versions[item.token] = item.community?.version ?? 4;
  }
  return versions;
}

const generatePairMap = (list: any) => {
  if (!list || list.length === 0) return {};
  const pairs: Record<string, string> = {};
  for (const item of list) {
    const pair = item.community?.pair ?? item.pair;
    const version = item.community?.version ?? item.version ?? 4;
    if (item.token && pair && version === 7) {
      pairs[item.token] = pair;
    }
  }
  return pairs;
}

function transferTick(holding: any) {
  modalType.value = ModalType.transfer
  showModal.value = true
  currentHolding.value = holding
}

function onTrade(holding: any) {
  modalType.value = ModalType.trade
  showModal.value = true
  currentHolding.value = holding
}

function close(confirmed: boolean) {
  showModal.value = false;
  modalType.value = ModalType.transfer
  if (confirmed) {
    onRefresh();
  }
}

onMounted(async () => {
  onRefresh()
})

</script>

<template>
  <div class="h-full">
    <template v-if="showingNoEth">
      <div  class="p-3 bg-white rounded-2xl mx-3 text-center">
        <button @click="useModalStore().setModalVisible(true, GlobalModalType.BondEth)" class="h-12 w-full rounded-full bg-gradient-primary text-h3 text-white web:max-w-[310px]">
          {{$t('profileView.bindEthAddress')}}
        </button>
      </div>
      <div class="flex justify-center py-6 w-full">
        <img src="~@/assets/images/empty-data.svg" alt="">
      </div>
    </template>
    <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh"
                      class="min-h-full h-full overflow-auto"
                      :loading-text="$t('loading')"
                      :lpulling-text="$t('pullToRefreshData')"
                      :loosing-text="$t('releaseToRefresh')">
      <van-list class="px-3"
                :loading="loading"
                :finished="finished"
                :immediate-check="false"
                :finished-text="accStore.tokenHoldingList.length == 0?'':$t('noMore')"
                :scroller="scroller"
                :offset="50"
                @load="onLoad">
        <div v-if="accStore.tokenHoldingList.length == 0 && !refreshing"
          class="flex justify-center py-6 w-full">
          <img src="~@/assets/images/empty-data.svg" alt="">
        </div>
        <div v-for="(holding, i) of accStore.tokenHoldingList" :key="i"
             v-show="holding.community"
             @click="$router.push('/tag-detail/' + holding.community.tick)"
             class="bg-grey-fa border-[1px] border-white rounded-2xl py-3 px-3 flex items-center gap-3 mb-2">
          <div class="w-10 min-w-10 h-10 rounded-full bg-grey-normal-active shadow-tag-logo
                      flex items-center justify-center relative overflow-hidden">
            <img class="w-15" :src="holding.community?.logo" alt="">
          </div>
          <div class="flex-1">
            <div class="flex gap-2 items-center">
              <span class="text-grey-normal text-h3 leading-5">{{ holding.community?.tick }}</span>
            </div>
            <div class="whitespace-nowrap text-h5 leading-4 text-gradient bg-gradient-primary opacity-70">
              {{ formatAmount((holding.amount?.toString() as any) / 1e18) }}
            </div>
          </div>
          <div class="flex flex-col justify-center items-end">
            <div class="text-grey-normal text-h3">
              {{ formatPrice((holding.price ?? 0) * (holding.amount?.toString() as any) * ethPrice / 1e18) }}
            </div>
            <div class="whitespace-nowrap text-h5 leading-4 text-gradient bg-gradient-primary opacity-70">
              {{ formatPrice((holding.price ?? 0) * ethPrice) }}
            </div>
          </div>
          <div class="gap-2 h-full flex flex-col justify-between">
            <img src="~@/assets/icons/btn-transfer.svg" @click.stop="transferTick(holding)"
                    class="h-5 text-white text-h5">
            </img>
            <img v-if="!holding.community?.isImport" src="~@/assets/icons/btn-swap.svg" @click.stop="onTrade(holding)"
                  class="h-5 text-white text-h5">
            </img>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
    <el-dialog v-model="showModal"
               :close-on-click-modal="showModal"
               :close-on-press-escape="showModal"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
        <TransferTokenModal v-if="modalType===ModalType.transfer"
          :community="currentHolding.community as Community" 
          :balance="currentHolding.amount"
          @close="close"/>
        <BuyAndSellView v-if="modalType===ModalType.trade" :tick="currentHolding.community?.tick"/>
    </el-dialog>
  </div>
</template>

<style scoped>

</style>
