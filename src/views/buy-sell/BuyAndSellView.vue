<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, onActivated, onMounted, provide, ref, watch} from "vue";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useRoute } from "vue-router";
import { getCommunityDetail, trade, getIpshareInfo, newCommerce } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithETHAfterFee, getReceivedAmountSellETHAfterFee, getTokenInfo,
  buyToken, sellToken, getUserTokenInfo,
  getBuyAmountUseEth, getSellAmountUseToken,
  getBuyPriceAfterFee
 } from '@/utils/pump'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore, useStateStore } from "@/stores/common";
import { handleErrorTip, notify } from "@/utils/notify";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { OperateType, useTweet } from "@/composables/useTweet";
import { useCurationStore } from "@/stores/curation";
import { ethers } from "ethers";
import emitter from "@/utils/emitter";
import AmountProgressBar from "@/views/buy-sell/AmountProgressBar.vue";
import Kline from "@/views/buy-sell/Kline.vue";
import { ca } from "element-plus/es/locale/index.mjs";

const comStore = useCommunityStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const tradeType = ref('buy')
const route = useRoute()
const tokenInfo = ref()
const trading = ref(false)
const showFillInfo = ref(false)
const defaultAmount = ref([0.02, 0.05, 0.1, 0.2])
const { preCheckCuration, userTweet } = useTweet();
const stateStore = useStateStore()
const calculating = ref(false)
let willListing = false;
let updatedBuyValue = 0n;
let updatedReveiveAmount = 0n;

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
const tokenOriginalBalance = ref(0n)
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
  if(tradeType.value==='sell') {
    sellAmount.value = (tokenBalance.value * percentage.value / 100).toFixed(8)
  }
}, {immediate: true})

watch(() => tradeType.value, () => {
  percentage.value = 0
})

watch(payEth, (val: any) => {
  calculating.value = true
  willListing = false
  updateBuyAmount(val)
})

watch(sellAmount, (val: any) => {
  calculating.value = true
  willListing = false
  updateSellAmount(val)
})

const invalidToken = computed(() => {
  return comStore.currentSelectedCommunity?.version === 1 && comStore.currentSelectedCommunity?.tick !== 'TTAI' && !comStore.currentSelectedCommunity?.listed
})

const updateBuyAmount = debounce(async (val: any) => {
  if (!val) {
    trading.value = false
    calculating.value = false
    receiveAmount.value = ''
    return
  };
  val = parseFloat(val)
  if (val == 0) {
    trading.value = false
    calculating.value = false
    receiveAmount.value = ''
    return
  };
  showFillInfo.value = false
  const amount = ethers.parseEther(val.toString())
 try {
  if (listed.value) {
    const receive = await getBuyAmountUseEth(comStore.currentSelectedCommunity!.token, amount * 9800n / 10000n)
    receiveAmount.value = receive
  }else {
    const {receive, supply} = await getBuyAmountWithETHAfterFee(comStore.currentSelectedCommunity?.token, comStore.currentSelectedCommunity?.version ?? 2, amount)
    if (receive > ethers.parseEther('650000000') * 9950n / 10000n - supply) {
      updatedReveiveAmount = ethers.parseEther('650000010') - supply
      updatedBuyValue = await getBuyPriceAfterFee(supply, updatedReveiveAmount) * 10000n / 9900n
      willListing = true
    }else{
      updatedReveiveAmount = receive
      willListing = false
    }
    receiveAmount.value = receive
  }
 } catch (error) {
    console.log(33, error)
    receiveAmount.value = '0.00'
  }finally {
  calculating.value = false
 }
}, 500)

const updateSellAmount = debounce(async (val: any) => {
  try {
    if (!val || !comStore.currentSelectedCommunity) {
      receiveEth.value = ''
      sellAmount.value = ''
      return;
    }
    if (parseFloat(val) == 0) return;
    showFillInfo.value = false
    const amount = ethers.parseEther(val.toString())
    if (listed.value) {
      const receive = await getSellAmountUseToken(comStore.currentSelectedCommunity!.token, amount)
      receiveEth.value = receive
    }else {
      const receive = await getReceivedAmountSellETHAfterFee(comStore.currentSelectedCommunity?.token, comStore.currentSelectedCommunity?.version ?? 2, amount)
      receiveEth.value = receive
    }
  } catch (error) {
    receiveEth.value = '0.00'
  }finally {
    calculating.value = false
  }
}, 500)

async function checkTweet() {
  if (isPostTweet.value) {
    const account = accStore.getAccountInfo
    if (!account || !account.twitterId) {
      modalStore.setModalVisible(true, GlobalModalType.Login)
      isPostTweet.value = false
      return;
    } else if (!account.steemId || account.steemId.length == 0) {
      modalStore.setModalVisible(true, GlobalModalType.Register)
      isPostTweet.value = false
      return;
    }

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
    // if (ethBalance.value < payEth.value) {
    //   notify({message: 'Insufficient BNB balance'})
    //   return
    // }
  }else {
    if (!sellAmount.value) {
      showFillInfo.value = true
      return
    };
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

      // check list
      const hash = await buyToken(token!.token, token!.version ?? 2, willListing ? updatedReveiveAmount : receiveAmount.value, willListing ? updatedBuyValue : BigInt(payEth.value * 1e18), stateStore.sellsman, listed.value!, Math.ceil(maxSlippage.value * 100));
      if (hash) {
        payEth.value = undefined
        receiveAmount.value = undefined
        // trade(comStore.currentSelectedCommunity!.tick, accStore.getAccountInfo?.twitterId, hash, useCurationStore().currentSelectedTweet?.commerceId, comStore.currentSelectedCommunity!.token).catch()
        emitter.emit('newTrade')
        updateUserTokenInfo()
      }else{
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }else {
      if (!sellAmount.value) return;
      let finalSellAmount = BigInt(sellAmount.value * 1e18)
      if (tokenOriginalBalance.value < BigInt(sellAmount.value * 1e18)) {
        finalSellAmount = BigInt(tokenOriginalBalance.value)
      }

      const hash = await sellToken(token!.token, token!.version ?? 4, finalSellAmount, receiveEth.value, stateStore.sellsman, listed.value!, Math.ceil(maxSlippage.value * 100))
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
      tokenBalance.value = info.balance.toString() / 1e18;
      tokenOriginalBalance.value = info.balance;
      ethBalance.value = info.ethBalance;
    }
  } catch (error) {
    console.error('get users token info fail', error)
  }
}

onActivated(async () => {
  console.log('onActivated', route.params.id)

})

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
  stateStore.sellsman = route.params.sellsman as string
  updateUserTokenInfo()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- <BackHeader class="px-3">
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
    </BackHeader> -->
    <div
      class="flex-1 overflow-auto flex gap-2"
    >
      <div v-if="comStore.currentSelectedCommunity?.tick"
           class="w-full hidden web:flex min-w-[320px] flex-1 gap-3">
        <Kline v-if="!comStore.currentSelectedCommunity?.listed" :tick="comStore.currentSelectedCommunity?.tick" chart-id="k-line-chart1"/>
        <iframe v-else :src="`https://dexscreener.com/bsc/${comStore.currentSelectedCommunity?.pair}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=1&loadChartSettings=0&chartDefaultOnMobile=1&chartTheme=light&theme=light&chartStyle=1&chartType=usd&interval=15`" 
        frameborder="0" class="w-full h-full"></iframe>

      </div>
      <div class="bg-white py-3 web:py-5 px-4 rounded-2xl flex flex-col gap-2 web:gap-3 w-full web:w-[340px]">
        <div
          class="flex rounded-full overflow-hidden h-9 text-white bg-grey-light-active text-h5"
        >
          <button
            class="h-full flex-1"
            :class="tradeType === 'buy' ? 'bg-gradient-primary' : ''"
            @click="tradeType = 'buy'"
          >
            {{ $t('buy') }}
          </button>
          <button
            class="h-full flex-1"
            :class="tradeType === 'sell' ? 'bg-gradient-primary' : ''"
            @click="tradeType = 'sell'"
          >
            {{ $t('sell') }}
          </button>
        </div>
        <template v-if="tradeType === 'buy'">
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-black flex items-center"
          >
            <span class="text-h5">{{ $t('pay') }}</span>
            <input
              v-model="payEth"
              type="number"
              class="bg-transparent h-full flex-1 w-[120px] text-h3"
            />
            <span class="text-h5 whitespace-nowrap">$ BNB</span>
          </div>
          <div class="grid grid-cols-4 gap-1 h-5 web:h-7 text-sm">
            <button v-for="i of defaultAmount"
              class="col-span-1 p-1 rounded-full h-full flex-1 text-white bg-grey-light-active"
              @click="payEth=i"
              :class="payEth === i ? 'bg-gradient-primary' : ''">
              {{ i }}
              </button>
          </div>
          <div class="text-right text-sm">
            {{$t('balance')}}: {{ formatAmount(ethBalance) }}
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5"
              >{{$t('receive')}} ${{ comStore.currentSelectedCommunity?.tick }}</span
            >
            <span class="text-h3">{{ formatAmount(receiveAmount?.toString() / 1e18) }}</span>
          </div>
        </template>
        <template v-else>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-black flex items-center"
          >
            <span class="text-h5">{{ $t('sell') }}</span>
            <input
              v-model="sellAmount"
              type="number"
              class="bg-transparent h-full flex-1 w-[120px] text-h3"
            />
            <span class="text-h5 whitespace-nowrap min-w">$ {{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <AmountProgressBar class="h-5 web:h-7"/>
          <div class="text-sm flex justify-end">
            {{ $t('balance') }}: {{ formatAmount(tokenBalance) }}
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5">{{ $t('receive') }} $BNB</span>
            <span class="text-h3">{{ formatAmount(receiveEth?.toString() / 1e18) }}</span>
          </div></template
        >
        <div class="flex items-center justify-between">
          <div class="font-light text-base">{{$t('buyAndSell.setMaxSlippage')}}</div>
          <div class="w-[100px] flex items-center justify-between border-[1px] border-grey-light-active rounded-lg h-6 web:h-9 px-3">
            <div class="flex-1 flex items-center gpa-1 h-full">
              <input class="w-12 h-full overflow-hidden text-right text-orange-normal" type="number" v-model="maxSlippage">
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
            <el-radio :value="false">{{ $t('none') }}</el-radio>
            <el-radio :value="true">
              <div class="flex items-center gap-1.5">
                <span>{{$t('blink')}}</span>
                <el-tooltip popper-class="c-arrow-popper" trigger="click" ref="retweetQuoteRef">
                  <button @click.stop class="">
                    <img class="w-4" src="~@/assets/icons/icon-warning-primary.svg" alt="">
                  </button>
                  <template #content>
                    <div class="text-grey-normal px-3 py-1 max-w-[200px] font-medium">{{  $t('buyAndSell.blinkTip') }}</div>
                  </template>
                </el-tooltip>
              </div>
            </el-radio>
          </el-radio-group>
        </div>
        <button
          class="w-full h-10 web:h-12 rounded-full bg-gradient-primary text-white text-h5 flex items-center justify-center gap-2"
          @click="confirm"
          :disabled="trading || (invalidToken && tradeType === 'buy') || calculating"
        >
          <span>{{ (accStore.ethConnectAddress ? (listed ? $t('confirmListed') : $t('confirm')): $t('connect')) }}</span>
          <i-ep-loading v-show="trading || calculating" class="animate-spin" />
        </button>

        <div v-if="tradeType === 'buy' && willListing" class="text-green-500 text-sm text-center mt-1">
            Maybe listing
          </div>
        <div v-if="invalidToken" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.invalidTokenSellTip') }}
        </div>
        <div v-if="showFillInfo" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.fillInfoTip') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
