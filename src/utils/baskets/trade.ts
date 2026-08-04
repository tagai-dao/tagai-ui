import { formatUnits, parseUnits, zeroAddress, type Address, type Hex } from 'viem'
import {
  getBasketDeployment,
  toContractPoolKey,
  type BasketPoolKey,
} from '@/config/baskets'
import { getChainDeployment } from '@/config/chains'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import {
  bscBasketHookAbi,
  erc20Abi,
  getBasketSwapRouterAbi,
  getBasketTokenAbi,
  getRebalanceExecutorAbi,
  pancakeV4QuoterAbi,
  v3QuoterAbi,
  v4QuoterAbi,
} from './abis'
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

const basketErrorText = (error: unknown): string => {
  const parts: string[] = []
  const seen = new Set<object>()
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      parts.push(value)
      return
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    const record = value as Record<string, unknown>
    for (const key of ['message', 'shortMessage', 'details', 'data', 'raw', 'errorName', 'args', 'cause']) {
      visit(record[key])
    }
  }
  visit(error)
  return parts.join('\n') || String(error)
}

export const friendlyBasketError = (error: unknown): string => {
  const text = basketErrorText(error)
  if (/user rejected|denied transaction|4001/i.test(text)) return 'Transaction cancelled'
  if (/insufficient funds/i.test(text)) return 'Insufficient native token for gas'
  if (/NotEnoughLiquidity|0x7a5ed734|no active liquidity/i.test(text)) {
    return 'The selected pool has no active liquidity. Choose a different pool.'
  }
  if (/\bOLD\b|required 5-minute price history/i.test(text)) {
    return 'The selected V3 pool does not have the required 5-minute price history yet.'
  }
  if (/pool hook is not approved/i.test(text)) return 'The selected pool hook is not approved for Basket constituents.'
  if (/SlippageExceeded|MinOutputNotMet/i.test(text)) return 'Price moved beyond your slippage limit'
  if (/SellLegFailed/i.test(text)) return 'A constituent could not be sold'
  if (/FirstMintLegMinRequired/i.test(text)) return 'First purchase requires protected constituent quotes'
  if (/UnexpectedRevertBytes|0x6190b2b0/i.test(text)) {
    return 'The selected pool could not execute this quote. Choose a different pool.'
  }
  if (/execution reverted/i.test(text)) return 'Transaction would revert. Check liquidity and try a smaller amount.'
  return text.split('\n')[0] || 'Transaction failed'
}

export const getTradeAllowance = async (token: Address, owner: Address, chainId: number): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  return getReadOnlyClient(chainId).readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, deployment.contracts.swapRouter],
  })
}

export const approveBasketTrade = async (token: Address, amount: bigint, account: Address, chainId: number): Promise<Hex> => {
  const deployment = getBasketDeployment(chainId)
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const publicClient = getReadOnlyClient(chainId)
  const { request } = await publicClient.simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [deployment.contracts.swapRouter, amount],
  })
  const hash = await wallet.writeContract(request as any)
  const confirmed = await waitForTx(hash)
  if (!confirmed) throw new Error('Approval failed')
  return hash
}

export const quoteWethToAsset = (route: BasketLegRoute, asset: Address, amount: bigint, chainId: number): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  return getReadOnlyClient(chainId).readContract({
    address: deployment.contracts.rebalanceExecutor,
    abi: getRebalanceExecutorAbi(chainId) as any,
    functionName: chainId === 56 ? 'quoteQuoteToAsset' : 'quoteWethToAsset',
    args: [{ ...route, v4Pool: toContractPoolKey(route.v4Pool, chainId) }, asset, amount],
  } as any) as Promise<bigint>
}

const quoteV4ExactInput = async (poolKey: BasketPoolKey, inputToken: Address, amount: bigint, chainId: number, hookData: Hex = '0x') => {
  const zeroForOne = poolKey.currency0.toLowerCase() === inputToken.toLowerCase()
  const { result } = await getReadOnlyClient(chainId).simulateContract({
    address: getChainDeployment(chainId).dex.v4Quoter,
    abi: chainId === 56 ? pancakeV4QuoterAbi : v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey: toContractPoolKey(poolKey, chainId), zeroForOne, exactAmount: amount, hookData }],
  } as any)
  return typeof result === 'bigint' ? result : result[0]
}

export const quoteBasketHubExactInput = (inputToken: Address, amount: bigint, chainId: number) => {
  const deployment = getBasketDeployment(chainId)
  return quoteV4ExactInput(deployment.hubPool, inputToken, amount, chainId)
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
  chainId: number,
): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  const quoteToken = chainId === 56 && route.quoteToken === 1
    ? deployment.contracts.settlementToken
    : deployment.contracts.wrappedNative
  const infinityQuote = chainId === 56 && route.quoteToken === 1 ? quoteToken : zeroAddress
  if (route.venue === 0) return quoteV4ExactInput(route.v4Pool, infinityQuote, amount, chainId)
  if (route.venue === 2) return Promise.resolve(amount)
  return getReadOnlyClient(chainId).simulateContract({
    address: deployment.v3Quoter,
    abi: v3QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      tokenIn: quoteToken,
      tokenOut: asset,
      amountIn: amount,
      fee: route.v3Fee,
      sqrtPriceLimitX96: 0n,
    }],
  }).then(({ result }) => result[0])
}

export const quoteAssetToWethForSwap = (
  route: BasketLegRoute,
  asset: Address,
  amount: bigint,
  chainId: number,
): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  if (route.venue === 0) return quoteV4ExactInput(route.v4Pool, asset, amount, chainId)
  if (route.venue === 2) return Promise.resolve(amount)
  const quoteToken = chainId === 56 && route.quoteToken === 1
    ? deployment.contracts.settlementToken
    : deployment.contracts.wrappedNative
  return getReadOnlyClient(chainId).simulateContract({
    address: deployment.v3Quoter,
    abi: v3QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      tokenIn: asset,
      tokenOut: quoteToken,
      amountIn: amount,
      fee: route.v3Fee,
      sqrtPriceLimitX96: 0n,
    }],
  }).then(({ result }) => result[0])
}

const selfPoolKey = async (basket: Address, chainId: number): Promise<BasketPoolKey> => {
  const deployment = getBasketDeployment(chainId)
  if (chainId === 56) {
    const raw: any = await getReadOnlyClient(chainId).readContract({
      address: deployment.contracts.hook,
      abi: bscBasketHookAbi,
      functionName: 'selfPoolKey',
      args: [basket],
    })
    const parameters = (raw.parameters ?? raw[5]) as Hex
    const encoded = (BigInt(parameters) >> 16n) & 0xffffffn
    return {
      currency0: raw.currency0 ?? raw[0], currency1: raw.currency1 ?? raw[1],
      hooks: raw.hooks ?? raw[2], poolManager: raw.poolManager ?? raw[3],
      fee: Number(raw.fee ?? raw[4]), parameters,
      tickSpacing: Number(encoded >= 0x800000n ? encoded - 0x1000000n : encoded),
    }
  }
  const basketFirst = basket.toLowerCase() < deployment.contracts.settlementToken.toLowerCase()
  return {
    currency0: basketFirst ? basket : deployment.contracts.settlementToken,
    currency1: basketFirst ? deployment.contracts.settlementToken : basket,
    fee: 0,
    tickSpacing: 60,
    hooks: deployment.contracts.hook,
  }
}

export const quoteBasketBuyLegOutputs = async ({
  chainId,
  settlementIn,
  basketFeeBps,
  legs,
}: {
  chainId: number
  settlementIn: bigint
  basketFeeBps: number
  legs: { route: BasketLegRoute; asset: Address; weightBps: number }[]
}): Promise<bigint[]> => {
  const deployment = getBasketDeployment(chainId)
  if (chainId !== 56) {
    const grossWeth = await quoteV4ExactInput(
      deployment.hubPool,
      deployment.contracts.settlementToken,
      settlementIn,
      chainId,
    )
    const feeWeth = (grossWeth * BigInt(basketFeeBps) + 9_999n) / 10_000n
    const netWeth = grossWeth - feeWeth
    let allocated = 0n
    const outputs: bigint[] = []
    for (let index = 0; index < legs.length; index += 1) {
      const leg = legs[index]
      const amountIn = index === legs.length - 1
        ? netWeth - allocated
        : netWeth * BigInt(leg.weightBps) / 10_000n
      allocated += amountIn
      outputs.push(await quoteWethToAssetForSwap(leg.route, leg.asset, amountIn, chainId))
    }
    return outputs
  }

  const feeSettlement = (settlementIn * BigInt(basketFeeBps) + 9_999n) / 10_000n
  const netSettlement = settlementIn - feeSettlement
  const quoteBudgets: bigint[] = []
  let allocatedSettlement = 0n
  let wbnbSettlementBudget = 0n
  let lastWbnbLeg = -1
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index]
    const budget = index === legs.length - 1
      ? netSettlement - allocatedSettlement
      : netSettlement * BigInt(leg.weightBps) / 10_000n
    allocatedSettlement += budget
    quoteBudgets.push(budget)
    if (leg.route.quoteToken !== 1) {
      wbnbSettlementBudget += budget
      lastWbnbLeg = index
    }
  }

  const hubSettlementIn = feeSettlement + wbnbSettlementBudget
  const grossWbnb = await quoteV4ExactInput(
    deployment.hubPool,
    deployment.contracts.settlementToken,
    hubSettlementIn,
    chainId,
  )
  const feeWbnb = (grossWbnb * feeSettlement + hubSettlementIn - 1n) / hubSettlementIn
  const legWbnb = grossWbnb - feeWbnb
  let consumedWbnb = 0n
  const outputs: bigint[] = []
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index]
    const amountIn = leg.route.quoteToken === 1
      ? quoteBudgets[index]
      : index === lastWbnbLeg
        ? legWbnb - consumedWbnb
        : legWbnb * quoteBudgets[index] / wbnbSettlementBudget
    if (leg.route.quoteToken !== 1) consumedWbnb += amountIn
    outputs.push(await quoteWethToAssetForSwap(leg.route, leg.asset, amountIn, chainId))
  }
  return outputs
}

const buyLegMins = async (detail: BasketDetail, usdgIn: bigint, slippageBps: number): Promise<bigint[]> => {
  const outputs = await quoteBasketBuyLegOutputs({
    chainId: detail.chainId,
    settlementIn: usdgIn,
    basketFeeBps: detail.basketFeeBps,
    legs: detail.holdings.map((holding) => ({
      route: holding.route,
      asset: holding.asset,
      weightBps: Math.round(holding.targetWeightPct * 100),
    })),
  })
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
  const deployment = getBasketDeployment(detail.chainId)
  const decimals = side === 'buy' ? deployment.settlementDecimals : detail.decimals
  const amountText = normalizeBasketAmount(amount, decimals)
  const amountRaw = parseUnits(amountText, decimals)
  if (amountRaw <= 0n || amountRaw >= 2n ** 128n) throw new Error('Invalid amount')
  const key = await selfPoolKey(detail.address, detail.chainId)
  const isFirstMint = side === 'buy' && (detail.effectiveSupply ?? 0) === 0
  // Always provide buy-leg limits. The Hook's spot-price fallback does not
  // deduct the pool fee (some curated pools charge 5%), so its built-in 3%
  // tolerance is not sufficient even when price impact is negligible.
  const legMins = side === 'buy' ? await buyLegMins(detail, amountRaw, slippageBps) : []
  const zeroForOne = side === 'buy'
    ? key.currency0.toLowerCase() === deployment.contracts.settlementToken.toLowerCase()
    : key.currency0.toLowerCase() === detail.address.toLowerCase()
  const hookData = encodeBasketTradeData({
    chainId: detail.chainId,
    side,
    minOut: 0n,
    legCount: detail.basketLength,
    firstMint: isFirstMint,
    legMins,
  })

  try {
    const { result } = await getReadOnlyClient(detail.chainId).simulateContract({
      address: getChainDeployment(detail.chainId).dex.v4Quoter,
      abi: detail.chainId === 56 ? pancakeV4QuoterAbi : v4QuoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ poolKey: toContractPoolKey(key, detail.chainId), zeroForOne, exactAmount: amountRaw, hookData }],
    } as any)
    const estimatedOutRaw = typeof result === 'bigint' ? result : result[0]
    return {
      amountRaw,
      estimatedOutRaw,
      estimatedOut: Number(formatUnits(estimatedOutRaw, side === 'buy' ? detail.decimals : deployment.settlementDecimals)),
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
      Math.max(estimated, 0).toFixed(side === 'buy' ? detail.decimals : deployment.settlementDecimals),
      side === 'buy' ? detail.decimals : deployment.settlementDecimals,
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
    chainId: detail.chainId,
    side,
    minOut: quote.minOutRaw,
    legCount: detail.basketLength,
    firstMint,
    legMins: quote.legMins,
  })
  const deployment = getBasketDeployment(detail.chainId)
  const functionName = side === 'buy'
    ? (detail.chainId === 56 ? 'buyExactSettlement' : 'buyExactUsdg')
    : 'sellExactBasket'
  const args = [detail.address, quote.amountRaw, quote.minOutRaw, hookData, account] as const
  const publicClient = getReadOnlyClient(detail.chainId)
  const { request } = await publicClient.simulateContract({
    account,
    address: deployment.contracts.swapRouter,
    abi: getBasketSwapRouterAbi(detail.chainId),
    functionName,
    args,
  } as any)
  const hash = await wallet.writeContract(request as any)
  const confirmed = await waitForTx(hash)
  if (!confirmed) throw new Error('Transaction failed')
  return hash
}

export const isBasketContract = async (address: Address, chainId: number): Promise<boolean> =>
  getReadOnlyClient(chainId).readContract({
    address,
    abi: getBasketTokenAbi(chainId),
    functionName: 'effectiveSupply',
  }).then(() => true, () => false)

export const noFrontendAddress = zeroAddress
