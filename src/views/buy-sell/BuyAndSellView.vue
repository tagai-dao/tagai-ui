<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, onActivated, onMounted, provide, ref, watch} from "vue";
import { useI18n } from "vue-i18n";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useRoute } from "vue-router";
import { getCommunityDetail, trade, createTokenCommerce, tweet } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithETHAfterFee, getReceivedAmountSellETHAfterFee, getTokenInfo,
  buyToken, sellToken, getUserTokenInfo,
  getBuyAmountUseEth, getSellAmountUseToken,
  getBuyPriceAfterFee
 } from '@/utils/pump'
import { buyTokenV4, sellTokenV4, getV4BuyQuote, getV4SellQuote, type PoolKey } from '@/utils/pcsV4Swap'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore, useStateStore } from "@/stores/common";
import { handleErrorTip, notify } from "@/utils/notify";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { OperateType, useTweet } from "@/composables/useTweet";
import { buildPlatformPostText, isNativeTwitterAccount, openTwitterIntent } from "@/utils/twitterPost";
import { OP_CONSUME } from "@/config";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import AmountProgressBar from "@/views/buy-sell/AmountProgressBar.vue";
import Kline from "@/views/buy-sell/Kline.vue";
import { isAddress, parseEther } from "viem";
import { getIPShareSupply } from "@/utils/ipshare";

const props = defineProps({
  tick: {type: String, required: false, default: null},
  sellsman: {type: String, required: false, default: null}
})
const { t } = useI18n()
const comStore = useCommunityStore()
const accStore = useAccountStore()
const modalStore = useModalStore()
const tradeType = ref('buy')
const route = useRoute()
const tokenInfo = ref()
const trading = ref(false)
const showFillInfo = ref(false)
const showNotBondEth = ref(false)
const defaultAmount = ref([0.02, 0.05, 0.1, 0.2])
const { preCheckCuration } = useTweet();
const stateStore = useStateStore()
const calculating = ref(false)
let willListing = false;
let updatedBuyValue = 0n;
let updatedReveiveAmount = 0n;

const payEth = ref()
const sellAmount = ref()
const {replaceEmptyProfile, updateUserOPLocal} = useAccount()

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

/** v7 / v8 上架后均走 PCS V4（与 pump.ts isPcsV4Listed 一致） */
const isPcsV4Version = (v: number | undefined | null) => v === 7 || v === 8 || v === 9

/** Pump8：曲线阶段不对普通用户开放买卖，仅 Agent 可走其他入口 */
const isV8PreListNoTrade = computed(
  () => comStore.currentSelectedCommunity?.version === 8 && !comStore.currentSelectedCommunity?.listed
)

// v9 费率（contracts/Pump.sol feeRatio=[30,30]/10000：平台 0.3% + 推荐人 0.3%；
// 内盘与上市后（TipTagSwapHook，原生池 fee=0）同一口径）。仅对 v9 展示，其余版本费率未逐一确认不显示
const V9_TOTAL_FEE = 0.006
const isV9 = computed(() => comStore.currentSelectedCommunity?.version === 9)
const spotPrice = computed(() => Number(comStore.currentSelectedCommunity?.price ?? 0))

// 价格影响 = 剔除费率后的成交均价 vs 现价 的偏离（绝对值上限 99.99 防御）
const buyPriceImpact = computed(() => {
  const pay = parseFloat(payEth.value)
  const recv = Number(receiveAmount.value?.toString() ?? 0) / 1e18
  if (!isV9.value || !spotPrice.value || !isFinite(pay) || pay <= 0 || recv <= 0) return null
  const avg = (pay * (1 - V9_TOTAL_FEE)) / recv
  return Math.min((avg / spotPrice.value - 1) * 100, 99.99)
})
const sellPriceImpact = computed(() => {
  const sellTokens = parseFloat(sellAmount.value)
  const recvEthNet = Number(receiveEth.value?.toString() ?? 0) / 1e18
  if (!isV9.value || !spotPrice.value || !isFinite(sellTokens) || sellTokens <= 0 || recvEthNet <= 0) return null
  const avg = recvEthNet / (1 - V9_TOTAL_FEE) / sellTokens
  return Math.max((avg / spotPrice.value - 1) * 100, -99.99)
})

// MAX：用全部 BNB 余额买入，预留 0.005 作 gas
function setMaxBuy() {
  const max = Math.max(ethBalance.value - 0.005, 0)
  payEth.value = max > 0 ? parseFloat(max.toFixed(6)) : 0
}

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
  const amount = parseEther(val.toString())
 try {
  if (isV8PreListNoTrade.value) {
    receiveAmount.value = ''
    calculating.value = false
    return
  }
  if (listed.value) {
    if (isPcsV4Version(comStore.currentSelectedCommunity?.version)) {
      const receive = await getV4BuyQuote(comStore.currentSelectedCommunity!.pair as `0x${string}`, amount)
      receiveAmount.value = receive
    } else {
      const receive = await getBuyAmountUseEth(comStore.currentSelectedCommunity!.token, amount * 9800n / 10000n)
      receiveAmount.value = receive
    }
  }else {
    const {receive, supply} = await getBuyAmountWithETHAfterFee(comStore.currentSelectedCommunity?.token, comStore.currentSelectedCommunity?.version ?? 2, amount)
    if (receive > parseEther('650000000') * 9950n / 10000n - supply) {
      updatedReveiveAmount = parseEther('650000010') - supply
      updatedBuyValue = await getBuyPriceAfterFee(supply as bigint, updatedReveiveAmount as bigint) * 10000n / 9900n
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
    const amount = parseEther(val.toString())
    if (isV8PreListNoTrade.value) {
      receiveEth.value = ''
      calculating.value = false
      return
    }
    if (listed.value) {
      if (isPcsV4Version(comStore.currentSelectedCommunity?.version)) {
        const receive = await getV4SellQuote(comStore.currentSelectedCommunity!.pair as `0x${string}`, amount)
        receiveEth.value = receive
      } else {
        const receive = await getSellAmountUseToken(comStore.currentSelectedCommunity!.token, amount)
        receiveEth.value = receive
      }
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

    if (isAddress(accStore.getAccountInfo.ethAddr ?? '')) {
      const supply: any = await getIPShareSupply(accStore.getAccountInfo.ethAddr ?? '');
      if (supply >= 10) {
        accStore.ipshare = {
          ethAddr: accStore.getAccountInfo.ethAddr ?? '',
          shareSupply: supply,
          created: true
        };
      }
    }
    if (!accStore.ipshare?.ethAddr) {
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
  if (comStore.currentSelectedCommunity?.version === 8 && !comStore.currentSelectedCommunity?.listed) {
    notify({ message: t('buyAndSell.v8PreListAgentOnly') })
    return
  }
  showNotBondEth.value = false
  if (tradeType.value === 'buy') {
    if (!payEth.value || parseFloat(payEth.value) == 0) {
      showFillInfo.value = true
      return
    }
    // check eth balance
    // if (ethBalance.value < payEth.value) {
    //   notify({message: 'Insufficient BNB balance'})
    //   return
    // }
  }else {
    if (!sellAmount.value || parseFloat(sellAmount.value) == 0) {
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
    const content = formatElToTextContent(contentRef.value)
    const token = comStore.currentSelectedCommunity!
    const account = accStore.getAccountInfo
    if (!account?.twitterId) return

    const res: any = await createTokenCommerce(account.twitterId, token.tick, token.token!)
    if (res?.c !== 0 || !res?.d?.commerceUrl) {
      handleErrorTip(res)
      return
    }

    if (isNativeTwitterAccount(account.accountType)) {
      openTwitterIntent({
        text: content,
        tick: token.tick,
        commerceUrl: res.d.commerceUrl,
      })
    } else {
      const postText = buildPlatformPostText(content, {
        tick: token.tick,
        commerceUrl: res.d.commerceUrl,
      })
      await tweet(account.twitterId, postText, token.tick)
      updateUserOPLocal(OP_CONSUME.POST)
    }
  }

  try{
    trading.value = true
    const token = comStore.currentSelectedCommunity
    if (!token) return;
    if (tradeType.value === 'buy') {
      if (!payEth.value) return

      let hash: string | undefined;
      // v7/v8 上架后代币走 PCS V4 Universal Router
      if (isPcsV4Version(token!.version) && listed.value) {
        const poolKey = JSON.parse(token!.pair ?? '{}') as PoolKey;
        const ethAmount = parseEther(payEth.value.toString());
        hash = await buyTokenV4(
          poolKey,
          ethAmount,
          receiveAmount.value ?? 0n,
          (stateStore.sellsman ?? token.ipshare) as `0x${string}`,
          Math.ceil(maxSlippage.value * 100)
        );
      } else {
        // check list
        hash = await buyToken(token!.token, token!.version ?? 2, willListing ? updatedReveiveAmount : receiveAmount.value, willListing ? updatedBuyValue : parseEther(payEth.value.toString()), (stateStore.sellsman ?? token.ipshare) as any, listed.value!, token!.isImport!, Math.ceil(maxSlippage.value * 100));
      }
      if (hash) {
        payEth.value = undefined
        receiveAmount.value = undefined
        recordCommunityTrade(hash)
        emitter.emit('newTrade')
        updateUserTokenInfo()
      }else{
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }else {
      if (!sellAmount.value) return;
      let finalSellAmount = parseEther(sellAmount.value.toString());
      if (tokenOriginalBalance.value < finalSellAmount) {
        finalSellAmount = BigInt(tokenOriginalBalance.value)
      }

      let hash: string | undefined;
      // v7/v8 上架后代币走 PCS V4 Universal Router
      if (isPcsV4Version(token!.version) && listed.value) {
        const poolKey = JSON.parse(token!.pair ?? '{}') as PoolKey;
        hash = await sellTokenV4(
          poolKey,
          token!.token as `0x${string}`,
          finalSellAmount,
          receiveEth.value ?? 0n,
          (stateStore.sellsman ?? token.ipshare) as `0x${string}`,
          Math.ceil(maxSlippage.value * 100)
        );
      } else {
        hash = await sellToken(token!.token, token!.version ?? 4, finalSellAmount, receiveEth.value, (stateStore.sellsman ?? token.ipshare) as any, listed.value!, token!.isImport!, Math.ceil(maxSlippage.value * 100));
      }
      if (hash) {
        sellAmount.value = undefined
        receiveEth.value = undefined
        recordCommunityTrade(hash)

        emitter.emit('newTrade')
        updateUserTokenInfo()
      }else {
        handleErrorTip(errCode.BLOCK_CHAIN_ERROR)
      }
    }
  } catch (e: any) {
    console.log(444, e)
    if (e == errCode.NOT_BOND_ETH) {
      showNotBondEth.value = true
    } else {
      handleErrorTip(e)
    }
    
  } finally {
    trading.value = false
  }
}

async function updateUserTokenInfo () {
  try {
    if (isAddress(accStore.ethConnectAddress ?? '')) {
      let info = await getUserTokenInfo(comStore.currentSelectedCommunity!.token, accStore.ethConnectAddress);
      tokenBalance.value = info.balance.toString() / 1e18;
      tokenOriginalBalance.value = info.balance;
      ethBalance.value = info.ethBalance;
    }
  } catch (error) {
    console.error('get users token info fail', error)
  }
}

function recordCommunityTrade(hash: string) {
  const token = comStore.currentSelectedCommunity;
  if (!token) return;

  trade(
    token.tick,
    accStore.getAccountInfo?.twitterId,
    hash,
    useCurationStore().currentSelectedTweet?.commerceId,
    token.token
  ).catch(console.error)
}

onActivated(async () => {
  console.log('onActivated', route.params.id)

})

onMounted(async () => {
  const tick = props.tick || route.params.id as string
  if (!comStore.currentSelectedCommunity?.tick || comStore.currentSelectedCommunity?.tick != tick) {
    if (comStore.currentSelectedCommunity?.tick != tick) {
      comStore.currentSelectedCommunity = null;
    }
    let community = (await getCommunityDetail(tick)) as Community
    community = (await getTokenInfo([community]))[0]
    comStore.currentSelectedCommunity = community
  }
  const routeSellsman = typeof route.params.sellsman === 'string' ? route.params.sellsman : ''
  stateStore.sellsman = props.sellsman ?? routeSellsman
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
      <div v-if="comStore.currentSelectedCommunity?.tick && !props.tick"
           class="w-full h-[360px] hidden web:flex min-w-[320px] flex-1 gap-3">
        <Kline v-if="!comStore.currentSelectedCommunity?.listed" :tick="comStore.currentSelectedCommunity?.tick" chart-id="k-line-chart1"/>
        <iframe v-else :src="`https://dexscreener.com/bsc/${isPcsV4Version(comStore.currentSelectedCommunity?.version) ? comStore.currentSelectedCommunity?.token : comStore.currentSelectedCommunity?.pair}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=1&loadChartSettings=0&chartDefaultOnMobile=1&chartTheme=light&theme=light&chartStyle=1&chartType=usd&interval=15`"
        frameborder="0" class="w-full h-full"></iframe>

      </div>
      <div v-if="comStore.currentSelectedCommunity?.tick && comStore.currentSelectedCommunity?.tick !== '币安小说'" class="bg-white py-3 web:py-5 px-4 rounded-2xl flex flex-col gap-2 web:gap-3 w-full" :class="props.tick?'':'web:w-[340px]'">
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
              class="bg-transparent h-full flex-1 w-[120px] text-h3 tabular-nums"
              :disabled="isV8PreListNoTrade"
            />
            <span class="text-h5 whitespace-nowrap">$ BNB</span>
          </div>
          <div class="grid grid-cols-5 gap-1 h-8 text-sm">
            <button v-for="i of defaultAmount"
              class="col-span-1 p-1 rounded-full h-full flex-1 text-white bg-grey-light-active"
              @click="payEth=i"
              :disabled="isV8PreListNoTrade"
              :class="payEth === i ? 'bg-gradient-primary' : ''">
              {{ i }}
              </button>
            <button
              class="col-span-1 p-1 rounded-full h-full flex-1 text-white bg-grey-light-active"
              @click="setMaxBuy"
              :disabled="isV8PreListNoTrade || ethBalance <= 0">
              MAX
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
            <span class="text-h3 tabular-nums">{{ formatAmount(receiveAmount?.toString() / 1e18) }}</span>
          </div>
          <div v-if="receiveAmount && Number(receiveAmount) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.minReceived') }} ({{ Number(maxSlippage) }}%)</span>
            <span>{{ formatAmount((receiveAmount?.toString() / 1e18) * (1 - Number(maxSlippage) / 100)) }} ${{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <div v-if="buyPriceImpact !== null" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.priceImpact') }}</span>
            <span class="tabular-nums" :class="buyPriceImpact > 5 ? 'text-orange-normal font-semibold' : ''">{{ buyPriceImpact.toFixed(2) }}%</span>
          </div>
          <div v-if="isV9 && receiveAmount && Number(receiveAmount) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.platformFee') }}</span>
            <span class="tabular-nums">0.6%</span>
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
              class="bg-transparent h-full flex-1 w-[120px] text-h3 tabular-nums"
              :disabled="isV8PreListNoTrade"
            />
            <span class="text-h5 whitespace-nowrap min-w">$ {{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <AmountProgressBar class="h-5 web:h-7" :class="{ 'pointer-events-none opacity-50': isV8PreListNoTrade }"/>
          <div class="text-sm flex justify-end">
            {{ $t('balance') }}: {{ formatAmount(tokenBalance) }}
          </div>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-black flex items-center justify-between"
          >
            <span class="text-h5">{{ $t('receive') }} $BNB</span>
            <span class="text-h3 tabular-nums">{{ formatAmount(receiveEth?.toString() / 1e18) }}</span>
          </div>
          <div v-if="receiveEth && Number(receiveEth) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.minReceived') }} ({{ Number(maxSlippage) }}%)</span>
            <span>{{ formatAmount((receiveEth?.toString() / 1e18) * (1 - Number(maxSlippage) / 100)) }} $BNB</span>
          </div>
          <div v-if="sellPriceImpact !== null" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.priceImpact') }}</span>
            <span class="tabular-nums" :class="sellPriceImpact < -5 ? 'text-orange-normal font-semibold' : ''">{{ sellPriceImpact.toFixed(2) }}%</span>
          </div>
          <div v-if="isV9 && receiveEth && Number(receiveEth) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.platformFee') }}</span>
            <span class="tabular-nums">0.6%</span>
          </div></template
        >
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <div class="font-light text-base">{{$t('buyAndSell.setMaxSlippage')}}</div>
            <span v-if="Number(maxSlippage) > 5" class="text-sm text-orange-normal">⚠ {{ $t('buyAndSell.highSlippageWarn') }}</span>
          </div>
          <div class="flex gap-1.5">
            <button v-for="s of [1, 3, 5]" :key="s"
              class="flex-1 h-8 rounded-lg text-sm border-[1px] transition-colors"
              :class="Number(maxSlippage) === s ? 'bg-gradient-primary text-white border-transparent' : 'border-grey-light-active text-grey-64 hover:bg-gray-50'"
              @click="maxSlippage = s">
              {{ s }}%
            </button>
            <div class="flex-1 h-8 flex items-center border-[1px] border-grey-light-active rounded-lg px-2">
              <input class="w-full h-full text-right text-orange-normal bg-transparent" type="number" min="0" v-model="maxSlippage">
              <span class="text-orange-normal">%</span>
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
          :disabled="trading || (invalidToken && tradeType === 'buy') || calculating || accStore.ethConnectState == EthWalletState.Connecting || isV8PreListNoTrade"
        >
          <span>{{
            !accStore.ethConnectAddress
              ? $t('connect')
              : (isV8PreListNoTrade
                  ? $t('buyAndSell.v8PreListAgentOnly')
                  : (listed ? $t('confirmListed') : $t('confirm')))
          }}</span>
          <i-ep-loading v-show="trading || calculating || accStore.ethConnectState == EthWalletState.Connecting" class="animate-spin" />
        </button>

        <div v-if="tradeType === 'buy' && willListing" class="text-green-500 text-sm text-center mt-1">
            Maybe listing
          </div>
        <div v-if="isV8PreListNoTrade" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.v8PreListAgentOnly') }}
        </div>
        <div v-if="invalidToken" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.invalidTokenSellTip') }}
        </div>
        <div v-if="showNotBondEth" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.notBondEthTip') }}
        </div>
        <div v-if="showFillInfo" class="text-sm text-red-e6 text-center">
          {{ $t('buyAndSell.fillInfoTip') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
