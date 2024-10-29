<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, onMounted, provide, ref, watch} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useRoute } from "vue-router";
import { getCommunityDetail, trade, getIpshareInfo, newCommerce } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithETHAfterFee, getReceivedAmountSellETHAfterFee, getTokenInfo,
  buyToken, sellToken, getUserTokenInfo,
  getBuyAmountUseEth, getSellAmountUseToken
 } from '@/utils/pump'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore } from "@/stores/common";
import { handleErrorTip, notify } from "@/utils/notify";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { OperateType, useTweet } from "@/composables/useTweet";
import { useCurationStore } from "@/stores/curation";
import { ethers } from "ethers";
import emitter from "@/utils/emitter";
import AmountProgressBar from "@/views/buy-sell/AmountProgressBar.vue";
import Kline from "@/views/buy-sell/Kline.vue";

const comStore = useCommunityStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const tradeType = ref('buy')
const route = useRoute()
const tokenInfo = ref()
const trading = ref(false)
const sellsman = ref()
const showFillInfo = ref(false)
const { preCheckCuration, userTweet } = useTweet();

const payEth = ref()
const sellAmount = ref()
const {replaceEmptyProfile} = useAccount()

const account = computed(() => {
  return accStore.getAccountInfo
})

watch(() => accStore.ethConnectAddress, (val) => {
  updateUserTokenInfo()
})

const receiveAmount = ref()
const receiveEth = ref()

const maxSlippage = ref(5)
const tokenBalance = ref(0)
const ethBalance = ref(0)
const listed = computed(() => {
  const listed = comStore.currentSelectedCommunity?.listed
  if (listed) {
    maxSlippage.value = 1
  }
  return listed
})

const {
  contentRef,
  showClear,
  contentEl,
  contentInput,
  getBlur,
  onPaste,
  formatElToTextContent,
  leftWordsLength
} = useCreateTweet(240)

const isPostTweet = ref(false)

const percentage = ref(0)
provide('percentage', percentage)
watch([() => percentage.value, () => ethBalance.value, () => tokenBalance.value], () => {
  if(tradeType.value==='buy') payEth.value = (ethBalance.value * percentage.value / 100).toFixed(8)
  if(tradeType.value==='sell') sellAmount.value = (tokenBalance.value * percentage.value / 100).toFixed(8)
}, {immediate: true})

watch(() => tradeType.value, () => {
  percentage.value = 0
})

watch(payEth, (val) => {
  updateBuyAmount(val)
})

watch(sellAmount, (val) => {
  updateSellAmount(val)
})

const updateBuyAmount = debounce(async (val: any) => {
  if (!val) return;
  showFillInfo.value = false
  const amount = ethers.parseEther(val.toString())

 try {
  if (listed.value) {
    const receive = await getBuyAmountUseEth(comStore.currentSelectedCommunity!.token, amount)
    receiveAmount.value = receive
  }else {
   const receive = await getBuyAmountWithETHAfterFee(comStore.currentSelectedCommunity?.token, amount)
   receiveAmount.value = receive
  }
 } catch (error) {
    console.log(33, error)
    receiveAmount.value = '0.00'
 }
}, 500)

const updateSellAmount = debounce(async (val: any) => {
  try {
    if (!val) return;
    showFillInfo.value = false
    const amount = ethers.parseEther(val.toString())
    if (listed.value) {
      const receive = await getSellAmountUseToken(comStore.currentSelectedCommunity!.token, amount)
      receiveEth.value = receive
    }else {
      const receive = await getReceivedAmountSellETHAfterFee(comStore.currentSelectedCommunity?.token, amount)
      receiveEth.value = receive
    }
  } catch (error) {
    receiveEth.value = '0.00'
  }
}, 500)

async function checkTweet() {
  if (isPostTweet.value) {
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      isPostTweet.value = false
      return;
    }
    // else if (!account.steemId || account.steemId.length == 0) {
    //   modalStore.setModalVisible(true, GlobalModalType.Register)
    //   isPostTweet.value = false
    //   return;
    // }

    if (ethers.isAddress(accStore.getAccountInfo.ethAddr)) {
      const ipshare: any = await getIpshareInfo(accStore.getAccountInfo.ethAddr);
      accStore.ipshare = ipshare;
    }
    if (!accStore.ipshare.ethAddr) {
      modalStore.setModalVisible(true, GlobalModalType.CreateIPShare)
      isPostTweet.value = false
    }
  }
}

async function confirm() {
  // check wallet connect
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  if (tradeType.value === 'buy') {
    if (!payEth.value) {
      showFillInfo.value = true
      return
    }
    // check eth balance
    if (ethBalance.value < payEth.value) {
      notify({message: 'Insufficient ETH balance'})
      return
    }
  }else {
    if (!sellAmount.value) {
      showFillInfo.value = true
      return
    };
    // check token balance
    if (tokenBalance.value < sellAmount.value) {
      notify({message: 'Insufficient token balance'})
      return
    }
  }

  if (isPostTweet.value){
    if (leftWordsLength.value < 0){
      return;
    }
    trading.value = true
    if (!(await preCheckCuration(OperateType.TWEET))) {
      return;
    }
    let content = formatElToTextContent(contentRef.value)
    newCommerce(content, useAccountStore().getAccountInfo.twitterId, useCommunityStore().currentSelectedCommunity!.tick!, useCommunityStore().currentSelectedCommunity!.token!).catch(console.error);

    // userTweet(content, comStore.currentSelectedCommunity!.tick).catch(handleErrorTip)
  }

  try{
    trading.value = true
    const token = comStore.currentSelectedCommunity
    if (!token) return;
    if (tradeType.value === 'buy') {
      if (!payEth.value) return

      const hash = await buyToken(token!.token, receiveAmount.value, BigInt(payEth.value * 1e18), sellsman.value, listed.value!, Math.ceil(maxSlippage.value * 100));
      if (hash) {
        payEth.value = undefined
        receiveAmount.value = undefined
        trade(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, hash, useCurationStore().currentSelectedTweet?.commerceId, comStore.currentSelectedCommunity!.token).catch()
        emitter.emit('newTrade')
        updateUserTokenInfo()
      }else{
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }else {
      if (!sellAmount.value) return;
      const hash = await sellToken(token!.token, BigInt(sellAmount.value * 1e18), receiveEth.value, sellsman.value, listed.value!, Math.ceil(maxSlippage.value * 100))
      if (hash) {
        sellAmount.value = undefined
        receiveEth.value = undefined
        trade(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, hash, useCurationStore().currentSelectedTweet?.commerceId, comStore.currentSelectedCommunity!.token).catch()

        emitter.emit('newTrade')
        updateUserTokenInfo()
      }else {
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }
  } catch (e) {
    handleErrorTip(e)
  } finally {
    trading.value = false
  }
}

async function updateUserTokenInfo () {
  try {
    if (ethers.isAddress(accStore.ethConnectAddress)) {
      let info = await getUserTokenInfo(comStore.currentSelectedCommunity!.token, accStore.ethConnectAddress);
      tokenBalance.value = info.balance;
      ethBalance.value = info.ethBalance;
    }
  } catch (error) {
    console.error('get users token info fail', error)
  }
}

onMounted(async () => {
  const tick = route.params.id as string
  if (!comStore.currentSelectedCommunity?.tick || comStore.currentSelectedCommunity?.tick != tick) {
    if (comStore.currentSelectedCommunity?.tick != tick) {
      comStore.currentSelectedCommunity = null;
    }
    let community = (await getCommunityDetail(tick)) as Community
    community = (await getTokenInfo([community]))[0]
    comStore.currentSelectedCommunity = community
  }
  sellsman.value = route.params.sellsman
  updateUserTokenInfo()
})
</script>

<template>
  <div class="h-full overflow-hidden flex flex-col gap-3">
    <BackHeader class="px-3">
      <template #title>
        <div class="text-lg font-semibold text-black-19">
          1000{{ comStore.currentSelectedCommunity?.tick }}/USDT
        </div>
      </template>
      <template #right>
        <button @click="$router.push('/tag-detail/' + comStore.currentSelectedCommunity?.tick)" class="absolute top-4 right-3 h-8 w-8 min-w-8 bg-white rounded-full flex items-center justify-center">
          <img class="rounded-full" :src="comStore.currentSelectedCommunity?.logo" alt="" srcset="">
        </button>
      </template>
    </BackHeader>
    <div
      class="flex-1 overflow-auto px-3 pb-3 flex flex-col gap-2"
      id="trade-record-scroller"
    >
      <div class="bg-white py-5 px-4 rounded-2xl flex flex-col gap-3">
        <div
          class="flex rounded-full overflow-hidden h-9 text-white bg-grey-light-active text-h5"
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
              v-model="payEth"
              type="number"
              class="bg-transparent h-full flex-1 text-h3"
            />
            <span class="text-h5 whitespace-nowrap">$ ETH</span>
          </div>
          <AmountProgressBar/>
          <div class="text-right text-sm">
            Balance: {{ formatAmount(ethBalance) }}
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5"
              >Receive ${{ comStore.currentSelectedCommunity?.tick }}</span
            >
            <span class="text-h3">{{ formatAmount(receiveAmount?.toString() / 1e18) }}</span>
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
              class="bg-transparent h-full flex-1 w-[120px] text-h3"
            />
            <span class="text-h5 whitespace-nowrap min-w">$ {{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <AmountProgressBar/>
          <div class="text-sm flex justify-end">
            Balance: {{ formatAmount(tokenBalance) }}
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5">Receive $ETH</span>
            <span class="text-h3">{{ formatAmount(receiveEth?.toString() / 1e18) }}</span>
          </div></template
        >
        <div class="flex items-center justify-between">
          <div class="font-light text-base">{{$t('buyAndSell.setMaxSlippage')}}</div>
          <div class="w-[100px] flex items-center justify-between border-[1px] border-grey-light-active rounded-lg h-9 px-3">
            <div class="flex-1 flex items-center gpa-1">
              <input class="w-12 overflow-hidden text-right text-orange-normal" type="number" v-model="maxSlippage">
              <span class="text-orange-normal">%</span>
            </div>
            <div class="flex flex-col gap-1 ml-4">
              <button @click="maxSlippage+=1">
                <img class="w-2" src="~@/assets/icons/icon-input-add.svg" alt="">
              </button>
              <button :disabled="maxSlippage<=0" @click="maxSlippage-=1">
                <img class="w-2 transform rotate-180" src="~@/assets/icons/icon-input-add.svg" alt="">
              </button>
            </div>
          </div>
        </div>
        <div v-show="isPostTweet" class="border-[1px] border-grey-c9 rounded-xl">
          <div class="flex items-center gap-2 px-3 pt-3">

            <img
              class="h-6 w-6 min-w-6 rounded-full"
              :src="account?.profile"
              @error="replaceEmptyProfile"
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
            {{ $t('curation.tweetWithTickTip', {tick: "$" + comStore.currentSelectedCommunity?.tick}) }}
            </div>
            <div class="text-right">
            {{ leftWordsLength }}
            </div>
          </div>
        </div>
        <div v-if="false" class="flex justify-center">
          <el-radio-group v-model="isPostTweet" @change="checkTweet" class="c-radio gap-8">
            <el-radio :value="false">None</el-radio>
            <el-radio :value="true">
              <div class="flex items-center gap-1.5">
                <span>Blink</span>
                <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
                  <button @click.stop class="">
                    <img class="w-4" src="~@/assets/icons/icon-warning-primary.svg" alt="">
                  </button>
                  <template #content>
                    <div class="text-white px-3 py-1 max-w-[200px] font-medium">{{  $t('buyAndSell.blinkTip') }}</div>
                  </template>
                </el-tooltip>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
        <button
          class="w-full h-12 rounded-full bg-gradient-primary text-white text-h5 flex items-center justify-center gap-2"
          @click="confirm"
          :disabled="trading"
        >
          <span>{{ (accStore.ethConnectAddress ? (listed ? "Confirm(listed)" : "Confirm"): 'Connect') }}</span>
          <i-ep-loading v-show="trading" class="animate-spin" />
        </button>
        <div v-if="showFillInfo" class="text-sm text-red-e6 text-center">
          Please complete the amount
        </div>
      </div>
<!--      <KChart v-if="comStore.currentSelectedCommunity?.tick" :tick="comStore.currentSelectedCommunity?.tick"/>-->
      <Kline v-if="comStore.currentSelectedCommunity?.tick" :tick="comStore.currentSelectedCommunity?.tick"/>
      <RecordList v-if="comStore.currentSelectedCommunity?.token" />
    </div>
  </div>
</template>

<style scoped></style>
