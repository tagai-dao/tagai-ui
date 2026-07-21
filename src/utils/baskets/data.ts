import {
  encodeAbiParameters,
  formatUnits,
  isAddress,
  keccak256,
  type Address,
  type PublicClient,
} from 'viem'
import {
  BASKET_CHAIN_ID,
  BASKET_CONTRACTS,
  BASKET_HUB_POOL,
  BASKET_USDG_DECIMALS,
  type BasketPoolKey,
} from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { getRhV4PoolStateSlot } from '@/utils/rhV4Swap'
import { basketRegistryAbi, basketTokenAbi, erc20Abi, rebalanceExecutorAbi } from './abis'
import { getRegisteredBasket, listRegisteredBaskets, type RegisteredBasket } from './api'
import type { BasketDetail, BasketHolding, BasketLegRoute, BasketSummary } from './types'

export type BasketReadOptions = {
  force?: boolean
  onShell?: (shell: BasketSummary[]) => void
}

type CacheEntry<T> = { at: number; data: T }
type MulticallRow = { status: 'success'; result: unknown } | { status: 'failure'; error: Error }
type MulticallContract = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }

const CACHE_TTL_MS = 60_000
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const detailCache = new Map<string, CacheEntry<BasketDetail>>()
let listCache: CacheEntry<BasketSummary[]> | null = null
let hubSqrtCache: CacheEntry<bigint> | null = null

const cacheKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`
const isFresh = (at: number) => Date.now() - at < CACHE_TTL_MS
const ok = <T>(row: MulticallRow | undefined): T | null => row?.status === 'success' ? row.result as T : null

const multicall = async (client: PublicClient, contracts: MulticallContract[]): Promise<MulticallRow[]> => {
  if (!contracts.length) return []
  return client.multicall({
    contracts: contracts as Parameters<PublicClient['multicall']>[0]['contracts'],
    allowFailure: true,
    multicallAddress: MULTICALL3,
  }) as Promise<MulticallRow[]>
}

const normalizePool = (raw: any): BasketPoolKey => ({
  currency0: (raw?.currency0 ?? raw?.[0]) as Address,
  currency1: (raw?.currency1 ?? raw?.[1]) as Address,
  fee: Number(raw?.fee ?? raw?.[2] ?? 0),
  tickSpacing: Number(raw?.tickSpacing ?? raw?.[3] ?? 0),
  hooks: (raw?.hooks ?? raw?.[4]) as Address,
})

const normalizeRoute = (raw: any): BasketLegRoute => ({
  venue: Number(raw?.venue ?? raw?.[0] ?? 0),
  v4Pool: normalizePool(raw?.v4Pool ?? raw?.[1]),
  v3Fee: Number(raw?.v3Fee ?? raw?.[2] ?? 0),
})

const poolId = (key: BasketPoolKey): `0x${string}` => keccak256(encodeAbiParameters(
  [{
    type: 'tuple',
    components: [
      { type: 'address', name: 'currency0' },
      { type: 'address', name: 'currency1' },
      { type: 'uint24', name: 'fee' },
      { type: 'int24', name: 'tickSpacing' },
      { type: 'address', name: 'hooks' },
    ],
  }],
  [key],
))

const getHubSqrtPrice = async (client: PublicClient): Promise<bigint> => {
  if (hubSqrtCache && isFresh(hubSqrtCache.at)) return hubSqrtCache.data
  const word = await client.readContract({
    address: BASKET_CONTRACTS.poolManager,
    abi: [{
      inputs: [{ name: 'slot', type: 'bytes32' }],
      name: 'extsload',
      outputs: [{ name: 'value', type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    }],
    functionName: 'extsload',
    args: [getRhV4PoolStateSlot(poolId(BASKET_HUB_POOL))],
  })
  const sqrtPrice = BigInt(word as string) & ((1n << 160n) - 1n)
  hubSqrtCache = { at: Date.now(), data: sqrtPrice }
  return sqrtPrice
}

const wethToUsdgRaw = (wethWei: bigint, sqrtPriceX96: bigint): bigint =>
  (wethWei * sqrtPriceX96 * sqrtPriceX96) >> 192n

export const invalidateBasketCache = (address?: Address) => {
  listCache = null
  if (!address) {
    detailCache.clear()
    return
  }
  detailCache.delete(cacheKey(BASKET_CHAIN_ID, address))
}

export const getBasketDetail = async (
  address: Address,
  chainId: number = BASKET_CHAIN_ID,
  options: BasketReadOptions = {},
): Promise<BasketDetail> => {
  if (chainId !== BASKET_CHAIN_ID) throw new Error('Baskets are only available on Robinhood Chain')
  if (!isAddress(address)) throw new Error('Invalid basket address')
  const key = cacheKey(chainId, address)
  const cached = detailCache.get(key)
  if (!options.force && cached && isFresh(cached.at)) return cached.data

  const client = getReadOnlyClient(chainId)
  let registered: RegisteredBasket | null = null
  try {
    registered = await getRegisteredBasket(address)
  } catch {
    // A newly created Basket may be usable onchain before the API write succeeds.
  }

  if (registered) {
    const contracts: MulticallContract[] = [
      { address, abi: basketTokenAbi, functionName: 'creatorPayout' },
      { address, abi: basketTokenAbi, functionName: 'launcherPayout' },
      { address, abi: basketTokenAbi, functionName: 'totalSupply' },
      { address, abi: basketTokenAbi, functionName: 'effectiveSupply' },
    ]
    registered.assets.forEach((asset) => {
      contracts.push(
        { address, abi: basketTokenAbi, functionName: 'assetAt', args: [BigInt(asset.position)] },
        {
          address: BASKET_CONTRACTS.rebalanceExecutor,
          abi: rebalanceExecutorAbi,
          functionName: 'quoteAssetToWeth',
          args: [asset.route, asset.address, 10n ** BigInt(asset.decimals)],
        },
      )
    })
    contracts.push({
      address: BASKET_CONTRACTS.poolManager,
      abi: [{
        inputs: [{ name: 'slot', type: 'bytes32' }],
        name: 'extsload',
        outputs: [{ name: 'value', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'extsload',
      args: [getRhV4PoolStateSlot(poolId(BASKET_HUB_POOL))],
    })

    const rows = await multicall(client, contracts)
    const creatorPayout = ok<Address>(rows[0])
    const launcher = ok<Address>(rows[1])
    const totalSupplyRaw = ok<bigint>(rows[2]) ?? 0n
    const effectiveSupplyRaw = ok<bigint>(rows[3]) ?? 0n
    const hubWord = ok<string>(rows[rows.length - 1])
    const hubSqrtPrice = hubWord ? BigInt(hubWord) & ((1n << 160n) - 1n) : 0n
    if (hubSqrtPrice > 0n) hubSqrtCache = { at: Date.now(), data: hubSqrtPrice }

    const holdings: BasketHolding[] = registered.assets.map((asset, index) => {
      const state: any = ok(rows[4 + index * 2])
      const reserve = BigInt(state?.activeReserve ?? state?.[2] ?? 0)
      const unitQuote = ok<bigint>(rows[5 + index * 2]) ?? 0n
      const reserveWeth = reserve * unitQuote / (10n ** BigInt(asset.decimals))
      const valueUsd = hubSqrtPrice > 0n
        ? Number(formatUnits(wethToUsdgRaw(reserveWeth, hubSqrtPrice), BASKET_USDG_DECIMALS))
        : 0
      const balance = Number(formatUnits(reserve, asset.decimals))
      return {
        asset: asset.address,
        symbol: asset.symbol.slice(0, 24),
        decimals: asset.decimals,
        targetWeightPct: asset.targetWeightBps / 100,
        balance,
        priceUsd: balance > 0 ? valueUsd / balance : 0,
        valueUsd,
        priced: reserveWeth > 0n && valueUsd > 0,
        route: asset.route,
      }
    })
    const aumUsd = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0)
    const totalSupply = Number(formatUnits(totalSupplyRaw, registered.decimals))
    const effectiveSupply = Number(formatUnits(effectiveSupplyRaw, registered.decimals))
    const top = [...holdings]
      .sort((a, b) => b.targetWeightPct - a.targetWeightPct)
      .map((holding) => ({ address: holding.asset, symbol: holding.symbol, weightPct: holding.targetWeightPct }))
    const detail: BasketDetail = {
      chainId,
      address,
      name: registered.name,
      symbol: registered.symbol,
      decimals: registered.decimals,
      basketLength: registered.basketLength,
      navPerToken: effectiveSupply > 0 ? aumUsd / effectiveSupply : 0,
      aumUsd,
      pricedCount: holdings.filter((holding) => holding.priced).length,
      top,
      deployer: creatorPayout,
      totalSupply,
      effectiveSupply,
      fullyPriced: holdings.length > 0 && holdings.every((holding) => holding.priced),
      basketFeeBps: registered.basketFeeBps,
      creatorShareBps: registered.creatorShareBps,
      launcher,
      creator: registered.creator,
      version: registered.version,
      createdAt: registered.createdAt,
      holdings,
      updatedAt: new Date().toISOString(),
    }
    detailCache.set(key, { at: Date.now(), data: detail })
    return detail
  }

  const meta = await multicall(client, [
    { address, abi: basketTokenAbi, functionName: 'name' },
    { address, abi: basketTokenAbi, functionName: 'symbol' },
    { address, abi: basketTokenAbi, functionName: 'decimals' },
    { address, abi: basketTokenAbi, functionName: 'assetCount' },
    { address, abi: basketTokenAbi, functionName: 'basketFeeBps' },
    { address, abi: basketTokenAbi, functionName: 'creatorShareBps' },
    { address, abi: basketTokenAbi, functionName: 'creatorPayout' },
    { address, abi: basketTokenAbi, functionName: 'launcherPayout' },
    { address, abi: basketTokenAbi, functionName: 'totalSupply' },
    { address, abi: basketTokenAbi, functionName: 'effectiveSupply' },
    { address: BASKET_CONTRACTS.registry, abi: basketRegistryAbi, functionName: 'basketCreator', args: [address] },
    { address: BASKET_CONTRACTS.registry, abi: basketRegistryAbi, functionName: 'basketVersion', args: [address] },
    { address: BASKET_CONTRACTS.registry, abi: basketRegistryAbi, functionName: 'basketCreatedAt', args: [address] },
  ])
  const name = ok<string>(meta[0])
  const symbol = ok<string>(meta[1])
  if (!name || !symbol) throw new Error('This address is not a registered Basket')

  const decimals = Number(ok<number>(meta[2]) ?? 18)
  const length = Number(ok<bigint>(meta[3]) ?? 0n)
  const basketFeeBps = Number(ok<number>(meta[4]) ?? 100)
  const creatorShareBps = Number(ok<number>(meta[5]) ?? 0)
  const creatorPayout = ok<Address>(meta[6])
  const launcher = ok<Address>(meta[7])
  const totalSupplyRaw = ok<bigint>(meta[8]) ?? 0n
  const effectiveSupplyRaw = ok<bigint>(meta[9]) ?? 0n
  const creator = ok<Address>(meta[10])
  const version = Number(ok<number>(meta[11]) ?? 0)
  const createdAt = Number(ok<bigint>(meta[12]) ?? 0n)

  const legs = await multicall(client, [
    ...Array.from({ length }, (_, index) => ({
      address, abi: basketTokenAbi, functionName: 'assetAt', args: [BigInt(index)],
    })),
    ...Array.from({ length }, (_, index) => ({
      address, abi: basketTokenAbi, functionName: 'assetRouteAt', args: [BigInt(index)],
    })),
  ])

  const assets = Array.from({ length }, (_, index) => {
    const raw: any = ok(legs[index])
    return {
      address: (raw?.asset ?? raw?.[0]) as Address,
      weightBps: Number(raw?.targetWeightBps ?? raw?.[1] ?? 0),
      reserve: BigInt(raw?.activeReserve ?? raw?.[2] ?? 0),
      route: normalizeRoute(ok(legs[length + index])),
    }
  }).filter((leg) => isAddress(leg.address))

  const assetMeta = await multicall(client, assets.flatMap((leg) => [
    { address: leg.address, abi: erc20Abi, functionName: 'symbol' },
    { address: leg.address, abi: erc20Abi, functionName: 'decimals' },
    {
      address: BASKET_CONTRACTS.rebalanceExecutor,
      abi: rebalanceExecutorAbi,
      functionName: 'quoteAssetToWeth',
      args: [leg.route, leg.address, leg.reserve],
    },
  ]))
  const hubSqrtPrice = await getHubSqrtPrice(client)

  const holdings: BasketHolding[] = assets.map((leg, index) => {
    const base = index * 3
    const assetDecimals = Number(ok<number>(assetMeta[base + 1]) ?? 18)
    const reserveWeth = ok<bigint>(assetMeta[base + 2]) ?? 0n
    const valueUsd = Number(formatUnits(wethToUsdgRaw(reserveWeth, hubSqrtPrice), BASKET_USDG_DECIMALS))
    const balance = Number(formatUnits(leg.reserve, assetDecimals))
    const priceUsd = balance > 0 ? valueUsd / balance : 0
    return {
      asset: leg.address,
      symbol: (ok<string>(assetMeta[base]) || '?').slice(0, 24),
      decimals: assetDecimals,
      targetWeightPct: leg.weightBps / 100,
      balance,
      priceUsd,
      valueUsd,
      priced: reserveWeth > 0n && valueUsd > 0,
      route: leg.route,
    }
  })

  const aumUsd = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0)
  const totalSupply = Number(formatUnits(totalSupplyRaw, decimals))
  const effectiveSupply = Number(formatUnits(effectiveSupplyRaw, decimals))
  const navPerToken = effectiveSupply > 0 ? aumUsd / effectiveSupply : 0
  const top = [...holdings]
    .sort((a, b) => b.targetWeightPct - a.targetWeightPct)
    .map((holding) => ({ address: holding.asset, symbol: holding.symbol, weightPct: holding.targetWeightPct }))

  const detail: BasketDetail = {
    chainId,
    address,
    name,
    symbol,
    decimals,
    basketLength: assets.length,
    navPerToken,
    aumUsd,
    pricedCount: holdings.filter((holding) => holding.priced).length,
    top,
    deployer: creatorPayout,
    totalSupply,
    effectiveSupply,
    fullyPriced: holdings.length > 0 && holdings.every((holding) => holding.priced),
    basketFeeBps,
    creatorShareBps,
    launcher,
    creator,
    version,
    createdAt,
    holdings,
    updatedAt: new Date().toISOString(),
  }
  detailCache.set(key, { at: Date.now(), data: detail })
  return detail
}

export const listBaskets = async (
  chainId: number = BASKET_CHAIN_ID,
  options: BasketReadOptions = {},
): Promise<BasketSummary[]> => {
  if (!options.force && listCache && isFresh(listCache.at)) {
    options.onShell?.(listCache.data)
    return listCache.data
  }
  const client = getReadOnlyClient(chainId)
  const registered = (await listRegisteredBaskets())
    .filter((basket) => isAddress(basket.address))
    .sort((a, b) => b.createdAt - a.createdAt)

  const shells: BasketSummary[] = registered.map((basket) => ({
    chainId,
    address: basket.address,
    name: basket.name,
    symbol: basket.symbol,
    basketLength: basket.basketLength,
    navPerToken: 0,
    aumUsd: 0,
    pricedCount: 0,
    top: [...basket.assets]
      .sort((a, b) => b.targetWeightBps - a.targetWeightBps)
      .map((asset) => ({ address: asset.address, symbol: asset.symbol, weightPct: asset.targetWeightBps / 100 })),
    deployer: basket.creator,
  }))
  options.onShell?.(shells)
  if (!registered.length) {
    listCache = { at: Date.now(), data: shells }
    return shells
  }

  type ListRead =
    | { kind: 'effectiveSupply'; basketIndex: number }
    | { kind: 'reserve'; basketIndex: number; assetIndex: number }
    | { kind: 'unitQuote'; basketIndex: number; assetIndex: number }
    | { kind: 'hubPrice' }

  const contracts: MulticallContract[] = []
  const reads: ListRead[] = []
  const addRead = (contract: MulticallContract, read: ListRead) => {
    contracts.push(contract)
    reads.push(read)
  }

  registered.forEach((basket, basketIndex) => {
    addRead({ address: basket.address, abi: basketTokenAbi, functionName: 'effectiveSupply' }, { kind: 'effectiveSupply', basketIndex })
    basket.assets.forEach((asset, assetIndex) => {
      addRead(
        { address: basket.address, abi: basketTokenAbi, functionName: 'assetAt', args: [BigInt(asset.position)] },
        { kind: 'reserve', basketIndex, assetIndex },
      )
      addRead(
        {
          address: BASKET_CONTRACTS.rebalanceExecutor,
          abi: rebalanceExecutorAbi,
          functionName: 'quoteAssetToWeth',
          args: [asset.route, asset.address, 10n ** BigInt(asset.decimals)],
        },
        { kind: 'unitQuote', basketIndex, assetIndex },
      )
    })
  })
  addRead(
    {
      address: BASKET_CONTRACTS.poolManager,
      abi: [{
        inputs: [{ name: 'slot', type: 'bytes32' }],
        name: 'extsload',
        outputs: [{ name: 'value', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'extsload',
      args: [getRhV4PoolStateSlot(poolId(BASKET_HUB_POOL))],
    },
    { kind: 'hubPrice' },
  )

  const results = await multicall(client, contracts)
  const effectiveSupplies = registered.map(() => 0n)
  const reserves = registered.map((basket) => basket.assets.map(() => 0n))
  const unitQuotes = registered.map((basket) => basket.assets.map(() => 0n))
  let hubSqrtPrice = 0n
  reads.forEach((read, index) => {
    const result = results[index]
    if (result?.status !== 'success') return
    if (read.kind === 'effectiveSupply') effectiveSupplies[read.basketIndex] = result.result as bigint
    else if (read.kind === 'reserve') {
      const raw: any = result.result
      reserves[read.basketIndex][read.assetIndex] = BigInt(raw?.activeReserve ?? raw?.[2] ?? 0)
    } else if (read.kind === 'unitQuote') unitQuotes[read.basketIndex][read.assetIndex] = result.result as bigint
    else hubSqrtPrice = BigInt(result.result as string) & ((1n << 160n) - 1n)
  })

  const baskets = registered.map((basket, basketIndex): BasketSummary => {
    let aumRaw = 0n
    let pricedCount = 0
    basket.assets.forEach((asset, assetIndex) => {
      const reserve = reserves[basketIndex][assetIndex]
      const unitQuote = unitQuotes[basketIndex][assetIndex]
      const wethValue = reserve * unitQuote / (10n ** BigInt(asset.decimals))
      if (reserve > 0n && wethValue > 0n) pricedCount += 1
      if (hubSqrtPrice > 0n) aumRaw += wethToUsdgRaw(wethValue, hubSqrtPrice)
    })
    const aumUsd = Number(formatUnits(aumRaw, BASKET_USDG_DECIMALS))
    const effectiveSupply = Number(formatUnits(effectiveSupplies[basketIndex], basket.decimals))
    return {
      ...shells[basketIndex],
      aumUsd,
      navPerToken: effectiveSupply > 0 ? aumUsd / effectiveSupply : 0,
      pricedCount,
    }
  })
  listCache = { at: Date.now(), data: baskets }
  return baskets
}

export const getErc20Balance = async (token: Address, account: Address): Promise<bigint> =>
  getReadOnlyClient(BASKET_CHAIN_ID).readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })

export const getBasketBalance = getErc20Balance
