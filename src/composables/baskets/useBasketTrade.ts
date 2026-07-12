/**
 * Baskets 买卖状态机
 */
import { computed, ref, watch, type Ref } from 'vue'
import { formatUnits, type Address } from 'viem'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import {
  hasSpectrumFeeWallet,
  SPECTRUM_CHAIN_ID,
  SPECTRUM_DEFAULT_SLIPPAGE_BPS,
  SPECTRUM_USDC_DECIMALS,
} from '@/config/spectrum'
import { getSpectrumDeployment } from '@/utils/spectrum/deployments'
import {
  getBasketBalance,
  getErc20Balance,
  invalidateBasketCache,
  type BasketDetail,
} from '@/utils/spectrum/basket-data'
import { buildSwapQuote, type TradeSide } from '@/utils/spectrum/swap-quote'
import {
  approveSpectrumTrade,
  executeSpectrumSwap,
  getTradeAllowance,
} from '@/utils/spectrum/trade'
import { friendlySpectrumRevert } from '@/utils/spectrum/decode-revert'

export type TradeStep = 'idle' | 'approving' | 'swapping' | 'success' | 'error'

export const useBasketTrade = (detail: Ref<BasketDetail | null>) => {
  const side = ref<TradeSide>('buy')
  const amountInput = ref('')
  const slippageBps = ref(SPECTRUM_DEFAULT_SLIPPAGE_BPS)
  const step = ref<TradeStep>('idle')
  const txHash = ref<string | null>(null)
  const errorMessage = ref('')
  const usdcBalance = ref(0n)
  const basketBalance = ref(0n)
  const allowance = ref(0n)

  const accStore = useAccountStore()
  const chainStore = useChainStore()

  // 优先已连接钱包地址，其次账户资料里的 ethAddr
  const account = computed(() => {
    const connected = accStore.ethConnectAddress
    if (connected) return connected as Address
    const fromProfile = accStore.getAccountInfo?.ethAddr
    return fromProfile ? (fromProfile as Address) : undefined
  })
  const isOnRh = computed(() => chainStore.activeChainId === SPECTRUM_CHAIN_ID)
  const canTradeConfig = computed(() => hasSpectrumFeeWallet() && !!getSpectrumDeployment(SPECTRUM_CHAIN_ID)?.swapRouter)

  const amount = computed(() => {
    const n = Number(amountInput.value)
    return Number.isFinite(n) && n > 0 ? n : 0
  })

  const quote = computed(() => {
    const d = detail.value
    if (!d || amount.value <= 0) return null
    return buildSwapQuote({
      side: side.value,
      amount: amount.value,
      navPerToken: d.navPerToken,
      feeFrac: d.basketFeeBps / 10_000,
      slippageBps: slippageBps.value,
      holdings: d.holdings.map((h) => ({
        symbol: h.symbol,
        decimals: h.decimals,
        targetWeightPct: h.targetWeightPct,
        priceUsd: h.priceUsd,
      })),
      basketDecimals: d.decimals,
    })
  })

  const allLegsPriced = computed(() => {
    const d = detail.value
    if (!d) return false
    return d.holdings.length > 0 && d.holdings.every((h) => h.priced)
  })

  const needsApproval = computed(() => {
    const q = quote.value
    if (!q) return false
    return allowance.value < q.amountRaw
  })

  const refreshBalances = async () => {
    const d = detail.value
    const acc = account.value
    if (!d || !acc || !isOnRh.value) {
      usdcBalance.value = 0n
      basketBalance.value = 0n
      allowance.value = 0n
      return
    }
    const dep = getSpectrumDeployment(SPECTRUM_CHAIN_ID)!
    const tokenIn = side.value === 'buy' ? dep.usdc : d.address
    try {
      const [u, b, a] = await Promise.all([
        getErc20Balance(dep.usdc, acc, SPECTRUM_CHAIN_ID),
        getBasketBalance(d.address, acc, SPECTRUM_CHAIN_ID),
        getTradeAllowance(tokenIn, acc, SPECTRUM_CHAIN_ID),
      ])
      usdcBalance.value = u
      basketBalance.value = b
      allowance.value = a
    } catch (e) {
      console.warn('[spectrum] refreshBalances', e)
    }
  }

  watch([detail, account, side, isOnRh], () => {
    void refreshBalances()
  })

  const setMax = () => {
    const d = detail.value
    if (!d) return
    if (side.value === 'buy') {
      amountInput.value = formatUnits(usdcBalance.value, SPECTRUM_USDC_DECIMALS)
    } else {
      amountInput.value = formatUnits(basketBalance.value, d.decimals)
    }
  }

  const runTrade = async () => {
    const d = detail.value
    const acc = account.value
    const q = quote.value
    errorMessage.value = ''
    txHash.value = null

    if (!d || !acc || !q) {
      errorMessage.value = 'Missing quote or wallet'
      step.value = 'error'
      return
    }
    if (!isOnRh.value) {
      errorMessage.value = 'Switch to Robinhood'
      step.value = 'error'
      return
    }
    if (!canTradeConfig.value) {
      errorMessage.value = 'Trading is not configured'
      step.value = 'error'
      return
    }
    if (side.value === 'buy' && !allLegsPriced.value) {
      errorMessage.value = 'Not all constituents are priced — buy disabled'
      step.value = 'error'
      return
    }

    const dep = getSpectrumDeployment(SPECTRUM_CHAIN_ID)!
    const tokenIn = side.value === 'buy' ? dep.usdc : d.address

    try {
      if (needsApproval.value) {
        step.value = 'approving'
        await approveSpectrumTrade(tokenIn, q.amountRaw, acc, SPECTRUM_CHAIN_ID)
        await refreshBalances()
      }
      step.value = 'swapping'
      const hash = await executeSpectrumSwap({
        side: side.value,
        basket: d.address,
        quote: q,
        slippageBps: slippageBps.value,
        account: acc,
      })
      txHash.value = hash
      step.value = 'success'
      amountInput.value = ''
      // 成交后清缓存，避免列表/详情仍显示旧 AUM
      invalidateBasketCache(d.address)
      await refreshBalances()
    } catch (e) {
      step.value = 'error'
      errorMessage.value = friendlySpectrumRevert(e)
    }
  }

  const resetStep = () => {
    step.value = 'idle'
    errorMessage.value = ''
    txHash.value = null
  }

  return {
    side,
    amountInput,
    amount,
    slippageBps,
    step,
    txHash,
    errorMessage,
    usdcBalance,
    basketBalance,
    allowance,
    quote,
    needsApproval,
    allLegsPriced,
    isOnRh,
    canTradeConfig,
    account,
    refreshBalances,
    setMax,
    runTrade,
    resetStep,
  }
}
