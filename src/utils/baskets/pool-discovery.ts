import { getAddress, isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { BASKET_CHAIN_ID, BASKET_CONTRACTS } from '@/config/baskets'
import { getTokenDexPools, type DexPoolInfo } from '@/utils/pump'
import { getRhV4PoolKeyByPoolId } from '@/utils/rhV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { buildCustomRoute } from './create'
import { assertBasketRouteUsable } from './route-validation'
import type { BasketLegRoute } from './types'

const v3PoolAbi = parseAbi([
  'function fee() view returns (uint24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
])

export type BasketPoolCandidate = {
  id: string
  venue: 0 | 1
  label: 'Uniswap V4' | 'Uniswap V3'
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

const sameAddress = (a: string | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase()

const isDirectPool = (pool: DexPoolInfo, asset: Address) => {
  const tokens = [pool.baseToken, pool.quoteToken]
  if (!tokens.some((token) => sameAddress(token, asset))) return false
  if (pool.dexVersion === 4) return tokens.some((token) => sameAddress(token, zeroAddress))
  if (pool.dexVersion === 3) return tokens.some((token) => sameAddress(token, BASKET_CONTRACTS.weth))
  return false
}

const resolveCandidate = async (
  pool: DexPoolInfo,
  asset: Address,
  assetSymbol: string,
): Promise<BasketPoolCandidate | null> => {
  if (!isDirectPool(pool, asset)) return null
  if (pool.dexVersion === 4 && /^0x[\da-fA-F]{64}$/.test(pool.pairAddress)) {
    const key = await getRhV4PoolKeyByPoolId(pool.pairAddress as `0x${string}`)
    if (!sameAddress(key.currency0, zeroAddress) || !sameAddress(key.currency1, asset)) return null
    const route = buildCustomRoute({
      asset,
      venue: 0,
      fee: key.fee,
      tickSpacing: key.tickSpacing,
      hooks: key.hooks,
    })
    await assertBasketRouteUsable(route, asset)
    return {
      id: pool.pairAddress,
      venue: 0,
      label: 'Uniswap V4',
      pairLabel: `${assetSymbol || 'TOKEN'}/ETH`,
      fee: key.fee,
      tickSpacing: key.tickSpacing,
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
    const client = getReadOnlyClient(BASKET_CHAIN_ID)
    const [fee, token0, token1] = await Promise.all([
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'fee' }),
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'token0' }),
      client.readContract({ address: poolAddress, abi: v3PoolAbi, functionName: 'token1' }),
    ])
    const tokens = [token0.toLowerCase(), token1.toLowerCase()]
    if (!tokens.includes(asset.toLowerCase()) || !tokens.includes(BASKET_CONTRACTS.weth.toLowerCase())) return null
    const route = buildCustomRoute({ asset, venue: 1, fee: Number(fee) })
    await assertBasketRouteUsable(route, asset)
    return {
      id: poolAddress,
      venue: 1,
      label: 'Uniswap V3',
      pairLabel: `${assetSymbol || 'TOKEN'}/WETH`,
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

export const discoverBasketPools = async (asset: Address, limit = 2): Promise<BasketPoolCandidate[]> => {
  const result = await getTokenDexPools(asset)
  if (!result) return []
  const candidates: BasketPoolCandidate[] = []
  for (const pool of result.pools) {
    if (candidates.length >= limit) break
    try {
      const candidate = await resolveCandidate(pool, asset, result.tokenSymbol)
      if (candidate) candidates.push(candidate)
    } catch (error) {
      console.warn('Basket pool candidate skipped', pool.pairAddress, error)
    }
  }
  return candidates
}
