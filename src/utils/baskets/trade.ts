import { formatUnits, parseUnits, zeroAddress, type Address, type Hex } from 'viem'
import {
  BASKET_CHAIN_ID,
  BASKET_CONTRACTS,
  BASKET_HUB_POOL,
  BASKET_USDG_DECIMALS,
  BASKET_V3_QUOTER,
  type BasketPoolKey,
} from '@/config/baskets'
import { ROBINHOOD_CHAIN } from '@/config/chains'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import { basketSwapRouterAbi, basketTokenAbi, erc20Abi, rebalanceExecutorAbi, v3QuoterAbi, v4QuoterAbi } from './abis'
import { applySlippage, encodeBasketTradeData } from './hook-data'
import type { BasketDetail, BasketLegRoute, BasketSwapQuote, TradeSide } from './types'

export const sanitizeBasketAmountInput = (value: string | number, decimals: number): string => {
  const raw = String(value).replace(/[^\d.]/g, '')
  const dot = raw.indexOf('.')
  if (dot < 0) return raw
  const whole = raw.slice(0, dot)
  const fraction = raw.slice(dot + 1).replace(/\./g, '').slice(0, Math.max(0, decimals))
  return decimals > 0 ? `${whole}.${fraction}` : whole
}

const normalizeBasketAmount = (value: string | number, decimals: number): string => {
  const raw = String(value).trim()
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) throw new Error('Invalid amount')
  const [whole = '', fraction = ''] = raw.split('.')
  const normalizedWhole = whole || '0'
  const normalizedFraction = fraction.slice(0, Math.max(0, decimals))
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole
}

export const friendlyBasketError = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error)
  if (/user rejected|denied transaction|4001/i.test(text)) return 'Transaction cancelled'
  if (/insufficient funds/i.test(text)) return 'Insufficient ETH for gas'
  if (/SlippageExceeded|MinOutputNotMet/i.test(text)) return 'Price moved beyond your slippage limit'
  if (/SellLegFailed/i.test(text)) return 'A constituent could not be sold'
  if (/FirstMintLegMinRequired/i.test(text)) return 'First purchase requires protected constituent quotes'
  if (/execution reverted/i.test(text)) return 'Transaction would revert. Check liquidity and try a smaller amount.'
  return text.split('\n')[0] || 'Transaction failed'
}

export const getTradeAllowance = async (token: Address, owner: Address): Promise<bigint> =>
  getReadOnlyClient(BASKET_CHAIN_ID).readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, BASKET_CONTRACTS.swapRouter],
  })

export const approveBasketTrade = async (token: Address, amount: bigint, account: Address): Promise<Hex> => {
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const publicClient = getReadOnlyClient(BASKET_CHAIN_ID)
  const { request } = await publicClient.simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [BASKET_CONTRACTS.swapRouter, amount],
  })
  const hash = await wallet.writeContract(request)
  const confirmed = await waitForTx(hash)
  if (!confirmed) throw new Error('Approval failed')
  return hash
}

export const quoteWethToAsset = (route: BasketLegRoute, asset: Address, amount: bigint): Promise<bigint> =>
  getReadOnlyClient(BASKET_CHAIN_ID).readContract({
    address: BASKET_CONTRACTS.rebalanceExecutor,
    abi: rebalanceExecutorAbi,
    functionName: 'quoteWethToAsset',
    args: [route, asset, amount],
  })

const quoteV4ExactInput = async (poolKey: BasketPoolKey, inputToken: Address, amount: bigint, hookData: Hex = '0x') => {
  const zeroForOne = poolKey.currency0.toLowerCase() === inputToken.toLowerCase()
  const { result } = await getReadOnlyClient(BASKET_CHAIN_ID).simulateContract({
    address: ROBINHOOD_CHAIN.dex.v4Quoter,
    abi: v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne, exactAmount: amount, hookData }],
  })
  return typeof result === 'bigint' ? result : result[0]
}

/**
 * Quote the amount the swap will actually return. The executor's quote helper is
 * a spot-price quote and deliberately does not include price impact, so it must
 * not be used to build a V4 swap's minimum output.
 */
export const quoteWethToAssetForSwap = (
  route: BasketLegRoute,
  asset: Address,
  amount: bigint,
): Promise<bigint> => {
  if (route.venue === 0) return quoteV4ExactInput(route.v4Pool, zeroAddress, amount)
  return getReadOnlyClient(BASKET_CHAIN_ID).simulateContract({
    address: BASKET_V3_QUOTER,
    abi: v3QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      tokenIn: BASKET_CONTRACTS.weth,
      tokenOut: asset,
      amountIn: amount,
      fee: route.v3Fee,
      sqrtPriceLimitX96: 0n,
    }],
  }).then(({ result }) => result[0])
}

const selfPoolKey = (basket: Address) => {
  const basketFirst = basket.toLowerCase() < BASKET_CONTRACTS.usdg.toLowerCase()
  return {
    currency0: basketFirst ? basket : BASKET_CONTRACTS.usdg,
    currency1: basketFirst ? BASKET_CONTRACTS.usdg : basket,
    fee: 0,
    tickSpacing: 60,
    hooks: BASKET_CONTRACTS.hook,
  }
}

const buyLegMins = async (detail: BasketDetail, usdgIn: bigint, slippageBps: number): Promise<bigint[]> => {
  const grossWeth = await quoteV4ExactInput(BASKET_HUB_POOL, BASKET_CONTRACTS.usdg, usdgIn)
  const feeWeth = (grossWeth * BigInt(detail.basketFeeBps) + 9_999n) / 10_000n
  const netWeth = grossWeth - feeWeth
  let allocated = 0n
  const outputs: bigint[] = []
  for (let index = 0; index < detail.holdings.length; index += 1) {
    const holding = detail.holdings[index]
    const weightBps = Math.round(holding.targetWeightPct * 100)
    const amountIn = index === detail.holdings.length - 1
      ? netWeth - allocated
      : netWeth * BigInt(weightBps) / 10_000n
    allocated += amountIn
    outputs.push(await quoteWethToAssetForSwap(holding.route, holding.asset, amountIn))
  }
  const mins = outputs.map((amount) => applySlippage(amount, slippageBps))
  if (mins.length !== detail.basketLength || mins.some((amount) => amount <= 0n)) {
    throw new Error('A constituent route has insufficient liquidity')
  }
  return mins
}

export const quoteBasketSwap = async ({
  side,
  amount,
  detail,
  slippageBps,
}: {
  side: TradeSide
  amount: string | number
  detail: BasketDetail
  slippageBps: number
}): Promise<BasketSwapQuote> => {
  const decimals = side === 'buy' ? BASKET_USDG_DECIMALS : detail.decimals
  const amountText = normalizeBasketAmount(amount, decimals)
  const amountRaw = parseUnits(amountText, decimals)
  if (amountRaw <= 0n || amountRaw >= 2n ** 128n) throw new Error('Invalid amount')
  const key = selfPoolKey(detail.address)
  const isFirstMint = side === 'buy' && (detail.effectiveSupply ?? 0) === 0
  // Always provide buy-leg limits. The Hook's spot-price fallback does not
  // deduct the pool fee (some curated pools charge 5%), so its built-in 3%
  // tolerance is not sufficient even when price impact is negligible.
  const legMins = side === 'buy' ? await buyLegMins(detail, amountRaw, slippageBps) : []
  const zeroForOne = side === 'buy'
    ? key.currency0.toLowerCase() === BASKET_CONTRACTS.usdg.toLowerCase()
    : key.currency0.toLowerCase() === detail.address.toLowerCase()
  const hookData = encodeBasketTradeData({
    side,
    minOut: 0n,
    legCount: detail.basketLength,
    firstMint: isFirstMint,
    legMins,
  })

  try {
    const { result } = await getReadOnlyClient(BASKET_CHAIN_ID).simulateContract({
      address: ROBINHOOD_CHAIN.dex.v4Quoter,
      abi: v4QuoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ poolKey: key, zeroForOne, exactAmount: amountRaw, hookData }],
    })
    const estimatedOutRaw = typeof result === 'bigint' ? result : result[0]
    return {
      amountRaw,
      estimatedOutRaw,
      estimatedOut: Number(formatUnits(estimatedOutRaw, side === 'buy' ? detail.decimals : BASKET_USDG_DECIMALS)),
      minOutRaw: applySlippage(estimatedOutRaw, slippageBps),
      legCount: detail.basketLength,
      legMins,
      source: 'quoter',
    }
  } catch {
    const input = Number(amountText)
    const fee = detail.basketFeeBps / 10_000
    const estimated = side === 'buy'
      ? (detail.navPerToken > 0 ? input * (1 - fee) / detail.navPerToken : input * (1 - fee))
      : input * detail.navPerToken * (1 - fee)
    const estimatedOutRaw = parseUnits(
      Math.max(estimated, 0).toFixed(side === 'buy' ? detail.decimals : BASKET_USDG_DECIMALS),
      side === 'buy' ? detail.decimals : BASKET_USDG_DECIMALS,
    )
    return {
      amountRaw,
      estimatedOutRaw,
      estimatedOut: estimated,
      minOutRaw: applySlippage(estimatedOutRaw, slippageBps),
      legCount: detail.basketLength,
      legMins,
      source: 'nav',
    }
  }
}

export const executeBasketSwap = async ({
  side,
  detail,
  quote,
  account,
}: {
  side: TradeSide
  detail: BasketDetail
  quote: BasketSwapQuote
  account: Address
}): Promise<Hex> => {
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const firstMint = side === 'buy' && (detail.effectiveSupply ?? 0) === 0
  const hookData = encodeBasketTradeData({
    side,
    minOut: quote.minOutRaw,
    legCount: detail.basketLength,
    firstMint,
    legMins: quote.legMins,
  })
  const functionName = side === 'buy' ? 'buyExactUsdg' : 'sellExactBasket'
  const args = [detail.address, quote.amountRaw, quote.minOutRaw, hookData, account] as const
  const publicClient = getReadOnlyClient(BASKET_CHAIN_ID)
  const { request } = await publicClient.simulateContract({
    account,
    address: BASKET_CONTRACTS.swapRouter,
    abi: basketSwapRouterAbi,
    functionName,
    args,
  })
  const hash = await wallet.writeContract(request)
  const confirmed = await waitForTx(hash)
  if (!confirmed) throw new Error('Transaction failed')
  return hash
}

export const isBasketContract = async (address: Address): Promise<boolean> =>
  getReadOnlyClient(BASKET_CHAIN_ID).readContract({
    address,
    abi: basketTokenAbi,
    functionName: 'effectiveSupply',
  }).then(() => true, () => false)

export const noFrontendAddress = zeroAddress
