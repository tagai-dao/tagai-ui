import { encodeAbiParameters, getAddress, keccak256, parseAbi, zeroAddress, type Address } from 'viem'
import { BASKET_CHAIN_ID, BASKET_CONTRACTS, type BasketPoolKey } from '@/config/baskets'
import { getRhV4PoolLiquidity, getRhV4PoolState } from '@/utils/rhV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { basketRegistryAbi } from './abis'
import type { BasketLegRoute } from './types'

const V3_TWAP_WINDOW_SECONDS = 300

const rebalanceExecutorRouteAbi = parseAbi([
  'function v3Factory() view returns (address)',
])

const v3FactoryAbi = parseAbi([
  'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)',
])

const v3PoolValidationAbi = parseAbi([
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
  'function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives,uint160[] secondsPerLiquidityCumulativeX128s)',
])

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** PoolKey.toId(): keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks)). */
export const getBasketV4PoolId = (pool: BasketPoolKey): `0x${string}` =>
  keccak256(encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks],
  ))

const assertV4RouteUsable = async (route: BasketLegRoute, asset: Address) => {
  const pool = route.v4Pool
  if (!sameAddress(pool.currency0, zeroAddress) || !sameAddress(pool.currency1, asset)) {
    throw new Error('The selected V4 pool is not a direct native ETH route for this asset')
  }

  const client = getReadOnlyClient(BASKET_CHAIN_ID)
  const poolId = getBasketV4PoolId(pool)
  const hookTrustPromise = sameAddress(pool.hooks, zeroAddress)
    ? Promise.resolve(true)
    : client.readContract({
        address: BASKET_CONTRACTS.registry,
        abi: basketRegistryAbi,
        functionName: 'trustedConstituentHooks',
        args: [pool.hooks],
      })
  const [state, liquidity, trustedHook] = await Promise.all([
    getRhV4PoolState(poolId),
    getRhV4PoolLiquidity(poolId),
    hookTrustPromise,
  ])

  if (state.sqrtPriceX96 === 0n) throw new Error('The selected V4 pool is not initialized')
  if (liquidity === 0n) throw new Error('The selected V4 pool has no active liquidity')
  if (!trustedHook) throw new Error('The selected V4 pool hook is not approved for Basket constituents')
}

const assertV3RouteUsable = async (route: BasketLegRoute, asset: Address) => {
  if (!Number.isInteger(route.v3Fee) || route.v3Fee <= 0) {
    throw new Error('The selected V3 route has an invalid fee tier')
  }

  const client = getReadOnlyClient(BASKET_CHAIN_ID)
  const factory = await client.readContract({
    address: BASKET_CONTRACTS.rebalanceExecutor,
    abi: rebalanceExecutorRouteAbi,
    functionName: 'v3Factory',
  })
  if (sameAddress(factory, zeroAddress)) throw new Error('V3 Basket routes are not configured')

  const pool = await client.readContract({
    address: factory,
    abi: v3FactoryAbi,
    functionName: 'getPool',
    args: [BASKET_CONTRACTS.weth, asset, route.v3Fee],
  })
  if (sameAddress(pool, zeroAddress)) throw new Error('The selected V3 pool does not exist')

  const poolAddress = getAddress(pool)
  const [slot0, liquidity] = await Promise.all([
    client.readContract({ address: poolAddress, abi: v3PoolValidationAbi, functionName: 'slot0' }),
    client.readContract({ address: poolAddress, abi: v3PoolValidationAbi, functionName: 'liquidity' }),
  ])
  if (slot0[0] === 0n) throw new Error('The selected V3 pool is not initialized')
  if (liquidity === 0n) throw new Error('The selected V3 pool has no active liquidity')

  try {
    await client.readContract({
      address: poolAddress,
      abi: v3PoolValidationAbi,
      functionName: 'observe',
      args: [[V3_TWAP_WINDOW_SECONDS, 0]],
    })
  } catch {
    throw new Error('The selected V3 pool does not have the required 5-minute price history yet')
  }
}

/** Mirrors the deployed BasketToken constructor's venue-specific route checks. */
export const assertBasketRouteUsable = async (route: BasketLegRoute, asset: Address): Promise<void> => {
  if (route.venue === 0) return assertV4RouteUsable(route, asset)
  if (route.venue === 1) return assertV3RouteUsable(route, asset)
  if (route.venue === 2 && sameAddress(asset, BASKET_CONTRACTS.weth)) return
  throw new Error('The selected route is not compatible with this Basket constituent')
}
