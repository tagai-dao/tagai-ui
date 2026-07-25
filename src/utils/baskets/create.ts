import { isAddress, keccak256, parseEventLogs, parseUnits, stringToHex, zeroAddress, type Address, type Hex } from 'viem'
import {
  BASKET_CHAIN_ID,
  BASKET_ASSET_PRESETS,
  BASKET_CONTRACTS,
  BASKET_HUB_POOL,
  BASKET_USDG_DECIMALS,
  type BasketAssetPreset,
  type BasketPoolKey,
} from '@/config/baskets'
import { getReadOnlyClient, getWalletClient, waitForTx } from '@/utils/wallets'
import { basketRegistryAbi, basketSwapRouterAbi, erc20Abi, v4QuoterAbi } from './abis'
import { applySlippage, encodeBasketTradeData } from './hook-data'
import { assertBasketRouteUsable } from './route-validation'
import {
  approveBasketTrade,
  friendlyBasketError,
  getTradeAllowance,
  quoteWethToAssetForSwap,
} from './trade'
import { ROBINHOOD_CHAIN } from '@/config/chains'
import type { BasketLegRoute } from './types'

export type CreateBasketAsset = Pick<BasketAssetPreset, 'address' | 'symbol'>

export type CreateBasketLeg = {
  asset: CreateBasketAsset
  route: BasketLegRoute
  weightBps: number
  slippageBps?: number
}

export type CreateBasketInput = {
  name: string
  symbol: string
  basketFeeBps: number
  creatorShareBps: number
  initialUsdg: string | number
  slippageBps: number
  legs: CreateBasketLeg[]
}

export type CreateBasketResult = { hash: Hex; basket: Address }

export const getBasketUsdgBalance = (account: Address): Promise<bigint> =>
  getReadOnlyClient(BASKET_CHAIN_ID).readContract({
    address: BASKET_CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })

const EMPTY_POOL = {
  currency0: zeroAddress,
  currency1: zeroAddress,
  fee: 0,
  tickSpacing: 0,
  hooks: zeroAddress,
} as const

export const presetCreateLeg = (asset: BasketAssetPreset): CreateBasketLeg => ({
  asset: { address: asset.address, symbol: asset.symbol },
  route: asset.route,
  weightBps: 0,
})

export const buildCustomRoute = ({
  asset,
  venue,
  fee,
  tickSpacing,
  hooks = zeroAddress,
}: {
  asset: Address
  venue: 0 | 1
  fee: number
  tickSpacing?: number
  hooks?: Address
}): BasketLegRoute => venue === 0
  ? {
      venue,
      v4Pool: { currency0: zeroAddress, currency1: asset, fee, tickSpacing: tickSpacing ?? 0, hooks },
      v3Fee: 0,
    }
  : { venue, v4Pool: EMPTY_POOL, v3Fee: fee }

export const validateCustomBasketAsset = async ({
  asset,
  route,
}: {
  asset: string
  route: BasketLegRoute
}): Promise<CreateBasketAsset> => {
  if (!isAddress(asset)) throw new Error('Invalid token address')
  const address = asset as Address
  const normalized = address.toLowerCase()
  if ([zeroAddress, BASKET_CONTRACTS.weth, BASKET_CONTRACTS.usdg].some((item) => item.toLowerCase() === normalized)) {
    throw new Error('This token cannot be used as a constituent')
  }
  const client = getReadOnlyClient(BASKET_CHAIN_ID)
  const [code, isBasket, symbol] = await Promise.all([
    client.getBytecode({ address }),
    client.readContract({ address: BASKET_CONTRACTS.registry, abi: basketRegistryAbi, functionName: 'isBasket', args: [address] }),
    client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
  ])
  if (!code || code === '0x') throw new Error('Token address is not a contract')
  if (isBasket) throw new Error('Basket tokens cannot be used as constituents')
  try {
    await assertBasketRouteUsable(route, address)
    const quote = await quoteWethToAssetForSwap(route, address, 1_000_000_000_000_000n)
    if (quote <= 0n) throw new Error('The selected route has no usable price or liquidity')
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }
  return { address, symbol: symbol || `${address.slice(0, 6)}…${address.slice(-4)}` }
}

const quoteExactInput = async (
  poolKey: BasketPoolKey,
  inputToken: Address,
  amountIn: bigint,
): Promise<bigint> => {
  const zeroForOne = poolKey.currency0.toLowerCase() === inputToken.toLowerCase()
  const { result } = await getReadOnlyClient(BASKET_CHAIN_ID).simulateContract({
    address: ROBINHOOD_CHAIN.dex.v4Quoter,
    abi: v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne, exactAmount: amountIn, hookData: '0x' }],
  })
  return typeof result === 'bigint' ? result : result[0]
}

export const createBasketAndBuy = async (
  input: CreateBasketInput,
  account: Address,
  onApproving?: () => void,
  onApproved?: () => void,
): Promise<CreateBasketResult> => {
  const wallet = getWalletClient()
  if (!wallet) throw new Error('Wallet not connected')
  const usdgIn = parseUnits(String(input.initialUsdg), BASKET_USDG_DECIMALS)
  if (usdgIn <= 1_000_000n) throw new Error('Initial purchase must be greater than 1 USDG')
  if (!input.legs.length || input.legs.length > 10) throw new Error('Choose between 1 and 10 assets')
  if (input.legs.reduce((sum, leg) => sum + leg.weightBps, 0) !== 10_000) {
    throw new Error('Asset weights must add up to 100%')
  }

  try {
    const customLegs = input.legs.filter((leg) =>
      !BASKET_ASSET_PRESETS.some((preset) => preset.address.toLowerCase() === leg.asset.address.toLowerCase()))
    await Promise.all(customLegs.map((leg) => assertBasketRouteUsable(leg.route, leg.asset.address)))
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }

  const allowance = await getTradeAllowance(BASKET_CONTRACTS.usdg, account)
  if (allowance < usdgIn) {
    onApproving?.()
    await approveBasketTrade(BASKET_CONTRACTS.usdg, usdgIn, account)
    // Approval is confirmed on-chain. Immediately continue to simulation and
    // open the creation transaction in the wallet without another UI click.
    onApproved?.()
  }

  const createParams = {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    creator: account,
    basketFeeBps: input.basketFeeBps,
    creatorShareBps: input.creatorShareBps,
    constituentAssets: input.legs.map((leg) => leg.asset.address),
    constituentRoutes: input.legs.map((leg) => leg.route),
    targetWeights: input.legs.map((leg) => leg.weightBps),
  }
  const bootstrapShares = usdgIn * 10n ** BigInt(18 - BASKET_USDG_DECIMALS)
  const netBootstrap = bootstrapShares * BigInt(10_000 - input.basketFeeBps) / 10_000n
  const expectedBasketOut = netBootstrap - 1_000_000_000_000_000n
  if (expectedBasketOut <= 0n) throw new Error('Initial purchase is too small')
  const minBasketOut = applySlippage(expectedBasketOut, input.slippageBps)
  let quotedLegs: bigint[]
  try {
    const grossWeth = await quoteExactInput(BASKET_HUB_POOL, BASKET_CONTRACTS.usdg, usdgIn)
    const feeWeth = (grossWeth * BigInt(input.basketFeeBps) + 9_999n) / 10_000n
    const netWeth = grossWeth - feeWeth
    let allocated = 0n
    quotedLegs = []
    for (let index = 0; index < input.legs.length; index += 1) {
      const leg = input.legs[index]
      const legInput = index === input.legs.length - 1
        ? netWeth - allocated
        : netWeth * BigInt(leg.weightBps) / 10_000n
      allocated += legInput
      quotedLegs.push(await quoteWethToAssetForSwap(leg.route, leg.asset.address, legInput))
    }
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }
  const legMins = quotedLegs.map((amount, index) =>
    applySlippage(amount, input.legs[index]?.slippageBps ?? input.slippageBps))
  if (legMins.some((amount) => amount <= 0n)) throw new Error('A constituent route has insufficient liquidity')
  const hookData = encodeBasketTradeData({
    side: 'buy',
    minOut: minBasketOut,
    legCount: input.legs.length,
    firstMint: true,
    legMins,
  })
  const userSalt = keccak256(stringToHex(`${account}:${Date.now()}:${crypto.getRandomValues(new Uint32Array(1))[0]}`))
  const args = [userSalt, createParams, usdgIn, minBasketOut, hookData, account] as const
  const publicClient = getReadOnlyClient(BASKET_CHAIN_ID)

  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: BASKET_CONTRACTS.swapRouter,
      abi: basketSwapRouterAbi,
      functionName: 'createAndBuyExactUsdg',
      args,
    })
    const hash = await wallet.writeContract(request)
    const confirmed = await waitForTx(hash)
    if (!confirmed) throw new Error('Creation transaction failed')
    const receipt = await publicClient.getTransactionReceipt({ hash })
    const events = parseEventLogs({ abi: basketSwapRouterAbi, logs: receipt.logs, eventName: 'BasketCreatedAndBought' })
    const basket = events[0]?.args.basket
    if (!basket) throw new Error('Basket created, but its address could not be read from the receipt')
    return { hash, basket }
  } catch (error) {
    throw new Error(friendlyBasketError(error))
  }
}
