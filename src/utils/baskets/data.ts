import {
  encodeAbiParameters,
  formatUnits,
  getCreate2Address,
  isAddress,
  keccak256,
  zeroAddress,
  type Address,
  type PublicClient,
} from 'viem'
import {
  getBasketDeployment,
  getBasketProtocol,
  isBasketChain,
  toContractPoolKey,
  type BasketDeployment,
  type BasketPoolKey,
} from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { getRhV4PoolStateSlot } from '@/utils/rhV4Swap'
import {
  basketRegistryAbi,
  erc20Abi,
  getBasketTokenAbi,
  getRebalanceExecutorAbi,
  pancakePoolManagerStateAbi,
} from './abis'
import {
  getBasketPerformances,
  getRegisteredBasket,
  listRegisteredBaskets,
  type RegisteredBasket,
} from './api'
import { isBscBasketV3, toContractLegRoute } from './routes'
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
const PANCAKE_V3_DEPLOYER = '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9' as const
const PANCAKE_V3_POOL_INIT_CODE_HASH = '0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2' as const
const Q96 = 1n << 96n
const detailCache = new Map<string, CacheEntry<BasketDetail>>()
const listCache = new Map<number, CacheEntry<BasketSummary[]>>()
const hubSqrtCache = new Map<number, CacheEntry<bigint>>()

const pancakeV3PoolSpotAbi = [{
  inputs: [],
  name: 'slot0',
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick', type: 'int24' },
    { name: 'observationIndex', type: 'uint16' },
    { name: 'observationCardinality', type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8' },
    { name: 'unlocked', type: 'bool' },
  ],
  stateMutability: 'view',
  type: 'function',
}] as const

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

const decodePancakeTickSpacing = (parameters: string): number => {
  const encoded = (BigInt(parameters) >> 16n) & 0xffffffn
  return Number(encoded >= 0x800000n ? encoded - 0x1000000n : encoded)
}

const normalizePool = (raw: any, chainId: number): BasketPoolKey => chainId === 56
  ? {
      currency0: (raw?.currency0 ?? raw?.[0]) as Address,
      currency1: (raw?.currency1 ?? raw?.[1]) as Address,
      hooks: (raw?.hooks ?? raw?.[2]) as Address,
      poolManager: (raw?.poolManager ?? raw?.[3]) as Address,
      fee: Number(raw?.fee ?? raw?.[4] ?? 0),
      parameters: (raw?.parameters ?? raw?.[5]) as `0x${string}`,
      tickSpacing: decodePancakeTickSpacing(raw?.parameters ?? raw?.[5] ?? '0x0'),
    }
  : {
      currency0: (raw?.currency0 ?? raw?.[0]) as Address,
      currency1: (raw?.currency1 ?? raw?.[1]) as Address,
      fee: Number(raw?.fee ?? raw?.[2] ?? 0),
      tickSpacing: Number(raw?.tickSpacing ?? raw?.[3] ?? 0),
      hooks: (raw?.hooks ?? raw?.[4]) as Address,
    }

const normalizeRoute = (raw: any, chainId: number, version = 0): BasketLegRoute => chainId === 56
  ? isBscBasketV3(chainId, version) ? {
      venue: Number(raw?.venue ?? raw?.[0] ?? 0),
      poolQuoteToken: (raw?.poolQuoteToken ?? raw?.[1] ?? zeroAddress) as Address,
      v4Pool: normalizePool(raw?.v4Pool ?? raw?.[2], chainId),
      v3Fee: Number(raw?.v3Fee ?? raw?.[3] ?? 0),
      defaultMaxExecutionLossBps: Number(raw?.defaultMaxExecutionLossBps ?? raw?.[4] ?? 0),
    } : {
      venue: Number(raw?.venue ?? raw?.[0] ?? 0),
      quoteToken: Number(raw?.quoteToken ?? raw?.[1] ?? 0) === 1 ? 1 : 0,
      v4Pool: normalizePool(raw?.v4Pool ?? raw?.[2], chainId),
      v3Fee: Number(raw?.v3Fee ?? raw?.[3] ?? 0),
    }
  : {
      venue: Number(raw?.venue ?? raw?.[0] ?? 0),
      v4Pool: normalizePool(raw?.v4Pool ?? raw?.[1], chainId),
      v3Fee: Number(raw?.v3Fee ?? raw?.[2] ?? 0),
    }

const poolId = (key: BasketPoolKey, chainId: number): `0x${string}` => chainId === 56
  ? keccak256(encodeAbiParameters([{
      type: 'tuple', components: [
        { type: 'address', name: 'currency0' }, { type: 'address', name: 'currency1' },
        { type: 'address', name: 'hooks' }, { type: 'address', name: 'poolManager' },
        { type: 'uint24', name: 'fee' }, { type: 'bytes32', name: 'parameters' },
      ],
    }], [toContractPoolKey(key, chainId) as any]))
  : keccak256(encodeAbiParameters([{
      type: 'tuple', components: [
        { type: 'address', name: 'currency0' }, { type: 'address', name: 'currency1' },
        { type: 'uint24', name: 'fee' }, { type: 'int24', name: 'tickSpacing' },
        { type: 'address', name: 'hooks' },
      ],
    }], [toContractPoolKey(key, chainId) as any]))

const hubStateContract = (deployment: BasketDeployment): MulticallContract => deployment.chainId === 56
  ? {
      address: deployment.contracts.poolManager,
      abi: pancakePoolManagerStateAbi,
      functionName: 'getSlot0',
      args: [poolId(deployment.hubPool, deployment.chainId)],
    }
  : {
      address: deployment.contracts.poolManager,
      abi: [{
        inputs: [{ name: 'slot', type: 'bytes32' }], name: 'extsload',
        outputs: [{ name: 'value', type: 'bytes32' }], stateMutability: 'view', type: 'function',
      }],
      functionName: 'extsload',
      args: [getRhV4PoolStateSlot(poolId(deployment.hubPool, deployment.chainId))],
    }

const parseHubSqrtPrice = (result: unknown, chainId: number): bigint => chainId === 56
  ? BigInt((result as readonly unknown[] | undefined)?.[0] as bigint ?? 0n)
  : BigInt(result as string) & ((1n << 160n) - 1n)

const getHubSqrtPrice = async (client: PublicClient, deployment: BasketDeployment): Promise<bigint> => {
  const cached = hubSqrtCache.get(deployment.chainId)
  if (cached && isFresh(cached.at)) return cached.data
  const contract = hubStateContract(deployment)
  const result = await client.readContract(contract as any)
  const sqrtPrice = parseHubSqrtPrice(result, deployment.chainId)
  hubSqrtCache.set(deployment.chainId, { at: Date.now(), data: sqrtPrice })
  return sqrtPrice
}

const wethToUsdgRaw = (wethWei: bigint, sqrtPriceX96: bigint): bigint =>
  (wethWei * sqrtPriceX96 * sqrtPriceX96) >> 192n

const quoteAtSqrtPrice = (sqrtPriceX96: bigint, amount: bigint, oneForZero: boolean): bigint => {
  if (sqrtPriceX96 === 0n || amount === 0n) return 0n
  return oneForZero
    ? (amount * Q96 / sqrtPriceX96) * Q96 / sqrtPriceX96
    : (amount * sqrtPriceX96 / Q96) * sqrtPriceX96 / Q96
}

const sameAddress = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

const sortAddresses = (a: Address, b: Address): readonly [Address, Address] =>
  BigInt(a.toLowerCase()) < BigInt(b.toLowerCase()) ? [a, b] : [b, a]

const pancakeV3PoolAddress = (quote: Address, asset: Address, fee: number): Address => {
  const [token0, token1] = sortAddresses(quote, asset)
  const salt = keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
    [token0, token1, fee],
  ))
  return getCreate2Address({
    from: PANCAKE_V3_DEPLOYER,
    salt,
    bytecodeHash: PANCAKE_V3_POOL_INIT_CODE_HASH,
  })
}

const bscQuoteToken = (deployment: BasketDeployment, route: BasketLegRoute): Address =>
  route.quoteToken === 1 ? deployment.contracts.settlementToken : deployment.contracts.wrappedNative

const bscSpotQuoteContract = (
  deployment: BasketDeployment,
  asset: Address,
  route: BasketLegRoute,
): MulticallContract | null => {
  if (route.venue === 2) return null
  if (route.venue === 1) {
    if (!route.v3Fee) return null
    return {
      address: pancakeV3PoolAddress(bscQuoteToken(deployment, route), asset, route.v3Fee),
      abi: pancakeV3PoolSpotAbi,
      functionName: 'slot0',
    }
  }
  if (route.venue === 0) {
    return {
      address: deployment.contracts.poolManager,
      abi: pancakePoolManagerStateAbi,
      functionName: 'getSlot0',
      args: [poolId(route.v4Pool, deployment.chainId)],
    }
  }
  return null
}

const bscSpotAssetToWbnb = (
  deployment: BasketDeployment,
  asset: Address,
  route: BasketLegRoute,
  amount: bigint,
  spotResult: unknown,
  hubSqrtPrice: bigint,
): bigint => {
  if (amount === 0n) return 0n
  if (route.venue === 2) return amount

  const sqrtPriceX96 = BigInt((spotResult as readonly unknown[] | undefined)?.[0] as bigint ?? 0n)
  if (sqrtPriceX96 === 0n) return 0n

  let quoteAmount = 0n
  if (route.venue === 1) {
    const quote = bscQuoteToken(deployment, route)
    const [token0] = sortAddresses(quote, asset)
    quoteAmount = quoteAtSqrtPrice(sqrtPriceX96, amount, sameAddress(token0, quote))
  } else if (route.venue === 0) {
    const quote = route.quoteToken === 1 ? deployment.contracts.settlementToken : zeroAddress
    const c0 = route.v4Pool.currency0
    const c1 = route.v4Pool.currency1
    if (!((sameAddress(c0, quote) && sameAddress(c1, asset)) || (sameAddress(c0, asset) && sameAddress(c1, quote)))) {
      return 0n
    }
    quoteAmount = quoteAtSqrtPrice(sqrtPriceX96, amount, sameAddress(c0, quote))
  }

  if (route.quoteToken !== 1) return quoteAmount
  return quoteAtSqrtPrice(hubSqrtPrice, quoteAmount, true)
}

export const invalidateBasketCache = (address?: Address) => {
  listCache.clear()
  if (!address) {
    detailCache.clear()
    return
  }
  for (const chainId of [56, 4663]) detailCache.delete(cacheKey(chainId, address))
}

export const getBasketDetail = async (
  address: Address,
  chainId: number,
  options: BasketReadOptions = {},
): Promise<BasketDetail> => {
  if (!isBasketChain(chainId)) throw new Error('Baskets are not available on this chain')
  const deployment = getBasketDeployment(chainId)
  const defaultTokenAbi = getBasketTokenAbi(chainId, chainId === 56 ? 2 : undefined)
  if (!isAddress(address)) throw new Error('Invalid basket address')
  const key = cacheKey(chainId, address)
  const cached = detailCache.get(key)
  if (!options.force && cached && isFresh(cached.at)) return cached.data

  const client = getReadOnlyClient(chainId)
  let registered: RegisteredBasket | null = null
  try {
    registered = await getRegisteredBasket(address, chainId)
  } catch {
    // A newly created Basket may be usable onchain before the API write succeeds.
  }

  if (registered) {
    const contractsConfig = getBasketProtocol(chainId, chainId === 56 ? registered.version : undefined)
    const tokenAbi = getBasketTokenAbi(chainId, registered.version)
    const executorAbi = getRebalanceExecutorAbi(chainId, registered.version)
    const bscV3 = isBscBasketV3(chainId, registered.version)
    const quoteAssetFunction = bscV3 ? 'quoteAssetToQuote' : chainId === 56 ? 'quoteAssetToWbnb' : 'quoteAssetToWeth'
    const contracts: MulticallContract[] = [
      { address, abi: tokenAbi, functionName: 'creatorPayout' },
      { address, abi: tokenAbi, functionName: 'launcherPayout' },
      { address, abi: tokenAbi, functionName: 'totalSupply' },
      { address, abi: tokenAbi, functionName: 'effectiveSupply' },
      { address, abi: tokenAbi, functionName: 'lastRebalanceAt' },
      { address, abi: tokenAbi, functionName: 'engine' },
    ]
    const assetReads: { stateIndex: number; quoteIndex: number | null }[] = []
    registered.assets.forEach((asset) => {
      const stateIndex = contracts.length
      contracts.push({ address, abi: tokenAbi, functionName: 'assetAt', args: [BigInt(asset.position)] })
      let quoteIndex: number | null = null
      if (bscV3) {
        quoteIndex = contracts.length
        contracts.push({
          address: contractsConfig.rebalanceExecutor,
          abi: executorAbi,
          functionName: quoteAssetFunction,
          args: [toContractLegRoute(asset.route, chainId, registered.version), asset.address, 10n ** BigInt(asset.decimals)],
        })
      } else if (chainId === 56) {
        const spotContract = bscSpotQuoteContract(deployment, asset.address, asset.route)
        if (spotContract) {
          quoteIndex = contracts.length
          contracts.push(spotContract)
        }
      } else {
        quoteIndex = contracts.length
        contracts.push({
          address: contractsConfig.rebalanceExecutor,
          abi: executorAbi,
          functionName: quoteAssetFunction,
          args: [toContractLegRoute(asset.route, chainId, registered.version), asset.address, 10n ** BigInt(asset.decimals)],
        })
      }
      assetReads.push({ stateIndex, quoteIndex })
    })
    if (!bscV3) contracts.push(hubStateContract(deployment))

    const rows = await multicall(client, contracts)
    const creatorPayout = ok<Address>(rows[0])
    const launcher = ok<Address>(rows[1])
    const totalSupplyRaw = ok<bigint>(rows[2]) ?? 0n
    const effectiveSupplyRaw = ok<bigint>(rows[3]) ?? 0n
    const engine = ok<Address>(rows[5])
    if (!engine || engine.toLowerCase() !== contractsConfig.hook.toLowerCase()) {
      throw new Error('This Basket belongs to an unsupported protocol deployment')
    }
    const hubResult = bscV3 ? null : ok<unknown>(rows[rows.length - 1])
    const hubSqrtPrice = hubResult ? parseHubSqrtPrice(hubResult, chainId) : 0n
    if (!bscV3 && hubSqrtPrice > 0n) hubSqrtCache.set(chainId, { at: Date.now(), data: hubSqrtPrice })

    const holdings: BasketHolding[] = registered.assets.map((asset, index) => {
      const read = assetReads[index]
      const state: any = ok(rows[read.stateIndex])
      const reserve = BigInt(state?.activeReserve ?? state?.[2] ?? 0)
      const quoteResult = read.quoteIndex === null ? null : ok<unknown>(rows[read.quoteIndex])
      const unitQuote = read.quoteIndex === null ? 0n : ok<bigint>(rows[read.quoteIndex]) ?? 0n
      const reserveQuote = bscV3 || chainId !== 56
        ? reserve * unitQuote / (10n ** BigInt(asset.decimals))
        : 0n
      const reserveWeth = bscV3
        ? 0n
        : chainId === 56
          ? bscSpotAssetToWbnb(deployment, asset.address, asset.route, reserve, quoteResult, hubSqrtPrice)
          : reserveQuote
      const valueSettlement = bscV3
        ? reserveQuote
        : hubSqrtPrice > 0n ? wethToUsdgRaw(reserveWeth, hubSqrtPrice) : 0n
      const valueUsd = Number(formatUnits(valueSettlement, deployment.settlementDecimals))
      const balance = Number(formatUnits(reserve, asset.decimals))
      return {
        asset: asset.address,
        symbol: asset.symbol.slice(0, 24),
        decimals: asset.decimals,
        targetWeightPct: asset.targetWeightBps / 100,
        balance,
        priceUsd: balance > 0 ? valueUsd / balance : 0,
        valueUsd,
        priced: valueSettlement > 0n && valueUsd > 0,
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
      launchNav: 1,
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
      lastRebalanceAt: Number(ok<bigint>(rows[4]) ?? 0n),
      holdings,
      updatedAt: new Date().toISOString(),
    }
    detailCache.set(key, { at: Date.now(), data: detail })
    return detail
  }

  const meta = await multicall(client, [
    { address, abi: defaultTokenAbi, functionName: 'name' },
    { address, abi: defaultTokenAbi, functionName: 'symbol' },
    { address, abi: defaultTokenAbi, functionName: 'decimals' },
    { address, abi: defaultTokenAbi, functionName: 'assetCount' },
    { address, abi: defaultTokenAbi, functionName: 'basketFeeBps' },
    { address, abi: defaultTokenAbi, functionName: 'creatorShareBps' },
    { address, abi: defaultTokenAbi, functionName: 'creatorPayout' },
    { address, abi: defaultTokenAbi, functionName: 'launcherPayout' },
    { address, abi: defaultTokenAbi, functionName: 'totalSupply' },
    { address, abi: defaultTokenAbi, functionName: 'effectiveSupply' },
    { address: deployment.contracts.registry, abi: basketRegistryAbi, functionName: 'basketCreator', args: [address] },
    { address: deployment.contracts.registry, abi: basketRegistryAbi, functionName: 'basketVersion', args: [address] },
    { address: deployment.contracts.registry, abi: basketRegistryAbi, functionName: 'basketCreatedAt', args: [address] },
    { address, abi: defaultTokenAbi, functionName: 'lastRebalanceAt' },
    { address, abi: defaultTokenAbi, functionName: 'engine' },
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
  const contractsConfig = getBasketProtocol(chainId, chainId === 56 ? version : undefined)
  const tokenAbi = getBasketTokenAbi(chainId, version)
  const executorAbi = getRebalanceExecutorAbi(chainId, version)
  const bscV3 = isBscBasketV3(chainId, version)
  const quoteAssetFunction = bscV3 ? 'quoteAssetToQuote' : chainId === 56 ? 'quoteAssetToWbnb' : 'quoteAssetToWeth'
  const createdAt = Number(ok<bigint>(meta[12]) ?? 0n)
  const lastRebalanceAt = Number(ok<bigint>(meta[13]) ?? 0n)
  const engine = ok<Address>(meta[14])
  if (!engine || engine.toLowerCase() !== contractsConfig.hook.toLowerCase()) {
    throw new Error('This Basket belongs to an unsupported protocol deployment')
  }

  const legs = await multicall(client, [
    ...Array.from({ length }, (_, index) => ({
      address, abi: tokenAbi, functionName: 'assetAt', args: [BigInt(index)],
    })),
    ...Array.from({ length }, (_, index) => ({
      address, abi: tokenAbi, functionName: 'assetRouteAt', args: [BigInt(index)],
    })),
  ])

  const assets = Array.from({ length }, (_, index) => {
    const raw: any = ok(legs[index])
    return {
      address: (raw?.asset ?? raw?.[0]) as Address,
      weightBps: Number(raw?.targetWeightBps ?? raw?.[1] ?? 0),
      reserve: BigInt(raw?.activeReserve ?? raw?.[2] ?? 0),
      route: normalizeRoute(ok(legs[length + index]), chainId, version),
    }
  }).filter((leg) => isAddress(leg.address))

  const assetMetaContracts: MulticallContract[] = []
  const assetMetaReads: { symbolIndex: number; decimalsIndex: number; quoteIndex: number | null }[] = []
  assets.forEach((leg) => {
    const symbolIndex = assetMetaContracts.length
    assetMetaContracts.push({ address: leg.address, abi: erc20Abi, functionName: 'symbol' })
    const decimalsIndex = assetMetaContracts.length
    assetMetaContracts.push({ address: leg.address, abi: erc20Abi, functionName: 'decimals' })
    let quoteIndex: number | null = null
    if (bscV3) {
      quoteIndex = assetMetaContracts.length
      assetMetaContracts.push({
        address: contractsConfig.rebalanceExecutor,
        abi: executorAbi,
        functionName: quoteAssetFunction,
        args: [toContractLegRoute(leg.route, chainId, version), leg.address, leg.reserve],
      })
    } else if (chainId === 56) {
      const spotContract = bscSpotQuoteContract(deployment, leg.address, leg.route)
      if (spotContract) {
        quoteIndex = assetMetaContracts.length
        assetMetaContracts.push(spotContract)
      }
    } else {
      quoteIndex = assetMetaContracts.length
      assetMetaContracts.push({
        address: contractsConfig.rebalanceExecutor,
        abi: executorAbi,
        functionName: quoteAssetFunction,
        args: [toContractLegRoute(leg.route, chainId, version), leg.address, leg.reserve],
      })
    }
    assetMetaReads.push({ symbolIndex, decimalsIndex, quoteIndex })
  })
  const assetMeta = await multicall(client, assetMetaContracts)
  const hubSqrtPrice = bscV3 ? 0n : await getHubSqrtPrice(client, deployment)

  const holdings: BasketHolding[] = assets.map((leg, index) => {
    const read = assetMetaReads[index]
    const assetDecimals = Number(ok<number>(assetMeta[read.decimalsIndex]) ?? 18)
    const quoteResult = read.quoteIndex === null ? null : ok<unknown>(assetMeta[read.quoteIndex])
    const directQuote = read.quoteIndex === null ? 0n : ok<bigint>(assetMeta[read.quoteIndex]) ?? 0n
    const reserveWeth = bscV3
      ? 0n
      : chainId === 56
        ? bscSpotAssetToWbnb(deployment, leg.address, leg.route, leg.reserve, quoteResult, hubSqrtPrice)
        : directQuote
    const valueSettlement = bscV3 ? directQuote : wethToUsdgRaw(reserveWeth, hubSqrtPrice)
    const valueUsd = Number(formatUnits(valueSettlement, deployment.settlementDecimals))
    const balance = Number(formatUnits(leg.reserve, assetDecimals))
    const priceUsd = balance > 0 ? valueUsd / balance : 0
    return {
      asset: leg.address,
      symbol: (ok<string>(assetMeta[read.symbolIndex]) || '?').slice(0, 24),
      decimals: assetDecimals,
      targetWeightPct: leg.weightBps / 100,
      balance,
      priceUsd,
      valueUsd,
      priced: valueSettlement > 0n && valueUsd > 0,
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
    launchNav: 1,
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
    lastRebalanceAt,
    holdings,
    updatedAt: new Date().toISOString(),
  }
  detailCache.set(key, { at: Date.now(), data: detail })
  return detail
}

export const listBaskets = async (
  chainId: number,
  options: BasketReadOptions = {},
): Promise<BasketSummary[]> => {
  const deployment = getBasketDeployment(chainId)
  const cached = listCache.get(chainId)
  if (!options.force && cached && isFresh(cached.at)) {
    options.onShell?.(cached.data)
    return cached.data
  }
  const client = getReadOnlyClient(chainId)
  const registered = (await listRegisteredBaskets(chainId))
    .filter((basket) => isAddress(basket.address))
    .sort((a, b) => b.createdAt - a.createdAt)

  const shells: BasketSummary[] = registered.map((basket) => ({
    chainId,
    address: basket.address,
    name: basket.name,
    symbol: basket.symbol,
    version: basket.version,
    basketLength: basket.basketLength,
    navPerToken: 0,
    aumUsd: 0,
    pricedCount: 0,
    launchNav: 1,
    currentNavAsOf: null,
    toDatePct: null,
    dataQuality: 'unavailable',
    launchTimeQuality: 'unavailable',
    top: [...basket.assets]
      .sort((a, b) => b.targetWeightBps - a.targetWeightBps)
      .map((asset) => ({ address: asset.address, symbol: asset.symbol, weightPct: asset.targetWeightBps / 100 })),
    deployer: basket.creator,
  }))
  options.onShell?.(shells)
  if (!registered.length) {
    listCache.set(chainId, { at: Date.now(), data: shells })
    return shells
  }

  type ListRead =
    | { kind: 'effectiveSupply'; basketIndex: number }
    | { kind: 'reserve'; basketIndex: number; assetIndex: number }
    | { kind: 'unitQuote'; basketIndex: number; assetIndex: number }
    | { kind: 'spotQuote'; basketIndex: number; assetIndex: number }
    | { kind: 'hubPrice' }

  const contracts: MulticallContract[] = []
  const reads: ListRead[] = []
  const addRead = (contract: MulticallContract, read: ListRead) => {
    contracts.push(contract)
    reads.push(read)
  }

  registered.forEach((basket, basketIndex) => {
    const contractsConfig = getBasketProtocol(chainId, chainId === 56 ? basket.version : undefined)
    const tokenAbi = getBasketTokenAbi(chainId, basket.version)
    const executorAbi = getRebalanceExecutorAbi(chainId, basket.version)
    const bscV3 = isBscBasketV3(chainId, basket.version)
    const quoteAssetFunction = bscV3 ? 'quoteAssetToQuote' : chainId === 56 ? 'quoteAssetToWbnb' : 'quoteAssetToWeth'
    addRead({ address: basket.address, abi: tokenAbi, functionName: 'effectiveSupply' }, { kind: 'effectiveSupply', basketIndex })
    basket.assets.forEach((asset, assetIndex) => {
      addRead(
        { address: basket.address, abi: tokenAbi, functionName: 'assetAt', args: [BigInt(asset.position)] },
        { kind: 'reserve', basketIndex, assetIndex },
      )
      if (bscV3) {
        addRead(
          {
            address: contractsConfig.rebalanceExecutor,
            abi: executorAbi,
            functionName: quoteAssetFunction,
            args: [toContractLegRoute(asset.route, chainId, basket.version), asset.address, 10n ** BigInt(asset.decimals)],
          },
          { kind: 'unitQuote', basketIndex, assetIndex },
        )
      } else if (chainId === 56) {
        const spotContract = bscSpotQuoteContract(deployment, asset.address, asset.route)
        if (spotContract) addRead(spotContract, { kind: 'spotQuote', basketIndex, assetIndex })
      } else {
        addRead(
          {
            address: contractsConfig.rebalanceExecutor,
            abi: executorAbi,
            functionName: quoteAssetFunction,
            args: [toContractLegRoute(asset.route, chainId, basket.version), asset.address, 10n ** BigInt(asset.decimals)],
          },
          { kind: 'unitQuote', basketIndex, assetIndex },
        )
      }
    })
  })
  addRead(
    hubStateContract(deployment),
    { kind: 'hubPrice' },
  )

  const results = await multicall(client, contracts)
  const effectiveSupplies = registered.map(() => 0n)
  const reserves = registered.map((basket) => basket.assets.map(() => 0n))
  const unitQuotes = registered.map((basket) => basket.assets.map(() => 0n))
  const spotQuotes = registered.map((basket) => basket.assets.map(() => null as unknown))
  let hubSqrtPrice = 0n
  reads.forEach((read, index) => {
    const result = results[index]
    if (result?.status !== 'success') return
    if (read.kind === 'effectiveSupply') effectiveSupplies[read.basketIndex] = result.result as bigint
    else if (read.kind === 'reserve') {
      const raw: any = result.result
      reserves[read.basketIndex][read.assetIndex] = BigInt(raw?.activeReserve ?? raw?.[2] ?? 0)
    } else if (read.kind === 'unitQuote') unitQuotes[read.basketIndex][read.assetIndex] = result.result as bigint
    else if (read.kind === 'spotQuote') spotQuotes[read.basketIndex][read.assetIndex] = result.result
    else hubSqrtPrice = parseHubSqrtPrice(result.result, chainId)
  })

  const baskets = registered.map((basket, basketIndex): BasketSummary => {
    let aumRaw = 0n
    let pricedCount = 0
    basket.assets.forEach((asset, assetIndex) => {
      const reserve = reserves[basketIndex][assetIndex]
      const bscV3 = isBscBasketV3(chainId, basket.version)
      const unitValue = reserve * unitQuotes[basketIndex][assetIndex] / (10n ** BigInt(asset.decimals))
      const wethValue = bscV3
        ? 0n
        : chainId === 56
          ? bscSpotAssetToWbnb(deployment, asset.address, asset.route, reserve, spotQuotes[basketIndex][assetIndex], hubSqrtPrice)
          : unitValue
      const settlementValue = bscV3
        ? unitValue
        : hubSqrtPrice > 0n ? wethToUsdgRaw(wethValue, hubSqrtPrice) : 0n
      if (reserve > 0n && settlementValue > 0n) pricedCount += 1
      aumRaw += settlementValue
    })
    const aumUsd = Number(formatUnits(aumRaw, deployment.settlementDecimals))
    const effectiveSupply = Number(formatUnits(effectiveSupplies[basketIndex], basket.decimals))
    return {
      ...shells[basketIndex],
      aumUsd,
      navPerToken: effectiveSupply > 0 ? aumUsd / effectiveSupply : 0,
      pricedCount,
    }
  })
  try {
    const performance = await getBasketPerformances(baskets.map((basket) => basket.address), chainId)
    const byAddress = new Map(performance.map((item) => [item.address.toLowerCase(), item]))
    baskets.forEach((basket) => {
      const item = byAddress.get(basket.address.toLowerCase())
      if (!item) return
      const currentNav = Number(item.currentNav)
      const currentAum = Number(item.aumUsd)
      if (item.dataQuality === 'complete' && Number.isFinite(currentNav) && currentNav > 0) {
        basket.navPerToken = currentNav
        if (Number.isFinite(currentAum) && currentAum >= 0) basket.aumUsd = currentAum
      }
      basket.launchNav = 1
      basket.currentNavAsOf = item.asOf
      basket.toDatePct = item.toDatePct ?? null
      basket.dataQuality = item.dataQuality
      basket.launchTimeQuality = item.launchTimeQuality
    })
  } catch (error) {
    // NAV history is deployed independently; current on-chain valuation remains usable
    // while the snapshot migration or worker is not available yet.
    console.warn('[baskets] performance API unavailable', error)
  }
  listCache.set(chainId, { at: Date.now(), data: baskets })
  return baskets
}

export const getErc20Balance = async (token: Address, account: Address, chainId: number): Promise<bigint> =>
  getReadOnlyClient(chainId).readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })

export const getBasketBalance = getErc20Balance
