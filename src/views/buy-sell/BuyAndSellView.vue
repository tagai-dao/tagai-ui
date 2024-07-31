<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, onMounted, ref, watch} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import ChoseWallet from "@/components/login/ChoseWallet.vue";
import { useRoute } from "vue-router";
import { getCommunityDetail, trade } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithBTCAfterFee, getReceivedAmountSellBTCAfterFee, getTokenInfo,
  buyToken, sellToken
 } from '@/utils/pump'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore } from "@/stores/common";
import { handleErrorTip } from "@/utils/notify";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { OperateType, useTweet } from "@/composables/useTweet";
import { useCurationStore } from "@/stores/curation";

const comStore = useCommunityStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const tradeType = ref('buy')
const route = useRoute()
const tokenInfo = ref()
const trading = ref(false)
const sellsman = ref()
const needChoseWallet = ref(false)
const { preCheckCuration, userTweet } = useTweet();

const payBtc = ref()
const sellAmount = ref()
const {replaceEmptyProfile} = useAccount()

const account = computed(() => {
  return accStore.getAccountInfo
})

const receiveAmount = ref()
const receiveBtc = ref()

const maxSlippage = ref(5)

const {
  contentRef,
  showClear,
  contentEl,
  contentInput,
  getBlur,
  onPaste,
  formatElToTextContent,
  leftWordsLength
} = useCreateTweet(280 - (comStore.currentSelectedCommunity?.tick.length ?? 0) - 2)

const isPostTweet = ref(false)


watch(payBtc, (val) => {
  updateBuyAmount(val)
})

watch(sellAmount, (val) => {
  updateSellAmount(val)
})

const updateBuyAmount = debounce(async (val: any) => {
  if (!val) return;
  const amount = BigInt(val * 1e18)

 try {
   const receive = await getBuyAmountWithBTCAfterFee(comStore.currentSelectedCommunity?.token, amount)
   receiveAmount.value = receive
 } catch (error) {
    console.log(33, error)
 }
}, 500)

const updateSellAmount = debounce(async (val: any) => {
  try {
    if (!val) return;
    const amount = BigInt(val * 1e18)
    const receive = await getReceivedAmountSellBTCAfterFee(comStore.currentSelectedCommunity?.token, amount)
    receiveBtc.value = receive
  } catch (error) {
    receiveBtc.value = '0.00'
  }
}, 500)

async function checkTweet() {
  if (isPostTweet.value) {
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      isPostTweet.value = false
    }else if (!account.steemId) {
      modalStore.setModalVisible(true, GlobalModalType.Register)
      isPostTweet.value = false
    }
  }
}

async function confirm() {
  // checkout login
  // if (!accStore.getAccountInfo?.twitterId) {
  //   useModalStore().setModalVisible(true, GlobalModalType.Login)
  //   return;
  // }
  // check wallet connect
  if (accStore.ethConnectState !== EthWalletState.Connected) {
    needChoseWallet.value = true
    return;
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
    userTweet(content, comStore.currentSelectedCommunity!.tick).catch(handleErrorTip)
  }

  try{
    trading.value = true
    const token = comStore.currentSelectedCommunity
    if (!token) return;
    if (tradeType.value === 'buy') {
      if (!payBtc.value) return

      const hash = await buyToken(token!.token, receiveAmount.value, BigInt(payBtc.value * 1e18), sellsman.value, Math.ceil(maxSlippage.value * 100));
      if (hash) {
        payBtc.value = undefined
        receiveAmount.value = undefined
        trade(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo.twitterId, hash, useCurationStore().currentSelectedTweet?.commerceId, comStore.currentSelectedCommunity!.token).catch()
      }else{
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }else {
      if (!sellAmount.value) return;
      const hash = await sellToken(token!.token, BigInt(sellAmount.value * 1e18), receiveBtc.value, sellsman.value, Math.ceil(maxSlippage.value * 100))
      if (hash) {
        sellAmount.value = undefined
        receiveBtc.value = undefined
        trade(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo.twitterId, hash, useCurationStore().currentSelectedTweet?.commerceId, comStore.currentSelectedCommunity!.token).catch()
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

onMounted(async () => {
  if (!comStore.currentSelectedCommunity?.tick) {
    const tick = route.params.id as string
    const community = (await getCommunityDetail(tick)) as Community
    comStore.currentSelectedCommunity = (await getTokenInfo([community]))[0]
    comStore.currentSelectedCommunity = community
  }
  sellsman.value = route.params.sellsman
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
              class="bg-transparent h-full flex-1 text-h3"
            />
            <span class="text-h5">$ {{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5">Receive $BTC</span>
            <span class="text-h3">{{ formatAmount(receiveBtc?.toString() / 1e18) }}</span>
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
        <div class="flex justify-center">
          <el-radio-group v-model="isPostTweet" @change="checkTweet" class="c-radio gap-8">
            <el-radio :value="false">None</el-radio>
            <el-radio :value="true">
              <div class="flex items-center gap-1.5">
                <span>tweet & Earn</span>
                <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
                  <button @click.stop class="">
                    <img class="w-3" src="~@/assets/icons/icon-warning-primary.svg" alt="">
                  </button>
                  <template #content>
                    <div class="text-orange-normal py-1">{{  $t('buyAndSell.tweetTip') }}</div>
                  </template>
                </el-tooltip>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
        <button
          class="w-full h-12 rounded-full bg-gradient-primary text-white text-h5 flex items-center justify-center gap-2"
          @click="confirm"
          :disabled="comStore.currentSelectedCommunity?.listed || trading"
        >
          <span>{{ comStore.currentSelectedCommunity?.listed ? "Token lised" : "Confirm" }}</span>
          <i-ep-loading v-show="trading" class="animate-spin" />
        </button>
      </div>
      <RecordList v-if="comStore.currentSelectedCommunity?.token" />
    </div>
  </div>

  <el-dialog v-model="needChoseWallet"
               modal-class="overlay-white"
               class="max-w-[500px] rounded-[20px]"
               width="90%" :show-close="false" align-center destroy-on-close>
      <ChoseWallet @chosedWallet="needChoseWallet = false"/>
  </el-dialog>
</template>

<style scoped></style>
