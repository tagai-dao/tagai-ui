<script setup lang="ts">
import BackHeader from "@/layout/BackHeader.vue";
import {computed, nextTick, onActivated, onMounted, provide, ref, watch} from "vue";
import { useI18n } from "vue-i18n";
import {useCreateTweet} from "@/composables/useCreateTweet";
import RecordList from "@/views/buy-sell/RecordList.vue";
import { useCommunityStore } from "@/stores/community";
import { useChainStore } from '@/stores/chain';
import { EthWalletState, useAccountStore } from "@/stores/web3";
import { useRoute } from "vue-router";
import { getCommunityDetail, trade, createTokenCommerce, tweet } from '@/apis/api'
import { GlobalModalType, type Community } from "@/types";
import { getBuyAmountWithETHAfterFee, getReceivedAmountSellETHAfterFee, getTokenInfo,
  buyToken, sellToken, getUserTokenInfo,
  getBuyAmountUseEth, getSellAmountUseToken, getV3BuyAmountUseEth, getV3SellAmountUseToken,
  getImportedV2BuyAmountUseNative, getImportedV2SellAmountUseToken,
  quoteImportedTokenBuy, quoteImportedTokenSell, simulateImportedTokenBuy,
  getBuyPriceAfterFee,
  getBondingCurveSpotPrice, getUniswapV2SpotPrice, getImportTokenPrice,
  resolveV2NativePair, resolveV3NativePool
 } from '@/utils/pump'
import { readContract } from '@/utils/contract'
import { buyTokenV4, sellTokenV4, getV4BuyQuote, getV4SellQuote, getV4SpotPrice, resolveV4PoolId, resolveV4PoolKeyForTrade, poolKeyToPoolId, type PoolKey } from '@/utils/pcsV4Swap'
import {
  buyTokenV4Rh,
  buyTokenV4RhDirect,
  sellTokenV4Rh,
  sellTokenV4RhDirect,
  resolveRhV4PoolKeyForTrade,
  quoteRhV4,
  getRhV4SpotPrice,
} from '@/utils/rhV4Swap'
import debounce from 'lodash.debounce';
import { formatAmount } from "@/utils/helper";
import { useModalStore, useStateStore } from "@/stores/common";
import { handleErrorTip, notify } from "@/utils/notify";
import errCode from "@/errCode";
import { useAccount } from "@/composables/useAccount";
import { OperateType, useTweet } from "@/composables/useTweet";
import { buildPlatformPostText, isNativeTwitterAccount, openTwitterIntent } from "@/utils/twitterPost";
import { OP_CONSUME, usesThirdPartyMarketCap } from "@/config";
import { useCurationStore } from "@/stores/curation";
import emitter from "@/utils/emitter";
import AmountProgressBar from "@/views/buy-sell/AmountProgressBar.vue";
import Kline from "@/views/buy-sell/Kline.vue";
import { getDexScreenerEmbedPath, usesDirectRhV4Trade, usesListedV4Quote } from '@/utils/pumpVersion'
import { isAddress, parseEther, zeroAddress } from "viem";
import { getIPShareSupply } from "@/utils/ipshare";
import { useTheme } from "@/composables/useTheme";

const { isDark } = useTheme()
const dexTheme = computed(() => isDark.value ? 'dark' : 'light')

const props = defineProps({
  tick: {type: String, required: false, default: null},
  sellsman: {type: String, required: false, default: null}
})
const { t } = useI18n()
const comStore = useCommunityStore()
const chainStore = useChainStore()
const dexScreenerChain = computed(() => chainStore.deployment.key === 'rh' ? 'robinhood' : 'bsc')
const nativeSymbol = computed(() => chainStore.nativeCurrency.symbol)
/** 有 tick 且非嵌入模式时展示桌面 K 线：未 list 用自建图，已 list 用 DexScreener */
const showDesktopChart = computed(() =>
  !!comStore.currentSelectedCommunity?.tick && !props.tick
)
const accStore = useAccountStore()
const modalStore = useModalStore()
const isWalletConnected = computed(() =>
  accStore.ethConnectState === EthWalletState.Connected &&
  isAddress(accStore.ethConnectAddress ?? '')
)
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

const payEth = ref('')
const sellAmount = ref('')
const {replaceEmptyProfile, updateUserOPLocal} = useAccount()

const account = computed(() => {
  return accStore.getAccountInfo
})

watch(() => accStore.ethConnectAddress, (val) => {
  updateUserTokenInfo()
})

const receiveAmount = ref()
const receiveEth = ref()
/** 与当次询价同步快照的边际现价，避免 community.price 被后台刷新后导致滑点跳变 */
const quoteSpotPrice = ref<number | null>(null)
let buyQuoteSeq = 0
let sellQuoteSeq = 0

const maxSlippage = ref(1)
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
// 进度条同步输入时跳过「手动编辑 → 重置 percentage」
const sellAmountSyncingFromPercent = ref(false)

const normalizeAmountStr = (val: unknown): string => {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}
/** 用户正在输入小数（如 "0."）时暂不询价 */
const isIncompleteAmountInput = (str: string) =>
  str === '' || str === '.' || str.endsWith('.')

watch([() => percentage.value, () => ethBalance.value, () => tokenBalance.value], () => {
  // percentage=0 时不覆盖用户手动输入
  if (percentage.value === 0) return
  if (tradeType.value === 'buy') payEth.value = (ethBalance.value * percentage.value / 100).toFixed(8)
  if (tradeType.value === 'sell') {
    sellAmountSyncingFromPercent.value = true
    sellAmount.value = (tokenBalance.value * percentage.value / 100).toFixed(8)
    nextTick(() => { sellAmountSyncingFromPercent.value = false })
  }
}, { immediate: true })

watch(() => tradeType.value, () => {
  percentage.value = 0
  quoteSpotPrice.value = null
})

watch(payEth, (val: any) => {
  calculating.value = true
  willListing = false
  updateBuyAmount(val)
})

watch(sellAmount, (val: any) => {
  // 手动改数量后脱离进度条比例，避免余额刷新时覆盖输入
  if (!sellAmountSyncingFromPercent.value && percentage.value > 0) {
    percentage.value = 0
  }
  calculating.value = true
  willListing = false
  updateSellAmount(val)
})

const invalidToken = computed(() => {
  return comStore.currentSelectedCommunity?.version === 1 && comStore.currentSelectedCommunity?.tick !== 'TTAI' && !comStore.currentSelectedCommunity?.listed
})

/** Pump8：曲线阶段不对普通用户开放买卖，仅 Agent 可走其他入口 */
const isV8PreListNoTrade = computed(
  () => comStore.currentSelectedCommunity?.version === 8 && !comStore.currentSelectedCommunity?.listed
)

// 各版本交易费率（用于从询价结果反推净成交均价）
const V9_PLATFORM_FEE = 0.003
const V9_IPSHARE_FEE = 0.003
// 成交报价会同时扣除平台费和 IPShare 费用；价格影响计算必须使用总费率。
const V9_TOTAL_FEE = V9_PLATFORM_FEE + V9_IPSHARE_FEE
const BONDING_CURVE_FEE = 0.02   // 内盘 getBuyAmountByValue 使用 9800/10000
const LISTED_V2_FEE = 0.02       // 上市后 Uniswap V2 路由 2% 手续费
const IMPORTED_WRAPPER_FEE = 0.006 // 0.2% 推荐/部署者 BNB + 0.2% 平台 BNB + 0.2% Nutbox Token
/** V4 Hook 抽成，仅用于价格影响展示（询价结果已含 Hook，需还原池内成交价） */
const V4_HOOK_FEE = 0.006
const SPCXB_HOOK_FEE = 0.01

const isV9OrV11FeeModel = computed(() => {
  const version = Number(comStore.currentSelectedCommunity?.version)
  return version === 9 || version === 11
})
const tradeFeeRate = computed(() => {
  const c = comStore.currentSelectedCommunity
  if (!c) return BONDING_CURVE_FEE
  if (c.isImport && chainStore.deployment.key === 'bsc') return IMPORTED_WRAPPER_FEE
  // v9/v11 内盘 0.6%；上市后走 V4，询价已扣 lpFee
  if ((c.version === 9 || c.version === 11) && !c.listed) return V9_TOTAL_FEE
  if (usesListedV4Quote(c)) return 0
  if (c.listed) return LISTED_V2_FEE
  return BONDING_CURVE_FEE
})

/** 价格影响展示用费率：V4 剥离 Hook 固定费（SPCXB 1%，其余 V4 0.6%） */
const priceImpactFeeRate = computed(() => {
  const c = comStore.currentSelectedCommunity
  if (c?.isImport && chainStore.deployment.key === 'bsc') return IMPORTED_WRAPPER_FEE
  if (c && usesListedV4Quote(c)) {
    return usesThirdPartyMarketCap(c.tick) ? SPCXB_HOOK_FEE : V4_HOOK_FEE
  }
  return tradeFeeRate.value
})

// 价格影响 = 成交单价相对询价时刻现货的不利偏离（恒为正，上限 99.99%）
const calcAdversePriceImpact = (executionBnbPerToken: number, spotBnbPerToken: number): number | null => {
  if (!spotBnbPerToken || !isFinite(executionBnbPerToken) || executionBnbPerToken <= 0) return null
  return Math.min(Math.abs(executionBnbPerToken / spotBnbPerToken - 1) * 100, 99.99)
}

const buyPriceImpact = computed(() => {
  const pay = parseFloat(payEth.value)
  const recv = Number(receiveAmount.value?.toString() ?? 0) / 1e18
  const spot = quoteSpotPrice.value
  if (!spot || !isFinite(pay) || pay <= 0 || recv <= 0) return null
  const fee = priceImpactFeeRate.value
  // 买入：净投入 BNB / 到手 Token = 实际买入单价
  const execPrice = (pay * (1 - fee)) / recv
  return calcAdversePriceImpact(execPrice, spot)
})
const sellPriceImpact = computed(() => {
  const sellTokens = parseFloat(sellAmount.value)
  const recvEthNet = Number(receiveEth.value?.toString() ?? 0) / 1e18
  const spot = quoteSpotPrice.value
  if (!spot || !isFinite(sellTokens) || sellTokens <= 0 || recvEthNet <= 0) return null
  const fee = priceImpactFeeRate.value
  // 卖出：到手 BNB 为扣费后净值，先还原池内成交价再与现货比较
  const execPrice = recvEthNet / (1 - fee) / sellTokens
  return calcAdversePriceImpact(execPrice, spot)
})

// 预估价格影响超过用户设置的最大滑点容忍
const isBuyImpactExceedsTolerance = computed(
  () => buyPriceImpact.value !== null && buyPriceImpact.value > Number(maxSlippage.value)
)
const isSellImpactExceedsTolerance = computed(
  () => sellPriceImpact.value !== null && sellPriceImpact.value > Number(maxSlippage.value)
)

// V4 薄池：CLQuoter 无法成交时返回 0，区别于未询价
const isListedV4Quote = computed(() => usesListedV4Quote(comStore.currentSelectedCommunity))
const toQuoteAmount = (v: unknown): number | null => {
  if (v === '' || v === undefined || v === null) return null
  if (typeof v === 'bigint') return Number(v)
  return Number(v?.toString?.() ?? v)
}
const isBuyLiquidityInsufficient = computed(() => {
  const pay = parseFloat(payEth.value)
  if (!pay || pay <= 0 || calculating.value || !listed.value || !isListedV4Quote.value) return false
  const recv = toQuoteAmount(receiveAmount.value)
  return recv !== null && recv <= 0
})
const isSellLiquidityInsufficient = computed(() => {
  const sell = parseFloat(sellAmount.value)
  if (!sell || sell <= 0 || calculating.value || !listed.value || !isListedV4Quote.value) return false
  const recv = toQuoteAmount(receiveEth.value)
  return recv !== null && recv <= 0
})

// MAX：用全部 BNB 余额买入，预留 0.005 作 gas
function setMaxBuy() {
  const max = Math.max(ethBalance.value - 0.005, 0)
  payEth.value = max > 0 ? max.toFixed(6) : ''
}

const updateBuyAmount = debounce(async (val: any) => {
  const seq = ++buyQuoteSeq
  const str = normalizeAmountStr(val)
  if (!comStore.currentSelectedCommunity) {
    trading.value = false
    calculating.value = false
    receiveAmount.value = ''
    quoteSpotPrice.value = null
    return
  }
  if (isIncompleteAmountInput(str)) {
    trading.value = false
    calculating.value = false
    receiveAmount.value = ''
    quoteSpotPrice.value = null
    return
  }
  const num = parseFloat(str)
  if (!isFinite(num) || num <= 0) {
    trading.value = false
    calculating.value = false
    receiveAmount.value = ''
    quoteSpotPrice.value = null
    return
  }
  showFillInfo.value = false
  const amount = parseEther(str)
  const community = comStore.currentSelectedCommunity
 try {
  if (isV8PreListNoTrade.value) {
    receiveAmount.value = ''
    quoteSpotPrice.value = null
    calculating.value = false
    return
  }
  let receive: bigint
  let spot = 0
  if (community?.isImport && chainStore.deployment.key === 'bsc') {
    const dexVersion = Number(community.dexVersion ?? 2)
    const recipient = accStore.ethConnectAddress
    const sellsman = stateStore.sellsman ?? community.ipshare
    receive = isAddress(recipient ?? '')
      ? await simulateImportedTokenBuy(
          community.token!, community.pair, dexVersion, amount, recipient, sellsman,
        )
      : await quoteImportedTokenBuy(community.token!, community.pair, dexVersion, amount)
    try {
      let pricePair = community.pair!
      if (dexVersion === 4) {
        const poolKey = await resolveV4PoolKeyForTrade(community.pair)
        if (poolKey) pricePair = JSON.stringify(poolKey)
      }
      spot = await getImportTokenPrice(community.token!, pricePair, dexVersion, {}, stateStore.ethPrice) ?? 0
    } catch (e) { console.warn('getImportTokenPrice failed', e) }
  } else if (listed.value) {
    if (usesListedV4Quote(community)) {
      if (chainStore.deployment.dex.kind !== 'pancake') {
        const poolKey = await resolveRhV4PoolKeyForTrade(community!.pair)
        if (!poolKey) throw new Error('invalid RH V4 PoolKey')
        receive = await quoteRhV4(poolKey, amount, true, !usesDirectRhV4Trade(community))
        const poolId = resolveV4PoolId(community!.pair)
        try { spot = poolId ? await getRhV4SpotPrice(poolId) : 0 } catch (e) { console.warn('getRhV4SpotPrice failed', e) }
      } else {
        const poolKey = await resolveV4PoolKeyForTrade(community!.pair)
        if (!poolKey) throw new Error('invalid V4 pool')
        const poolId = resolveV4PoolId(community!.pair) ?? poolKeyToPoolId(poolKey)
        const sellsman = (stateStore.sellsman ?? community!.ipshare) as `0x${string}` | undefined
        receive = await getV4BuyQuote(poolKey, community!.token as `0x${string}`, amount, sellsman)
        try {
          spot = community?.isImport
            ? await getImportTokenPrice(community.token!, JSON.stringify(poolKey), 4, {}, stateStore.ethPrice) ?? 0
            : await getV4SpotPrice(poolId)
        } catch (e) { console.warn('getV4SpotPrice failed', e) }
      }
    } else if (community?.isImport && Number(community.dexVersion) === 3) {
      receive = await getV3BuyAmountUseEth(community.token!, community.pair!, amount * 9800n / 10000n)
      const nativePool = await resolveV3NativePool(community.token!, community.pair!)
      spot = await getImportTokenPrice(community.token!, nativePool.pair, 3, {}, stateStore.ethPrice) ?? 0
    } else if (community?.isImport && Number(community.dexVersion ?? 2) === 2) {
      const nativePair = await resolveV2NativePair(community.token!)
      receive = await getImportedV2BuyAmountUseNative(community.token!, amount * 9800n / 10000n)
      spot = await getImportTokenPrice(community.token!, nativePair, 2, {}, stateStore.ethPrice) ?? 0
    } else {
      receive = await getBuyAmountUseEth(community!.token, amount * 9800n / 10000n)
      try {
        spot = await getUniswapV2SpotPrice(community!.token!, community!.pair!)
      } catch (e) {
        console.warn('getUniswapV2SpotPrice failed', e)
      }
    }
  } else {
    const version = community?.version ?? 2
    const {receive: quoted, supply} = await getBuyAmountWithETHAfterFee(community?.token, version, amount)
    receive = quoted
    try {
      spot = await getBondingCurveSpotPrice(version, supply as bigint)
    } catch (e) {
      console.warn('getBondingCurveSpotPrice failed', e)
    }
    if (receive > parseEther('650000000') * 9950n / 10000n - supply) {
      updatedReveiveAmount = parseEther('650000010') - supply
      updatedBuyValue = await getBuyPriceAfterFee(supply as bigint, updatedReveiveAmount as bigint) * 10000n / 9900n
      willListing = true
    }else{
      updatedReveiveAmount = receive
      willListing = false
    }
  }
  if (seq !== buyQuoteSeq) return
  receiveAmount.value = receive
  quoteSpotPrice.value = spot > 0 ? spot : null
  } catch (error) {
    if (seq !== buyQuoteSeq) return
    console.warn('Buy quote failed', error)
    // Empty means unavailable; zero is reserved for a successful quote that
    // cannot cross the pool and must not mask RPC/encoding failures.
    receiveAmount.value = ''
    quoteSpotPrice.value = null
  }finally {
  if (seq === buyQuoteSeq) calculating.value = false
 }
}, 500)

const updateSellAmount = debounce(async (val: any) => {
  const seq = ++sellQuoteSeq
  try {
    const str = normalizeAmountStr(val)
    if (!comStore.currentSelectedCommunity) {
      receiveEth.value = ''
      quoteSpotPrice.value = null
      return
    }
    // 不完整小数输入（如 "0."）仅清空询价结果，不改动输入框
    if (isIncompleteAmountInput(str)) {
      receiveEth.value = ''
      quoteSpotPrice.value = null
      calculating.value = false
      return
    }
    const num = parseFloat(str)
    if (!isFinite(num) || num <= 0) {
      receiveEth.value = ''
      quoteSpotPrice.value = null
      calculating.value = false
      return
    }
    showFillInfo.value = false
    const amount = parseEther(str)
    const community = comStore.currentSelectedCommunity
    if (isV8PreListNoTrade.value) {
      receiveEth.value = ''
      quoteSpotPrice.value = null
      calculating.value = false
      return
    }
    let receive: bigint
    let spot = 0
    if (community?.isImport && chainStore.deployment.key === 'bsc') {
      const dexVersion = Number(community.dexVersion ?? 2)
      receive = await quoteImportedTokenSell(community.token!, community.pair, dexVersion, amount)
      try {
        let pricePair = community.pair!
        if (dexVersion === 4) {
          const poolKey = await resolveV4PoolKeyForTrade(community.pair)
          if (poolKey) pricePair = JSON.stringify(poolKey)
        }
        spot = await getImportTokenPrice(community.token!, pricePair, dexVersion, {}, stateStore.ethPrice) ?? 0
      } catch (e) { console.warn('getImportTokenPrice failed', e) }
    } else if (listed.value) {
      if (usesListedV4Quote(community)) {
        if (chainStore.deployment.dex.kind !== 'pancake') {
          const poolKey = await resolveRhV4PoolKeyForTrade(community!.pair)
          if (!poolKey) throw new Error('invalid RH V4 PoolKey')
          receive = await quoteRhV4(poolKey, amount, false, !usesDirectRhV4Trade(community))
          const poolId = resolveV4PoolId(community!.pair)
          try { spot = poolId ? await getRhV4SpotPrice(poolId) : 0 } catch (e) { console.warn('getRhV4SpotPrice failed', e) }
        } else {
          const poolKey = await resolveV4PoolKeyForTrade(community!.pair)
          if (!poolKey) throw new Error('invalid V4 pool')
          const poolId = resolveV4PoolId(community!.pair) ?? poolKeyToPoolId(poolKey)
          const sellsman = (stateStore.sellsman ?? community!.ipshare) as `0x${string}` | undefined
          receive = await getV4SellQuote(poolKey, community!.token as `0x${string}`, amount, sellsman)
          try {
            spot = community?.isImport
              ? await getImportTokenPrice(community.token!, JSON.stringify(poolKey), 4, {}, stateStore.ethPrice) ?? 0
              : await getV4SpotPrice(poolId)
          } catch (e) { console.warn('getV4SpotPrice failed', e) }
        }
      } else if (community?.isImport && Number(community.dexVersion) === 3) {
        receive = await getV3SellAmountUseToken(community.token!, community.pair!, amount)
        const nativePool = await resolveV3NativePool(community.token!, community.pair!)
        spot = await getImportTokenPrice(community.token!, nativePool.pair, 3, {}, stateStore.ethPrice) ?? 0
      } else if (community?.isImport && Number(community.dexVersion ?? 2) === 2) {
        const nativePair = await resolveV2NativePair(community.token!)
        receive = await getImportedV2SellAmountUseToken(community.token!, amount)
        spot = await getImportTokenPrice(community.token!, nativePair, 2, {}, stateStore.ethPrice) ?? 0
      } else {
        receive = await getSellAmountUseToken(community!.token, amount)
        try {
          spot = await getUniswapV2SpotPrice(community!.token!, community!.pair!)
        } catch (e) {
          console.warn('getUniswapV2SpotPrice failed', e)
        }
      }
    } else {
      const version = community?.version ?? 2
      const supply = await readContract('Token1', 'bondingCurveSupply', [], community!.token! as `0x${string}`) as bigint
      receive = await getReceivedAmountSellETHAfterFee(community?.token, version, amount)
      try {
        spot = await getBondingCurveSpotPrice(version, supply)
      } catch (e) {
        console.warn('getBondingCurveSpotPrice failed', e)
      }
    }
    if (seq !== sellQuoteSeq) return
    receiveEth.value = receive
    quoteSpotPrice.value = spot > 0 ? spot : null
  } catch (error) {
    if (seq !== sellQuoteSeq) return
    console.warn('Sell quote failed', error)
    receiveEth.value = ''
    quoteSpotPrice.value = null
  }finally {
    if (seq === sellQuoteSeq) calculating.value = false
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
  // 交易只要求链上钱包，不要求 TagAI / Twitter 登录。社交登录仅用于
  // Log in、Wallet、Profile 和发帖等账户功能，不能拦截纯链上交易。
  if (!isWalletConnected.value) {
    modalStore.setModalVisible(true, GlobalModalType.ChoseWallet)
    return;
  }
  // V5 bonding-curve buys still require the backend reputation signature,
  // which is only available to a registered TagAI account. Listed/imported
  // token swaps remain wallet-only.
  const requiresLegacyTradeAccount = !listed.value && comStore.currentSelectedCommunity?.version === 5
  if ((isPostTweet.value || requiresLegacyTradeAccount) && !accStore.getAccountInfo?.twitterId) {
    modalStore.setModalVisible(true, GlobalModalType.Login)
    return
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
      // 上市后 PCS V4（Pump v7-v9 或导入币 dexVersion=4）
      if (usesListedV4Quote(token) && listed.value && !(token.isImport && chainStore.deployment.key === 'bsc')) {
        const ethAmount = parseEther(payEth.value.toString());
        if (chainStore.deployment.dex.kind === 'uniswap') {
          const poolKey = await resolveRhV4PoolKeyForTrade(token.pair)
          if (!poolKey || !receiveAmount.value) throw new Error('RH V4 PoolKey or quote is unavailable')
          const sellsman = (stateStore.sellsman ?? token.ipshare ?? zeroAddress) as `0x${string}`
          hash = usesDirectRhV4Trade(token)
            ? await buyTokenV4RhDirect(poolKey, ethAmount, receiveAmount.value, sellsman,
                Math.ceil(maxSlippage.value * 100))
            : await buyTokenV4Rh(poolKey, ethAmount, receiveAmount.value, sellsman)
        } else {
          const poolKey = await resolveV4PoolKeyForTrade(token!.pair)
          if (!poolKey) throw new Error('invalid V4 pool')
          hash = await buyTokenV4(poolKey, token.token as `0x${string}`, ethAmount, receiveAmount.value ?? 0n,
            (stateStore.sellsman ?? token.ipshare) as `0x${string}`, Math.ceil(maxSlippage.value * 100));
        }
      } else {
        // check list
        const tradePair = token.pair
        const buyValue = willListing ? updatedBuyValue : parseEther(payEth.value.toString())
        const sellsman = stateStore.sellsman ?? token.ipshare
        // Re-simulate immediately before submission. Imported V2/V3 tokens may
        // deduct a transfer fee that quoteBuy cannot predict; slippage must be
        // applied to the actual net amount delivered by buyToken.
        const expectedAmount = token.isImport && chainStore.deployment.key === 'bsc'
          ? await simulateImportedTokenBuy(
              token.token, tradePair, Number(token.dexVersion ?? 2), buyValue,
              accStore.ethConnectAddress, sellsman,
            )
          : (willListing ? updatedReveiveAmount : receiveAmount.value)
        hash = await buyToken(token.token, token.version ?? 2, expectedAmount, buyValue, sellsman as any, listed.value!, token.isImport!, Math.ceil(maxSlippage.value * 100), token.dexVersion ?? 2, tradePair);
      }
      if (hash) {
        payEth.value = ''
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
      // 上市后 PCS V4（Pump v7-v9 或导入币 dexVersion=4）
      if (usesListedV4Quote(token) && listed.value && !(token.isImport && chainStore.deployment.key === 'bsc')) {
        if (chainStore.deployment.dex.kind === 'uniswap') {
          const poolKey = await resolveRhV4PoolKeyForTrade(token.pair)
          if (!poolKey || !receiveEth.value) throw new Error('RH V4 PoolKey or quote is unavailable')
          const sellsman = (stateStore.sellsman ?? token.ipshare ?? zeroAddress) as `0x${string}`
          hash = usesDirectRhV4Trade(token)
            ? await sellTokenV4RhDirect(poolKey, token.token as `0x${string}`, finalSellAmount,
                receiveEth.value, sellsman, Math.ceil(maxSlippage.value * 100))
            : await sellTokenV4Rh(poolKey, token.token as `0x${string}`, finalSellAmount,
                receiveEth.value, sellsman)
        } else {
          const poolKey = await resolveV4PoolKeyForTrade(token!.pair)
          if (!poolKey) throw new Error('invalid V4 pool')
          hash = await sellTokenV4(poolKey, token!.token as `0x${string}`, finalSellAmount,
            receiveEth.value ?? 0n, (stateStore.sellsman ?? token.ipshare) as `0x${string}`,
            Math.ceil(maxSlippage.value * 100));
        }
      } else {
        const tradePair = token.pair
        hash = await sellToken(token!.token, token!.version ?? 4, finalSellAmount, receiveEth.value, (stateStore.sellsman ?? token.ipshare) as any, listed.value!, token!.isImport!, Math.ceil(maxSlippage.value * 100), token!.dexVersion ?? 2, tradePair);
      }
      if (hash) {
        sellAmount.value = ''
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
        <button @click="$router.push('/tag-detail/' + comStore.currentSelectedCommunity?.tick)" class="absolute top-4 right-3 h-8 w-8 min-w-8 bg-surface rounded-full flex items-center justify-center">
          <img class="rounded-full" :src="comStore.currentSelectedCommunity?.logo" alt="" srcset="">
        </button>
      </template>
    </BackHeader> -->
    <div
      class="flex-1 overflow-auto flex gap-2"
      :class="showDesktopChart ? '' : 'web:justify-end'"
    >
      <div v-if="showDesktopChart"
           class="w-full h-[360px] hidden web:flex min-w-[320px] flex-1 gap-3">
        <Kline v-if="!comStore.currentSelectedCommunity?.listed" :tick="comStore.currentSelectedCommunity?.tick" chart-id="k-line-chart1"/>
        <iframe v-else :src="`https://dexscreener.com/${dexScreenerChain}/${getDexScreenerEmbedPath(comStore.currentSelectedCommunity)}?embed=1&loadChartSettings=0&trades=0&tabs=0&chartLeftToolbar=0&chartTimeframesToolbar=0&info=1&loadChartSettings=0&chartDefaultOnMobile=1&chartTheme=${dexTheme}&theme=${dexTheme}&chartStyle=1&chartType=usd&interval=15`"
        frameborder="0" class="w-full h-full"></iframe>

      </div>
      <div v-if="comStore.currentSelectedCommunity?.tick && comStore.currentSelectedCommunity?.tick !== '币安小说'" class="bg-surface py-3 web:py-5 px-4 rounded-2xl flex flex-col gap-2 web:gap-3 w-full" :class="props.tick?'':'web:w-[340px]'">
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
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-content flex items-center"
          >
            <span class="text-h5">{{ $t('pay') }}</span>
            <input
              v-model="payEth"
              type="text"
              inputmode="decimal"
              class="bg-transparent h-full flex-1 w-[120px] text-h3 tabular-nums"
              :disabled="isV8PreListNoTrade"
            />
            <span class="text-h5 whitespace-nowrap">$ {{ nativeSymbol }}</span>
          </div>
          <div class="grid grid-cols-5 gap-1 h-8 text-sm">
            <button v-for="i of defaultAmount"
              class="col-span-1 p-1 rounded-full h-full flex-1 text-white bg-grey-light-active"
              @click="payEth = String(i)"
              :disabled="isV8PreListNoTrade"
              :class="payEth === String(i) ? 'bg-gradient-primary' : ''">
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
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-content flex items-center justify-between"
          >
            <span class="text-h5"
              >{{$t('receive')}} ${{ comStore.currentSelectedCommunity?.tick }}</span
            >
            <span class="text-h3 tabular-nums">{{ formatAmount(receiveAmount?.toString() / 1e18) }}</span>
          </div>
          <div v-if="isBuyLiquidityInsufficient" class="text-sm text-orange-normal px-1">
            {{ $t('buyAndSell.insufficientLiquidity') }}
          </div>
          <div v-if="buyPriceImpact !== null && !calculating" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.priceImpact') }}</span>
            <div class="flex items-center gap-1.5">
              <span v-if="isBuyImpactExceedsTolerance" class="text-xs text-orange-normal">⚠ {{ $t('buyAndSell.highSlippageWarn') }}</span>
              <span class="tabular-nums" :class="buyPriceImpact > 5 ? 'text-orange-normal font-semibold' : ''">{{ buyPriceImpact.toFixed(2) }}%</span>
            </div>
          </div>
          <div v-if="receiveAmount && Number(receiveAmount) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.minReceived') }} ({{ Number(maxSlippage) }}%)</span>
            <span>{{ formatAmount((receiveAmount?.toString() / 1e18) * (1 - Number(maxSlippage) / 100)) }} ${{ comStore.currentSelectedCommunity?.tick }}</span>
          </div>
          <div v-if="isV9OrV11FeeModel && receiveAmount && Number(receiveAmount) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.platformFee') }}</span>
            <span class="tabular-nums">{{ (V9_PLATFORM_FEE * 100).toFixed(1) }}%</span>
          </div>
          <div v-if="isV9OrV11FeeModel && receiveAmount && Number(receiveAmount) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.ipShareFee') }}</span>
            <span class="tabular-nums">{{ (V9_IPSHARE_FEE * 100).toFixed(1) }}%</span>
          </div>
        </template>
        <template v-else>
          <div
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-content flex items-center"
          >
            <span class="text-h5">{{ $t('sell') }}</span>
            <input
              v-model="sellAmount"
              type="text"
              inputmode="decimal"
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
            class="border-[1px] border-grey-c9 rounded-xl px-4 h-9 web:h-11 gap-4 text-content flex items-center justify-between"
          >
            <span class="text-h5">{{ $t('receive') }} ${{ nativeSymbol }}</span>
            <span class="text-h3 tabular-nums">{{ formatAmount(receiveEth?.toString() / 1e18) }}</span>
          </div>
          <div v-if="isSellLiquidityInsufficient" class="text-sm text-orange-normal px-1">
            {{ $t('buyAndSell.insufficientLiquidity') }}
          </div>
          <div v-if="sellPriceImpact !== null && !calculating" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.priceImpact') }}</span>
            <div class="flex items-center gap-1.5">
              <span v-if="isSellImpactExceedsTolerance" class="text-xs text-orange-normal">⚠ {{ $t('buyAndSell.highSlippageWarn') }}</span>
              <span class="tabular-nums" :class="sellPriceImpact > 5 ? 'text-orange-normal font-semibold' : ''">{{ sellPriceImpact.toFixed(2) }}%</span>
            </div>
          </div>
          <div v-if="receiveEth && Number(receiveEth) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.minReceived') }} ({{ Number(maxSlippage) }}%)</span>
            <span>{{ formatAmount((receiveEth?.toString() / 1e18) * (1 - Number(maxSlippage) / 100)) }} ${{ nativeSymbol }}</span>
          </div>
          <div v-if="isV9OrV11FeeModel && receiveEth && Number(receiveEth) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.platformFee') }}</span>
            <span class="tabular-nums">{{ (V9_PLATFORM_FEE * 100).toFixed(1) }}%</span>
          </div>
          <div v-if="isV9OrV11FeeModel && receiveEth && Number(receiveEth) > 0" class="flex justify-between text-sm text-grey-64 px-1">
            <span>{{ $t('buyAndSell.ipShareFee') }}</span>
            <span class="tabular-nums">{{ (V9_IPSHARE_FEE * 100).toFixed(1) }}%</span>
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
              :class="Number(maxSlippage) === s ? 'bg-gradient-primary text-white border-transparent' : 'border-grey-light-active text-grey-64 hover:bg-surface-2'"
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
          :disabled="trading || (invalidToken && tradeType === 'buy') || calculating || (accStore.ethConnectState == EthWalletState.Connecting && !!accStore.ethConnectAddress) || isV8PreListNoTrade || (tradeType === 'buy' && isBuyLiquidityInsufficient) || (tradeType === 'sell' && isSellLiquidityInsufficient)"
        >
          <span>{{
            !isWalletConnected
              ? $t('connect')
              : (isV8PreListNoTrade
                  ? $t('buyAndSell.v8PreListAgentOnly')
                  : (listed ? $t('confirmListed') : $t('confirm')))
          }}</span>
          <i-ep-loading v-show="trading || calculating || (accStore.ethConnectState == EthWalletState.Connecting && !!accStore.ethConnectAddress)" class="animate-spin" />
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
