import { encodeAbiParameters, getAddress, keccak256, parseAbi, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, getBasketProtocol, toContractPoolKey, type BasketPoolKey } from '@/config/baskets'
import { getRhV4PoolLiquidity, getRhV4PoolState } from '@/utils/rhV4Swap'
import { getReadOnlyClient } from '@/utils/wallets'
import { basketRegistryAbi, pancakePoolManagerStateAbi } from './abis'
import { validateNutboxRoute } from './bsc-v3-routing'
import type { BasketLegRoute } from './types'

const V3_TWAP_WINDOW_SECONDS = 300

export type BasketPoolIssueParams = Record<string, string | number>

export class BasketPoolValidationError extends Error {
  constructor(
    public readonly issue: string,
    public readonly params: BasketPoolIssueParams = {},
  ) {
    super(issue)
    this.name = 'BasketPoolValidationError'
  }
}

const failPoolValidation = (issue: string, params: BasketPoolIssueParams = {}): never => {
  throw new BasketPoolValidationError(issue, params)
}

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

const v2FactoryAbi = parseAbi(['function getPair(address tokenA,address tokenB) view returns (address pair)'])
const v2PairValidationAbi = parseAbi([
  'function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)',
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
  const quote = route.poolQuoteToken ?? (chainId === 56 ? zeroAddress : deployment.contracts.wrappedNative)
  const direct = (sameAddress(pool.currency0, quote) && sameAddress(pool.currency1, asset)) ||
    (sameAddress(pool.currency0, asset) && sameAddress(pool.currency1, quote))
  if (!direct) {
    const quoteLabel = quote
    failPoolValidation('directRouteRequired', { venue: 'V4', quotes: quoteLabel })
  }
  if (chainId === 56 && (!pool.poolManager || !sameAddress(pool.poolManager, deployment.contracts.poolManager))) {
    failPoolValidation('unsupportedPoolManager')
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

  if (state.sqrtPriceX96 === 0n) failPoolValidation('uninitialized', { venue: 'V4' })
  if (liquidity === 0n) failPoolValidation('noLiquidity', { venue: 'V4' })
  if (!trustedHook) failPoolValidation('hookNotApproved')
}

const assertV3RouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number) => {
  const deployment = getBasketDeployment(chainId)
  if (!Number.isInteger(route.v3Fee) || route.v3Fee <= 0) {
    failPoolValidation('invalidFee')
  }

  const client = getReadOnlyClient(chainId)
  const factory = await client.readContract({
    address: deployment.contracts.rebalanceExecutor,
    abi: rebalanceExecutorRouteAbi,
    functionName: 'v3Factory',
  })
  if (sameAddress(factory, zeroAddress)) failPoolValidation('v3NotConfigured')

  const quote = route.poolQuoteToken ?? (chainId === 56 ? zeroAddress : deployment.contracts.wrappedNative)
  const pool = await client.readContract({
    address: factory,
    abi: v3FactoryAbi,
    functionName: 'getPool',
    args: [quote, asset, route.v3Fee],
  })
  if (sameAddress(pool, zeroAddress)) failPoolValidation('poolNotFound', { venue: 'V3' })

  const poolAddress = getAddress(pool)
  const [slot0, liquidity] = await Promise.all([
    client.readContract({ address: poolAddress, abi: v3PoolValidationAbi, functionName: 'slot0' }),
    client.readContract({ address: poolAddress, abi: v3PoolValidationAbi, functionName: 'liquidity' }),
  ])
  if (slot0[0] === 0n) failPoolValidation('uninitialized', { venue: 'V3' })
  if (liquidity === 0n) failPoolValidation('noLiquidity', { venue: 'V3' })

  if (chainId !== 56) {
    try {
      await client.readContract({
        address: poolAddress,
        abi: v3PoolValidationAbi,
        functionName: 'observe',
        args: [[V3_TWAP_WINDOW_SECONDS, 0]],
      })
    } catch {
      failPoolValidation('twapUnavailable')
    }
  }
}

const assertV2RouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number) => {
  const protocol = getBasketProtocol(chainId, 3)
  const quote = route.poolQuoteToken ?? zeroAddress
  const factory = protocol.v2Factory
  if (sameAddress(quote, zeroAddress)) failPoolValidation('routeIncompatible')
  if (!factory) failPoolValidation('routeIncompatible')
  const v2Factory = factory as Address
  const client = getReadOnlyClient(chainId)
  const pair = await client.readContract({
    address: v2Factory,
    abi: v2FactoryAbi,
    functionName: 'getPair',
    args: [asset, quote],
  })
  if (sameAddress(pair, zeroAddress)) failPoolValidation('poolNotFound', { venue: 'V2' })
  const reserves = await client.readContract({
    address: getAddress(pair),
    abi: v2PairValidationAbi,
    functionName: 'getReserves',
  })
  if (reserves[0] === 0n || reserves[1] === 0n) failPoolValidation('noLiquidity', { venue: 'V2' })
}

const assertBscV3Bridge = async (route: BasketLegRoute, chainId: number) => {
  const protocol = getBasketProtocol(chainId, 3)
  if (!route.poolQuoteToken) failPoolValidation('quoteTokenUnavailable')
  const quote = route.poolQuoteToken as Address
  if (sameAddress(quote, protocol.settlementToken)) return
  try {
    await Promise.all([
      validateNutboxRoute(quote, protocol.settlementToken, chainId),
      validateNutboxRoute(protocol.settlementToken, quote, chainId),
    ])
  } catch {
    failPoolValidation('nutboxRouteUnavailable')
  }
}

/** Mirrors the deployed BasketToken constructor's venue-specific route checks. */
export const assertBasketRouteUsable = async (route: BasketLegRoute, asset: Address, chainId: number): Promise<void> => {
  const deployment = getBasketDeployment(chainId)
  if (route.venue === 0) await assertV4RouteUsable(route, asset, chainId)
  else if (route.venue === 1) await assertV3RouteUsable(route, asset, chainId)
  else if (route.venue === 2 && sameAddress(asset, deployment.contracts.wrappedNative)) {
    if (!sameAddress(route.poolQuoteToken ?? zeroAddress, deployment.contracts.wrappedNative)) {
      failPoolValidation('routeIncompatible')
    }
  } else if (route.venue === 3) await assertV2RouteUsable(route, asset, chainId)
  else failPoolValidation('routeIncompatible')
  await assertBscV3Bridge(route, chainId)
}
