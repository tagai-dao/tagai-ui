import { getAddress, isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, isUsdBasketLegSymbol } from '@/config/baskets'
import { getTokenDexPools, type DexPoolInfo } from '@/utils/pump'
import { getRhV4PoolKeyByPoolId } from '@/utils/rhV4Swap'
import { resolveV4PoolKeyForTrade } from '@/utils/pcsV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { buildCustomRoute } from './create'
import { assertBasketRouteUsable } from './route-validation'
import type { BasketLegRoute } from './types'

const v3PoolAbi = parseAbi([
  'function fee() view returns (uint24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
])

const tokenSymbolAbi = parseAbi(['function symbol() view returns (string)'])

export type BasketPoolCandidate = {
  id: string
  venue: 0 | 1
  label: 'Uniswap V4' | 'Uniswap V3' | 'Pancake Infinity' | 'Pancake V3'
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
  rejectionReasons: string[]
}

const sameAddress = (a: string | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase()

const poolCompatibilityIssue = (pool: DexPoolInfo, asset: Address, chainId: number): string | null => {
  const deployment = getBasketDeployment(chainId)
  const tokens = [pool.baseToken, pool.quoteToken]
  if (!tokens.some((token) => sameAddress(token, asset))) return 'Pool metadata does not contain the requested token.'
  if (pool.dexVersion === 4) {
    if (tokens.some((token) => sameAddress(token, zeroAddress))) return null
    if (chainId === 56 && tokens.some((token) =>
      sameAddress(token, deployment.contracts.wrappedNative) ||
      sameAddress(token, deployment.contracts.settlementToken))) return null
    return `Infinity pools must pair the token directly with ${chainId === 56 ? 'BNB or USDT' : deployment.nativeSymbol}.`
  }
  if (pool.dexVersion === 3) {
    if (!isAddress(pool.pairAddress)) return 'The V3 pool address is invalid.'
    if (tokens.some((token) => sameAddress(token, deployment.contracts.wrappedNative))) return null
    if (chainId === 56 && tokens.some((token) => sameAddress(token, deployment.contracts.settlementToken))) return null
    return `V3 pools must pair the token directly with ${chainId === 56 ? 'WBNB or USDT' : deployment.wrappedNativeSymbol}.`
  }
  return 'V2 pools are not supported; choose a V3 or Infinity pool.'
}

const hasPair = (currency0: string, currency1: string, a: string, b: string) =>
  (sameAddress(currency0, a) && sameAddress(currency1, b)) ||
  (sameAddress(currency0, b) && sameAddress(currency1, a))

const resolveCandidate = async (
  pool: DexPoolInfo,
  asset: Address,
  assetSymbol: string,
  chainId: number,
): Promise<BasketPoolCandidate | null> => {
  const deployment = getBasketDeployment(chainId)
  if (pool.dexVersion === 4) {
    if (chainId !== 56 && !/^0x[\da-fA-F]{64}$/.test(pool.pairAddress)) {
      throw new Error('The V4 pool ID is invalid.')
    }
    const key: any = chainId === 56
      ? await resolveV4PoolKeyForTrade(pool.pairAddress)
      : await getRhV4PoolKeyByPoolId(pool.pairAddress as `0x${string}`)
    if (!key) throw new Error('The Infinity PoolKey could not be resolved.')
    const encodedTick = chainId === 56 ? (BigInt(key.parameters) >> 16n) & 0xffffffn : 0n
    const tickSpacing = chainId === 56
      ? Number(encodedTick >= 0x800000n ? encodedTick - 0x1000000n : encodedTick)
      : Number(key.tickSpacing)
    let quoteToken: 0 | 1 | undefined
    let quoteSymbol: string = deployment.nativeSymbol
    if (chainId === 56) {
      if (hasPair(key.currency0, key.currency1, asset, deployment.contracts.settlementToken)) {
        quoteToken = 1
        quoteSymbol = deployment.settlementSymbol
      } else if (hasPair(key.currency0, key.currency1, asset, zeroAddress)) {
        quoteToken = 0
      } else throw new Error('The resolved Infinity PoolKey is not a direct BNB/USDT route for this token.')
    } else if (!sameAddress(key.currency0, zeroAddress) || !sameAddress(key.currency1, asset)) {
      throw new Error('The resolved V4 PoolKey is not a direct native-token route.')
    }
    const route = buildCustomRoute({
      asset,
      venue: 0,
      quoteToken,
      fee: key.fee,
      tickSpacing,
      hooks: key.hooks,
      ...(chainId === 56 ? { poolKey: { ...key, tickSpacing } } : {}),
    })
    await assertBasketRouteUsable(route, asset, chainId)
    return {
      id: pool.pairAddress,
      venue: 0,
      label: chainId === 56 ? 'Pancake Infinity' : 'Uniswap V4',
      pairLabel: `${assetSymbol || 'TOKEN'}/${quoteSymbol}`,
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
    if (!tokens.includes(asset.toLowerCase())) throw new Error('The V3 pool does not contain the requested token.')
    let quoteToken: 0 | 1 | undefined
    let quoteSymbol: string = deployment.wrappedNativeSymbol
    if (tokens.includes(deployment.contracts.wrappedNative.toLowerCase())) {
      if (chainId === 56) quoteToken = 0
    } else if (chainId === 56 && tokens.includes(deployment.contracts.settlementToken.toLowerCase())) {
      quoteToken = 1
      quoteSymbol = deployment.settlementSymbol
    } else throw new Error(`The V3 pool is not quoted in ${chainId === 56 ? 'WBNB or USDT' : deployment.wrappedNativeSymbol}.`)
    const route = buildCustomRoute({ asset, venue: 1, quoteToken, fee: Number(fee) })
    await assertBasketRouteUsable(route, asset, chainId)
    return {
      id: poolAddress,
      venue: 1,
      label: chainId === 56 ? 'Pancake V3' : 'Uniswap V3',
      pairLabel: `${assetSymbol || 'TOKEN'}/${quoteSymbol}`,
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
  return null
}

const rejectedPoolLabel = (pool: DexPoolInfo, chainId: number) => {
  const venue = pool.dexVersion === 4 ? (chainId === 56 ? 'Infinity' : 'V4') : `V${pool.dexVersion}`
  const id = pool.pairAddress.length > 18
    ? `${pool.pairAddress.slice(0, 10)}…${pool.pairAddress.slice(-8)}`
    : pool.pairAddress
  return `${venue} ${id}`
}

export const discoverBasketPools = async (asset: Address, chainId: number, limit = 2): Promise<BasketPoolDiscoveryResult> => {
  const result = await getTokenDexPools(asset)
  if (!result) return { candidates: [], rejectionReasons: ['No compatible DEX pool metadata was found for this token.'] }
  const client = getReadOnlyClient(chainId)
  const assetSymbol = await client.readContract({ address: asset, abi: tokenSymbolAbi, functionName: 'symbol' })
    .then(String, () => result.tokenSymbol || 'TOKEN')
  if (chainId === 56 && isUsdBasketLegSymbol(assetSymbol)) {
    return {
      candidates: [],
      rejectionReasons: [`${assetSymbol} is a USD stablecoin and cannot be used as a Basket constituent.`],
    }
  }
  const candidates: BasketPoolCandidate[] = []
  const rejectionReasons = new Set<string>()
  for (const pool of result.pools) {
    const issue = poolCompatibilityIssue(pool, asset, chainId)
    if (issue) {
      rejectionReasons.add(`${rejectedPoolLabel(pool, chainId)}: ${issue}`)
      continue
    }
    if (candidates.length >= limit) continue
    try {
      const candidate = await resolveCandidate(pool, asset, assetSymbol, chainId)
      if (candidate) candidates.push(candidate)
    } catch (error) {
      console.warn('Basket pool candidate skipped', pool.pairAddress, error)
      const reason = error instanceof Error ? error.message : String(error)
      rejectionReasons.add(`${rejectedPoolLabel(pool, chainId)}: ${reason}`)
    }
  }
  return { candidates, rejectionReasons: [...rejectionReasons] }
}
