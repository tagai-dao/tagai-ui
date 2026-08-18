import { isAddress, keccak256, parseEventLogs, parseUnits, stringToHex, zeroAddress, type Address, type Hex } from 'viem'
import {
  BASKET_DEFAULT_SLIPPAGE_BPS,
  getBasketCreationProtocol,
  getBasketDeployment,
  isBscBasketLegAssetBlocked,
  isUsdBasketLegSymbol,
  type BasketAssetPreset,
  type BasketPoolKey,
} from '@/config/baskets'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import { basketRegistryAbi, erc20Abi, getBasketSwapRouterAbi } from './abis'
import { getBscV3DefaultExecutionLossBps, quoteBscV3SettlementToAsset } from './bsc-v3-routing'
import { applySlippage, encodeBasketTradeData } from './hook-data'
import { assertBasketRouteUsable, BasketPoolValidationError } from './route-validation'
import { toContractLegRoute } from './routes'
import {
  approveBasketTrade,
  friendlyBasketError,
  getTradeAllowance,
  quoteBasketBuyLegOutputs,
  quoteWethToAssetForSwap,
} from './trade'
import type { BasketLegRoute } from './types'

export type CreateBasketAsset = Pick<BasketAssetPreset, 'address' | 'symbol'>

export type CreateBasketLeg = {
  asset: CreateBasketAsset
  route: BasketLegRoute
  weightBps: number
  slippageBps?: number
}

export type CreateBasketInput = {
  chainId: number
  name: string
  symbol: string
  basketFeeBps: number
  creatorShareBps: number
  initialUsdg: string | number
  slippageBps: number
  legs: CreateBasketLeg[]
}

export type CreateBasketResult = { hash: Hex; basket: Address }

export const getBasketUsdgBalance = (account: Address, chainId: number): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  return getReadOnlyClient(chainId).readContract({
    address: deployment.contracts.settlementToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })
}

const EMPTY_POOL = {
  currency0: zeroAddress,
  currency1: zeroAddress,
  fee: 0,
  tickSpacing: 0,
  hooks: zeroAddress,
  poolManager: zeroAddress,
  parameters: `0x${'0'.repeat(64)}` as Hex,
} as const

export const presetCreateLeg = (asset: BasketAssetPreset): CreateBasketLeg => ({
  asset: { address: asset.address, symbol: asset.symbol },
  route: asset.route,
  weightBps: 0,
})

export const buildCustomRoute = ({
  asset,
  venue,
  quoteToken,
  poolQuoteToken,
  fee,
  tickSpacing,
  hooks = zeroAddress,
  poolKey,
}: {
  asset: Address
  venue: 0 | 1 | 3
  quoteToken?: 0 | 1
  poolQuoteToken?: Address
  fee: number
  tickSpacing?: number
  hooks?: Address
  poolKey?: BasketPoolKey
}): BasketLegRoute => venue === 0
  ? {
      venue,
      ...(quoteToken === undefined ? {} : { quoteToken }),
      ...(poolQuoteToken === undefined ? {} : { poolQuoteToken }),
      v4Pool: poolKey ?? { currency0: zeroAddress, currency1: asset, fee, tickSpacing: tickSpacing ?? 0, hooks },
      v3Fee: 0,
    }
  : {
      venue,
      ...(quoteToken === undefined ? {} : { quoteToken }),
      ...(poolQuoteToken === undefined ? {} : { poolQuoteToken }),
      v4Pool: EMPTY_POOL,
      v3Fee: venue === 1 ? fee : 0,
    }

export const validateCustomBasketAsset = async ({
  asset,
  route,
  chainId,
}: {
  asset: string
  route: BasketLegRoute
  chainId: number
}): Promise<CreateBasketAsset> => {
  const deployment = getBasketDeployment(chainId)
  if (!isAddress(asset)) throw new Error('Invalid token address')
  const address = asset as Address
  const normalized = address.toLowerCase()
  if (isBscBasketLegAssetBlocked(address, chainId) ||
    [zeroAddress, deployment.contracts.wrappedNative, deployment.contracts.settlementToken].some((item) => item.toLowerCase() === normalized)) {
    throw new Error('This token cannot be used as a constituent')
  }
  const client = getReadOnlyClient(chainId)
  const [code, isBasket, symbol] = await Promise.all([
    client.getBytecode({ address }),
    client.readContract({ address: deployment.contracts.registry, abi: basketRegistryAbi, functionName: 'isBasket', args: [address] }),
    client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
  ])
  if (!code || code === '0x') throw new Error('Token address is not a contract')
  if (isBasket) throw new Error('Basket tokens cannot be used as constituents')
  if (chainId === 56 && isUsdBasketLegSymbol(symbol)) {
    throw new Error('USD stablecoins cannot be used as BSC basket constituents')
  }
  if (chainId === 56 && !route.poolQuoteToken) {
    throw new Error('The selected BSC route has no quote token')
  }
  try {
    await assertBasketRouteUsable(route, address, chainId)
    const quote = chainId === 56
      ? await quoteBscV3SettlementToAsset(route, address, 1_000_000_000_000_000n)
      : await quoteWethToAssetForSwap(route, address, 1_000_000_000_000_000n, chainId)
    if (quote <= 0n) throw new Error('The selected route has no usable price or liquidity')
  } catch (error) {
    if (error instanceof BasketPoolValidationError) throw error
    throw new Error(friendlyBasketError(error))
  }
  return { address, symbol: symbol || `${address.slice(0, 6)}…${address.slice(-4)}` }
}

export const createBasketAndBuy = async (
  input: CreateBasketInput,
  account: Address,
  onApproving?: () => void,
  onApproved?: () => void,
): Promise<CreateBasketResult> => {
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const deployment = getBasketDeployment(input.chainId)
  const creationVersion = deployment.creationVersion
  const creationProtocol = getBasketCreationProtocol(input.chainId)
  const presets = deployment.assetPresets
  const usdgIn = parseUnits(String(input.initialUsdg), deployment.settlementDecimals)
  if (usdgIn <= 10n ** BigInt(deployment.settlementDecimals)) {
    throw new Error(`Initial purchase must be greater than 1 ${deployment.settlementSymbol}`)
  }
  if (!input.legs.length || input.legs.length > 10) throw new Error('Choose between 1 and 10 assets')
  if (input.legs.some((leg) =>
    isBscBasketLegAssetBlocked(leg.asset.address, input.chainId) ||
    (input.chainId === 56 && isUsdBasketLegSymbol(leg.asset.symbol)))) {
    throw new Error('USD stablecoins cannot be used as BSC basket constituents')
  }
  if (input.chainId === 56 && input.legs.some((leg) => !leg.route.poolQuoteToken)) {
    throw new Error('Every BSC constituent route must include its direct pool quote token')
  }
  if (input.legs.reduce((sum, leg) => sum + leg.weightBps, 0) !== 10_000) {
    throw new Error('Asset weights must add up to 100%')
  }

  if (input.chainId === 56 && creationVersion >= 3) {
    const registryClient = getReadOnlyClient(input.chainId)
    const [registrarApproved, forwarderApproved] = await Promise.all([
      registryClient.readContract({
        address: creationProtocol.registry,
        abi: basketRegistryAbi,
        functionName: 'approvedRegistrars',
        args: [creationProtocol.hook],
      }),
      registryClient.readContract({
        address: creationProtocol.registry,
        abi: basketRegistryAbi,
        functionName: 'approvedCreatorForwarders',
        args: [creationProtocol.swapRouter],
      }),
    ])
    if (!registrarApproved || !forwarderApproved) {
      throw new Error('Basket V3 creation is not active on this network yet')
    }
  }

  try {
    const customLegs = input.legs.filter((leg) =>
      !presets.some((preset) => preset.address.toLowerCase() === leg.asset.address.toLowerCase()))
    await Promise.all(customLegs.map((leg) => assertBasketRouteUsable(leg.route, leg.asset.address, input.chainId)))
  } catch (error) {
    if (error instanceof BasketPoolValidationError) throw error
    throw new Error(friendlyBasketError(error))
  }

  const allowance = await getTradeAllowance(
    deployment.contracts.settlementToken,
    account,
    input.chainId,
    creationVersion,
  )
  if (allowance < usdgIn) {
    onApproving?.()
    await approveBasketTrade(deployment.contracts.settlementToken, usdgIn, account, input.chainId, creationVersion)
    // Approval is confirmed on-chain. Immediately continue to simulation and
    // open the creation transaction in the wallet without another UI click.
    onApproved?.()
  }

  const routes = await Promise.all(input.legs.map(async (leg) => ({
    ...leg.route,
    defaultMaxExecutionLossBps: input.chainId === 56
      ? await getBscV3DefaultExecutionLossBps(leg.route, BASKET_DEFAULT_SLIPPAGE_BPS)
      : leg.route.defaultMaxExecutionLossBps,
  })))
  const createParams = {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    creator: account,
    basketFeeBps: input.basketFeeBps,
    creatorShareBps: input.creatorShareBps,
    constituentAssets: input.legs.map((leg) => leg.asset.address),
    constituentRoutes: routes.map((route) => toContractLegRoute(route, input.chainId, creationVersion)),
    targetWeights: input.legs.map((leg) => leg.weightBps),
  }
  const bootstrapShares = usdgIn * 10n ** BigInt(18 - deployment.settlementDecimals)
  const netBootstrap = bootstrapShares * BigInt(10_000 - input.basketFeeBps) / 10_000n
  const expectedBasketOut = netBootstrap - 1_000_000_000_000_000n
  if (expectedBasketOut <= 0n) throw new Error('Initial purchase is too small')
  const minBasketOut = applySlippage(expectedBasketOut, input.slippageBps)
  let quotedLegs: bigint[]
  try {
    quotedLegs = await quoteBasketBuyLegOutputs({
      chainId: input.chainId,
      version: creationVersion,
      settlementIn: usdgIn,
      basketFeeBps: input.basketFeeBps,
      legs: input.legs.map((leg) => ({ route: leg.route, asset: leg.asset.address, weightBps: leg.weightBps })),
    })
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }
  const legMins = quotedLegs.map((amount, index) =>
    applySlippage(amount, input.legs[index]?.slippageBps ?? input.slippageBps))
  if (legMins.some((amount) => amount <= 0n)) throw new Error('A constituent route has insufficient liquidity')
  const hookData = encodeBasketTradeData({
    chainId: input.chainId,
    version: creationVersion,
    side: 'buy',
    minOut: minBasketOut,
    legCount: input.legs.length,
    firstMint: true,
    legMins,
  })
  const userSalt = keccak256(stringToHex(`${account}:${Date.now()}:${crypto.getRandomValues(new Uint32Array(1))[0]}`))
  const args = [userSalt, createParams, usdgIn, minBasketOut, hookData, account] as const
  const publicClient = getReadOnlyClient(input.chainId)

  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: creationProtocol.swapRouter,
      abi: getBasketSwapRouterAbi(input.chainId, creationVersion),
      functionName: input.chainId === 56 ? 'createAndBuyExactSettlement' : 'createAndBuyExactUsdg',
      args,
    } as any)
    const hash = await wallet.writeContract(request as any)
    const confirmed = await waitForTx(hash)
    if (!confirmed) throw new Error('Creation transaction failed')
    const receipt = await publicClient.getTransactionReceipt({ hash })
    const events = parseEventLogs({
      abi: getBasketSwapRouterAbi(input.chainId, creationVersion),
      logs: receipt.logs,
      eventName: 'BasketCreatedAndBought',
    } as any)
    const basket = (events[0] as any)?.args?.basket as Address | undefined
    if (!basket) throw new Error('Basket created, but its address could not be read from the receipt')
    return { hash, basket }
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }
}
