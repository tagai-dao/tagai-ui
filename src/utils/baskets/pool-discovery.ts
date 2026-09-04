import { getAddress, isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, getBasketProtocol, isUsdBasketLegSymbol } from '@/config/baskets'
import { getTokenDexPools, type DexPoolInfo } from '@/utils/pump'
import { getRhV4PoolKeyByPoolId } from '@/utils/rhV4Swap'
import { resolveV4PoolKeyForTrade } from '@/utils/pcsV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { buildCustomRoute } from './create'
import {
  assertBasketRouteUsable,
  BasketPoolValidationError,
  type BasketPoolIssueParams,
} from './route-validation'
import type { BasketLegRoute } from './types'

const v3PoolAbi = parseAbi([
  'function fee() view returns (uint24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
])

const v3FactoryAbi = parseAbi(['function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)'])
const v2PairAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
])
const v2FactoryAbi = parseAbi(['function getPair(address tokenA,address tokenB) view returns (address pair)'])

const tokenSymbolAbi = parseAbi(['function symbol() view returns (string)'])

export type BasketPoolCandidate = {
  id: string
  venue: 0 | 1 | 3
  label: 'Uniswap V4' | 'Uniswap V3' | 'Uniswap V2' | 'Pancake Infinity' | 'Pancake V3' | 'Pancake V2'
  pairLabel: string
  fee: number
  tickSpacing: number | null
  hooks: Address
  liquidityUsd: number
  volume24h: number
  txCount24h: number
  createdAt: string
  route: BasketLegRoute
}

export type BasketPoolDiscoveryResult = {
  candidates: BasketPoolCandidate[]
  rejectionReasons: BasketPoolRejection[]
}

export type BasketPoolRejection = {
  poolLabel?: string
  issue: string
  params?: BasketPoolIssueParams
}

const rejection = (
  issue: string,
  params?: BasketPoolIssueParams,
  poolLabel?: string,
): BasketPoolRejection => ({ issue, ...(params ? { params } : {}), ...(poolLabel ? { poolLabel } : {}) })

const failDiscovery = (issue: string, params?: BasketPoolIssueParams): never => {
  throw new BasketPoolValidationError(issue, params)
}

const sameAddress = (a: string | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase()

const poolCompatibilityIssue = (pool: DexPoolInfo, asset: Address, chainId: number): BasketPoolRejection | null => {
  const deployment = getBasketDeployment(chainId)
  const tokens = [pool.baseToken, pool.quoteToken]
  if (!tokens.some((token) => sameAddress(token, asset))) return rejection('metadataTokenMismatch')
  if (pool.dexVersion === 4) {
    return null
  }
  if (pool.dexVersion === 3) {
    if (!isAddress(pool.pairAddress)) return rejection('invalidPoolAddress', { venue: 'V3' })
    return null
  }
  if (pool.dexVersion === 2 && isAddress(pool.pairAddress)) return null
  return rejection('v2Unsupported')
}

const otherToken = (token0: Address, token1: Address, asset: Address): Address => {
  if (sameAddress(token0, asset)) return token1
  if (sameAddress(token1, asset)) return token0
  return failDiscovery('poolTokenMismatch')
}

const quoteSymbol = async (quote: Address, chainId: number): Promise<string> => {
  const deployment = getBasketDeployment(chainId)
  if (sameAddress(quote, zeroAddress)) return deployment.nativeSymbol
  if (sameAddress(quote, deployment.contracts.wrappedNative)) return deployment.wrappedNativeSymbol
  if (sameAddress(quote, deployment.contracts.settlementToken)) return deployment.settlementSymbol
  return getReadOnlyClient(chainId).readContract({ address: quote, abi: tokenSymbolAbi, functionName: 'symbol' })
    .then(String, () => `${quote.slice(0, 6)}…${quote.slice(-4)}`)
}

const resolveCandidate = async (
  pool: DexPoolInfo,
  asset: Address,
  assetSymbol: string,
  chainId: number,
): Promise<BasketPoolCandidate | null> => {
  const deployment = getBasketDeployment(chainId)
  if (pool.dexVersion === 4) {
    if (chainId !== 56 && !/^0x[\da-fA-F]{64}$/.test(pool.pairAddress)) {
      failDiscovery('invalidPoolAddress', { venue: 'V4' })
    }
    const key: any = chainId === 56
      ? await resolveV4PoolKeyForTrade(pool.pairAddress)
      : await getRhV4PoolKeyByPoolId(pool.pairAddress as `0x${string}`)
    if (!key) failDiscovery('poolKeyUnavailable', { venue: chainId === 56 ? 'Infinity' : 'V4' })
    const encodedTick = chainId === 56 ? (BigInt(key.parameters) >> 16n) & 0xffffffn : 0n
    const tickSpacing = chainId === 56
      ? Number(encodedTick >= 0x800000n ? encodedTick - 0x1000000n : encodedTick)
      : Number(key.tickSpacing)
    let poolQuoteToken: Address | undefined
    let poolQuoteSymbol: string = deployment.nativeSymbol
    if (!sameAddress(key.currency0, asset) && !sameAddress(key.currency1, asset)) {
      failDiscovery('poolTokenMismatch', { venue: chainId === 56 ? 'Infinity' : 'V4' })
    }
    poolQuoteToken = otherToken(key.currency0, key.currency1, asset)
    poolQuoteSymbol = await quoteSymbol(poolQuoteToken, chainId)
    const route = buildCustomRoute({
      asset,
      venue: 0,
      poolQuoteToken,
      fee: key.fee,
      tickSpacing,
      hooks: key.hooks,
      poolKey: { ...key, tickSpacing },
    })
    await assertBasketRouteUsable(route, asset, chainId)
    return {
      id: pool.pairAddress,
      venue: 0,
      label: chainId === 56 ? 'Pancake Infinity' : 'Uniswap V4',
      pairLabel: `${assetSymbol || 'TOKEN'}/${poolQuoteSymbol}`,
      fee: key.fee,
      tickSpacing,
      hooks: getAddress(key.hooks),
      liquidityUsd: pool.liquidityUsd,
      volume24h: pool.volume24h,
      txCount24h: pool.txCount24h,
      createdAt: pool.createdAt,
      route,
    }
  }
  if (pool.dexVersion === 3 && isAddress(pool.pairAddress)) {
    const poolAddress = getAddress(pool.pairAddress)
    const client = getReadOnlyClient(chainId)
    const [fee, token0, token1] = await Promise.all([
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'fee' }),
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'token0' }),
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'token1' }),
    ])
    const tokens = [token0.toLowerCase(), token1.toLowerCase()]
    if (!tokens.includes(asset.toLowerCase())) failDiscovery('poolTokenMismatch', { venue: 'V3' })
    const poolQuoteToken = otherToken(token0, token1, asset)
    const factory = getBasketProtocol(chainId, 3).v3Factory
    if (!factory) failDiscovery('v3NotConfigured')
    const canonical = await client.readContract({
      address: factory!, abi: v3FactoryAbi, functionName: 'getPool', args: [asset, poolQuoteToken, fee],
    })
    if (!sameAddress(canonical, poolAddress)) failDiscovery('unsupportedFactory', { venue: 'V3' })
    const poolQuoteSymbol = await quoteSymbol(poolQuoteToken, chainId)
    const route = buildCustomRoute({ asset, venue: 1, poolQuoteToken, fee: Number(fee) })
    await assertBasketRouteUsable(route, asset, chainId)
    return {
      id: poolAddress,
      venue: 1,
      label: chainId === 56 ? 'Pancake V3' : 'Uniswap V3',
      pairLabel: `${assetSymbol || 'TOKEN'}/${poolQuoteSymbol}`,
      fee: Number(fee),
      tickSpacing: null,
      hooks: zeroAddress,
      liquidityUsd: pool.liquidityUsd,
      volume24h: pool.volume24h,
      txCount24h: pool.txCount24h,
      createdAt: pool.createdAt,
      route,
    }
  }
  if (pool.dexVersion === 2 && isAddress(pool.pairAddress)) {
    const pairAddress = getAddress(pool.pairAddress)
    const client = getReadOnlyClient(chainId)
    const [token0, token1] = await Promise.all([
      client.readContract({ address: pairAddress, abi: v2PairAbi, functionName: 'token0' }),
      client.readContract({ address: pairAddress, abi: v2PairAbi, functionName: 'token1' }),
    ])
    const poolQuoteToken = otherToken(token0, token1, asset)
    const factory = getBasketProtocol(chainId, 3).v2Factory
    if (!factory) failDiscovery('v2Unsupported')
    const canonical = await client.readContract({
      address: factory!, abi: v2FactoryAbi, functionName: 'getPair', args: [asset, poolQuoteToken],
    })
    if (!sameAddress(canonical, pairAddress)) failDiscovery('unsupportedFactory', { venue: 'V2' })
    const poolQuoteSymbol = await quoteSymbol(poolQuoteToken, chainId)
    const route = buildCustomRoute({ asset, venue: 3, poolQuoteToken, fee: 0 })
    await assertBasketRouteUsable(route, asset, chainId)
    return {
      id: pairAddress,
      venue: 3,
      label: chainId === 56 ? 'Pancake V2' : 'Uniswap V2',
      pairLabel: `${assetSymbol || 'TOKEN'}/${poolQuoteSymbol}`,
      fee: 2_500,
      tickSpacing: null,
      hooks: zeroAddress,
      liquidityUsd: pool.liquidityUsd,
      volume24h: pool.volume24h,
      txCount24h: pool.txCount24h,
      createdAt: pool.createdAt,
      route,
    }
  }
  return null
}

const rejectedPoolLabel = (pool: DexPoolInfo, chainId: number) => {
  const venue = pool.dexVersion === 4 ? (chainId === 56 ? 'Infinity' : 'V4') : `V${pool.dexVersion}`
  const id = pool.pairAddress.length > 18
    ? `${pool.pairAddress.slice(0, 10)}…${pool.pairAddress.slice(-8)}`
    : pool.pairAddress
  return `${venue} ${id}`
}

export const discoverBasketPools = async (asset: Address, chainId: number, limit = 8): Promise<BasketPoolDiscoveryResult> => {
  const result = await getTokenDexPools(asset)
  if (!result) return { candidates: [], rejectionReasons: [rejection('metadataUnavailable')] }
  const client = getReadOnlyClient(chainId)
  const assetSymbol = await client.readContract({ address: asset, abi: tokenSymbolAbi, functionName: 'symbol' })
    .then(String, () => result.tokenSymbol || 'TOKEN')
  if (chainId === 56 && isUsdBasketLegSymbol(assetSymbol)) {
    return {
      candidates: [],
      rejectionReasons: [rejection('usdConstituent', { symbol: assetSymbol })],
    }
  }
  const candidates: BasketPoolCandidate[] = []
  const rejectionReasons = new Map<string, BasketPoolRejection>()
  for (const pool of result.pools) {
    const issue = poolCompatibilityIssue(pool, asset, chainId)
    if (issue) {
      const poolLabel = rejectedPoolLabel(pool, chainId)
      rejectionReasons.set(`${poolLabel}:${issue.issue}:${JSON.stringify(issue.params ?? {})}`, { ...issue, poolLabel })
      continue
    }
    if (candidates.length >= limit) continue
    try {
      const candidate = await resolveCandidate(pool, asset, assetSymbol, chainId)
      if (candidate) candidates.push(candidate)
    } catch (error) {
      console.warn('Basket pool candidate skipped', pool.pairAddress, error)
      const issue = error instanceof BasketPoolValidationError
        ? rejection(error.issue, error.params, rejectedPoolLabel(pool, chainId))
        : rejection('validationFailed', undefined, rejectedPoolLabel(pool, chainId))
      rejectionReasons.set(`${issue.poolLabel}:${issue.issue}:${JSON.stringify(issue.params ?? {})}`, issue)
    }
  }
  return { candidates, rejectionReasons: [...rejectionReasons.values()] }
}
