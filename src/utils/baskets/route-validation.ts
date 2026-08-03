import { encodeAbiParameters, getAddress, keccak256, parseAbi, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, toContractPoolKey, type BasketPoolKey } from '@/config/baskets'
import { getRhV4PoolLiquidity, getRhV4PoolState } from '@/utils/rhV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { basketRegistryAbi, pancakePoolManagerStateAbi } from './abis'
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
export const getBasketV4PoolId = (pool: BasketPoolKey, chainId = 4663): `0x${string}` => chainId === 56
  ? keccak256(encodeAbiParameters([{
      type: 'tuple', components: [
        { type: 'address', name: 'currency0' }, { type: 'address', name: 'currency1' },
        { type: 'address', name: 'hooks' }, { type: 'address', name: 'poolManager' },
        { type: 'uint24', name: 'fee' }, { type: 'bytes32', name: 'parameters' },
      ],
    }], [toContractPoolKey(pool, chainId) as any]))
  : keccak256(encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks],
  ))

const assertV4RouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number) => {
  const deployment = getBasketDeployment(chainId)
  const pool = route.v4Pool
  const quote = chainId === 56 && route.quoteToken === 1
    ? deployment.contracts.settlementToken
    : zeroAddress
  const direct = (sameAddress(pool.currency0, quote) && sameAddress(pool.currency1, asset)) ||
    (sameAddress(pool.currency0, asset) && sameAddress(pool.currency1, quote))
  if (!direct) {
    const quoteLabel = chainId === 56 && route.quoteToken === 1
      ? deployment.settlementSymbol
      : deployment.nativeSymbol
    throw new Error(`The selected V4 pool is not a direct ${quoteLabel} route for this asset`)
  }
  if (chainId === 56 && (!pool.poolManager || !sameAddress(pool.poolManager, deployment.contracts.poolManager))) {
    throw new Error('The selected V4 pool uses an unsupported PoolManager')
  }

  const client = getReadOnlyClient(chainId)
  const poolId = getBasketV4PoolId(pool, chainId)
  const hookTrustPromise = sameAddress(pool.hooks, zeroAddress)
    ? Promise.resolve(true)
    : client.readContract({
        address: deployment.contracts.registry,
        abi: basketRegistryAbi,
        functionName: 'trustedConstituentHooks',
        args: [pool.hooks],
      })
  const [state, liquidity, trustedHook] = await Promise.all([
    chainId === 56
      ? client.readContract({ address: deployment.contracts.poolManager, abi: pancakePoolManagerStateAbi, functionName: 'getSlot0', args: [poolId] })
          .then((row) => ({ sqrtPriceX96: row[0] }))
      : getRhV4PoolState(poolId),
    chainId === 56
      ? client.readContract({ address: deployment.contracts.poolManager, abi: pancakePoolManagerStateAbi, functionName: 'getLiquidity', args: [poolId] })
      : getRhV4PoolLiquidity(poolId),
    hookTrustPromise,
  ])

  if (state.sqrtPriceX96 === 0n) throw new Error('The selected V4 pool is not initialized')
  if (liquidity === 0n) throw new Error('The selected V4 pool has no active liquidity')
  if (!trustedHook) throw new Error('The selected V4 pool hook is not approved for Basket constituents')
}

const assertV3RouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number) => {
  const deployment = getBasketDeployment(chainId)
  if (!Number.isInteger(route.v3Fee) || route.v3Fee <= 0) {
    throw new Error('The selected V3 route has an invalid fee tier')
  }

  const client = getReadOnlyClient(chainId)
  const factory = await client.readContract({
    address: deployment.contracts.rebalanceExecutor,
    abi: rebalanceExecutorRouteAbi,
    functionName: 'v3Factory',
  })
  if (sameAddress(factory, zeroAddress)) throw new Error('V3 Basket routes are not configured')

  const quote = chainId === 56 && route.quoteToken === 1
    ? deployment.contracts.settlementToken
    : deployment.contracts.wrappedNative
  const pool = await client.readContract({
    address: factory,
    abi: v3FactoryAbi,
    functionName: 'getPool',
    args: [quote, asset, route.v3Fee],
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
export const assertBasketRouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number): Promise<void> => {
  const deployment = getBasketDeployment(chainId)
  if (route.venue === 0) return assertV4RouteUsable(route, asset, chainId)
  if (route.venue === 1) return assertV3RouteUsable(route, asset, chainId)
  if (route.venue === 2 && sameAddress(asset, deployment.contracts.wrappedNative)) return
  throw new Error('The selected route is not compatible with this Basket constituent')
}
