<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, onMounted, ref, watch} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useRoute } from "vue-router";
import { getCommunityDetail, getTokenTradeList } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithBTCAfterFee, getReceivedAmountSellBTCAfterFee, getTokenInfo } from '@/utils/pump'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore } from "@/stores/common";

const comStore = useCommunityStore()
const accStore = useAccountStore()
const tradeType = ref('buy')
const route = useRoute()
const tokenInfo = ref()
const trading = ref(false)

const payBtc = ref()
const sellAmount = ref()

const account = computed(() => {
  return accStore.getAccountInfo
})

const receiveAmount = ref()
const receiveBtc = ref()

const {
  contentRef,
  showClear,
  contentEl,
  contentInput,
  getBlur,
  onPaste,
} = useCreateTweet()

const isPostTweet = ref(false)

watch(payBtc, (val) => {
  updateBuyAmount(val)
})

watch(sellAmount, (val) => {
  updateSellAmount(val)
})

const updateBuyAmount = debounce(async (val: any) => {
  const amount = BigInt(val * 1e18)
  
 try {
   const receive = await getBuyAmountWithBTCAfterFee(comStore.currentSelectedCommunity?.token, amount)
   receiveAmount.value = formatAmount(receive.toString() / 1e18)
 } catch (error) {
    console.log(33, error)
 }
}, 500)

const updateSellAmount = debounce(async (val: any) => {
  try {
    const amount = BigInt(val * 1e18)
    const receive = await getReceivedAmountSellBTCAfterFee(comStore.currentSelectedCommunity?.token, amount)
    receiveBtc.value = formatAmount(receive.toString() / 1e18)
  } catch (error) {
    receiveBtc.value = '0.00'
  }
}, 500)

async function confirm() {
  // checkout login
  if (!accStore.getAccountInfo?.twitterId) {
    useModalStore().setModalVisible(true, GlobalModalType.Login)
    return;
  }
  // check wallet connect
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    useModalStore().setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  if (tradeType.value === 'buy') {

  }else {

  }
}

onMounted(async () => {
  if (!comStore.currentSelectedCommunity?.tick) {
    const tick = route.params.id as string
    const community = (await getCommunityDetail(tick)) as Community
    comStore.currentSelectedCommunity = community
  }
  tokenInfo.value = await getTokenInfo(comStore.currentSelectedCommunity.token)
})
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19">
          ${{ comStore.currentSelectedCommunity?.tick }}
        </div>
      </template>
    </BackHeader>
    <div
      class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2"
      id="trade-record-scroller"
    >
      <div class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-3">
        <div
          class="flex rounded-full overflow-hidden h-9 text-white bg-grey-normal text-h5"
        >
          <button
            class="h-full flex-1"
            :class="tradeType === 'buy' ? 'bg-gradient-primary' : ''"
            @click="tradeType = 'buy'"
          >
            Buy
          </button>
          <button
            class="h-full flex-1"
            :class="tradeType === 'sell' ? 'bg-gradient-primary' : ''"
            @click="tradeType = 'sell'"
          >
            Sell
          </button>
        </div>
        <template v-if="tradeType === 'buy'">
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center"
          >
            <span class="text-h5">Pay</span>
            <input
              v-model="payBtc"
              type="number"
              class="bg-transparent h-full flex-1 text-h3"
            />
            <span class="text-h5">$ BTC</span>
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5"
              >Receive ${{ comStore.currentSelectedCommunity?.tick }}</span
            >
            <span class="text-h3">{{ receiveAmount }}</span>
          </div>
        </template>
        <template v-else>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center"
          >
            <span class="text-h5">Sell</span>
            <input
              v-model="sellAmount"
              type="number"
              class="bg-transparent h-full flex-1 text-h3"
            />
            <span class="text-h5">$ {{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5"
              >Receive $BTC</span
            >
            <span class="text-h3">{{ receiveBtc }}</span>
          </div></template
        >

        <div v-show="isPostTweet" class="border-[1px] border-grey-c9 rounded-xl">
          <div class="flex items-center gap-2 px-3 pt-3">
            <img
              class="h-6 w-6 min-w-6 rounded-full"
              src="~@/assets/icons/icon-default-avatar.svg"
              alt=""
            />
            <span class="text-h3">{{ account?.twitterUsername }}</span>
          </div>
          <div class="max-h-[160px] overflow-hidden relative flex flex-col p-3">
            <div
              contenteditable
              class="outline-none flex-1 overflow-auto no-scroll-bar min-h-[56px] whitespace-pre-line text-lg z-10 relative"
              ref="contentRef"
              @input="contentInput"
              @blur="getBlur"
              @paste="onPaste"
              v-html="contentEl"
            ></div>
            <div
              v-if="!showClear"
              class="absolute top-3 left-3 text-14px leading-24px z-0 opacity-30"
            >
              写点 Trump 的内容，将被铭刻至链上，并根据社区互动获得奖励
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <el-radio-group v-model="isPostTweet" class="c-radio gap-8">
            <el-radio :value="false">None</el-radio>
            <el-radio :value="true">tweet & Earn</el-radio>
          </el-radio-group>
        </div>
        <button
          class="w-full h-12 rounded-full bg-gradient-primary text-white text-h5 flex items-center justify-center gap-2"
          @click="confirm"
          :disabled="tokenInfo?.listed"
        >
          <span>{{ tokenInfo?.listed ? 'Token lised' : 'Confirm' }}</span>
          <i-ep-loading v-show="trading" class="animate-spin" />
        </button>
      </div>
      <RecordList v-if="comStore.currentSelectedCommunity?.token" />
    </div>
  </div>
</template>

<style scoped></style>
