import { computed, ref, watch, type Ref } from 'vue'
import { formatUnits, type Address } from 'viem'
import { useI18n } from 'vue-i18n'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import {
  BASKET_DEFAULT_SLIPPAGE_BPS,
  BASKET_MAX_SLIPPAGE_BPS,
  getBasketDeployment,
} from '@/config/baskets'
import { getBasketBalance, getErc20Balance, invalidateBasketCache } from '@/utils/baskets/data'
import type { BasketDetail, BasketSwapQuote, TradeSide } from '@/utils/baskets/types'
import {
  approveBasketTrade,
  executeBasketSwap,
  basketTradeErrorKey,
  getTradeAllowance,
  quoteBasketSwap,
  sanitizeBasketAmountInput,
} from '@/utils/baskets/trade'

export type TradeStep = 'idle' | 'quoting' | 'approving' | 'swapping' | 'success' | 'error'

export const useBasketTrade = (detail: Ref<BasketDetail | null>) => {
  const { t } = useI18n()
  const side = ref<TradeSide>('buy')
  // Vue casts values from <input type="number"> to numbers at runtime even
  // without the .number modifier. Keep the state honest and normalize before
  // passing it to viem's string-only parseUnits helper.
  const amountInput = ref<string | number>('')
  const slippageBps = ref(BASKET_DEFAULT_SLIPPAGE_BPS)
  const validSlippage = computed(() => Number.isInteger(slippageBps.value) && slippageBps.value >= 1 && slippageBps.value <= BASKET_MAX_SLIPPAGE_BPS)
  const step = ref<TradeStep>('idle')
  const txHash = ref<string | null>(null)
  const errorMessage = ref('')
  const usdgBalance = ref(0n)
  const basketBalance = ref(0n)
  const allowance = ref(0n)
  const quote = ref<BasketSwapQuote | null>(null)
  let quoteRequest = 0
  let quoteTimer: ReturnType<typeof setTimeout> | null = null

  const accountStore = useAccountStore()
  const chainStore = useChainStore()
  const account = computed(() => {
    const connected = accountStore.ethConnectAddress
    return connected ? connected as Address : undefined
  })
  const deployment = computed(() => getBasketDeployment(detail.value?.chainId ?? chainStore.activeChainId))
  const isOnBasketChain = computed(() => !!detail.value && chainStore.activeChainId === detail.value.chainId)
  const canTradeConfig = computed(() => Boolean(deployment.value.contracts.swapRouter && deployment.value.contracts.settlementToken))
  const amount = computed(() => {
    const value = Number(amountInput.value)
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const allLegsPriced = computed(() => !!detail.value?.fullyPriced)
  const needsApproval = computed(() => !!quote.value && allowance.value < quote.value.amountRaw)

  const refreshQuote = async () => {
    const current = ++quoteRequest
    const basket = detail.value
    if (!basket || amount.value <= 0 || !validSlippage.value) {
      quote.value = null
      return
    }
    step.value = 'quoting'
    errorMessage.value = ''
    try {
      const next = await quoteBasketSwap({
        side: side.value,
        amount: String(amountInput.value),
        detail: basket,
        slippageBps: slippageBps.value,
      })
      if (current === quoteRequest) quote.value = next
    } catch (error) {
      if (current === quoteRequest) {
        quote.value = null
        console.warn('[baskets] quote failed', error)
        errorMessage.value = t(basketTradeErrorKey(error))
      }
    } finally {
      if (current === quoteRequest && step.value === 'quoting') step.value = 'idle'
    }
  }

  const scheduleQuote = () => {
    if (quoteTimer) clearTimeout(quoteTimer)
    quote.value = null
    errorMessage.value = ''
    quoteTimer = setTimeout(() => void refreshQuote(), 350)
  }

  const refreshBalances = async () => {
    const basket = detail.value
    const owner = account.value
    if (!basket || !owner || !isOnBasketChain.value) {
      usdgBalance.value = 0n
      basketBalance.value = 0n
      allowance.value = 0n
      return
    }
    const config = getBasketDeployment(basket.chainId)
    const tokenIn = side.value === 'buy' ? config.contracts.settlementToken : basket.address
    try {
      const [settlement, shares, approved] = await Promise.all([
        getErc20Balance(config.contracts.settlementToken, owner, basket.chainId),
        getBasketBalance(basket.address, owner, basket.chainId),
        getTradeAllowance(tokenIn, owner, basket.chainId, basket.version),
      ])
      usdgBalance.value = settlement
      basketBalance.value = shares
      allowance.value = approved
    } catch (error) {
      console.warn('[baskets] refresh balances failed', error)
    }
  }

  watch([detail, account, side, isOnBasketChain], () => void refreshBalances(), { immediate: true })
  watch([amountInput, side, slippageBps, detail], scheduleQuote)

  const setMax = () => {
    const basket = detail.value
    if (!basket) return
    amountInput.value = side.value === 'buy'
      ? formatUnits(usdgBalance.value, deployment.value.settlementDecimals)
      : formatUnits(basketBalance.value, basket.decimals)
  }

  const setAmountInput = (value: string | number) => {
    const decimals = side.value === 'buy' ? deployment.value.settlementDecimals : (detail.value?.decimals ?? 18)
    amountInput.value = sanitizeBasketAmountInput(value, decimals)
  }

  const runTrade = async () => {
    const basket = detail.value
    const owner = account.value
    errorMessage.value = ''
    txHash.value = null
    if (!basket || !owner || !quote.value || !validSlippage.value) {
      errorMessage.value = t('baskets.tradeEnterAmount')
      step.value = 'error'
      return
    }
    if (!isOnBasketChain.value) {
      errorMessage.value = t('v13Operation.wallet')
      step.value = 'error'
      return
    }
    const tokenIn = side.value === 'buy' ? deployment.value.contracts.settlementToken : basket.address
    const tradeSide = side.value, tradeQuote = quote.value, tradeSlippage = slippageBps.value
    try {
      if (needsApproval.value) {
        step.value = 'approving'
        await approveBasketTrade(tokenIn, tradeQuote.amountRaw, owner, basket.chainId, basket.version)
        await refreshBalances()
      }
      step.value = 'swapping'
      const finalQuote = basket.chainId === 56 && Number(basket.version) >= 4
        ? await quoteBasketSwap({ side: tradeSide, amount: formatUnits(tradeQuote.amountRaw, tradeSide === 'buy' ? deployment.value.settlementDecimals : basket.decimals), detail: basket, slippageBps: tradeSlippage })
        : tradeQuote
      if (account.value?.toLowerCase() !== owner.toLowerCase() || !isOnBasketChain.value) throw new Error('Wallet or chain changed')
      // Refresh after approvals, but never reduce the minimum the user accepted.
      if (finalQuote.minOutRaw < tradeQuote.minOutRaw) finalQuote.minOutRaw = tradeQuote.minOutRaw
      quote.value = finalQuote
      const hash = await executeBasketSwap({ side: tradeSide, detail: basket, quote: finalQuote, account: owner })
      txHash.value = hash
      step.value = 'success'
      amountInput.value = ''
      invalidateBasketCache(basket.address)
      await refreshBalances()
    } catch (error) {
      console.error('[baskets] trade simulation or execution failed', error)
      step.value = 'error'
      errorMessage.value = t(basketTradeErrorKey(error))
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
    validSlippage,
    step,
    txHash,
    errorMessage,
    usdgBalance,
    basketBalance,
    allowance,
    quote,
    needsApproval,
    allLegsPriced,
    isOnBasketChain,
    deployment,
    canTradeConfig,
    account,
    refreshBalances,
    setMax,
    setAmountInput,
    runTrade,
    resetStep,
  }
}
