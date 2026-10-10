import { encodeAbiParameters, getAddress, keccak256, parseAbi, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, getBasketProtocol, toContractPoolKey, type BasketPoolKey } from '@/config/baskets'
import { decodeSlot0, liquiditySlot, stateSlot } from '@/utils/v14/uniswap-state'
import { readBasketBatch } from './read-batch'
import { getReadOnlyClient } from '@/utils/wallets'
import { basketRegistryAbi, pancakePoolManagerStateAbi } from './abis'
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

type RouteInput = { route: BasketLegRoute; asset: Address; poolId?: string }
const extsloadAbi = parseAbi(['function extsload(bytes32 slot) view returns (bytes32)'])
const bridgeAbi = parseAbi(['function validateRoute(address tokenIn,address tokenOut) view'])

/** Mirrors the deployed constructor. Invalid pools are isolated for discovery;
 * callers creating a Basket require every leg to pass. */
export async function validateBasketRoutes(
  legs: RouteInput[], chainId: number, blockNumber?: bigint,
): Promise<(BasketPoolValidationError | null)[]> {
  const deployment = getBasketDeployment(chainId)
  const version = deployment.creationVersion
  const protocol = getBasketProtocol(chainId, version)
  const fixedBlock = blockNumber ?? await getReadOnlyClient(chainId).getBlockNumber()
  const errors: (BasketPoolValidationError | null)[] = legs.map(() => null)
  const fail = (i: number, issue: string, params: BasketPoolIssueParams = {}) => {
    errors[i] ??= new BasketPoolValidationError(issue, params)
  }
  const stage: { call: any; i: number; apply: (value: any) => void; issue: string }[] = []
  const pools = new Map<number, Address>()
  const add = (i: number, call: any, apply: (value: any) => void, issue = 'validationFailed') => stage.push({ call, i, apply, issue })
  for (const [i, { route, asset, poolId }] of legs.entries()) {
    const quote = route.poolQuoteToken
    if (!quote) { fail(i, 'quoteTokenUnavailable'); continue }
    if (route.venue === 0) {
      const pool = route.v4Pool
      if (!((sameAddress(pool.currency0, quote) && sameAddress(pool.currency1, asset)) ||
        (sameAddress(pool.currency1, quote) && sameAddress(pool.currency0, asset)))) {
        fail(i, 'directRouteRequired', { venue: 'V4', quotes: quote }); continue
      }
      if (chainId === 56 && (!pool.poolManager || !sameAddress(pool.poolManager, protocol.poolManager))) {
        fail(i, 'unsupportedPoolManager'); continue
      }
      const id = getBasketV4PoolId(pool, chainId)
      add(i, chainId === 56
        ? { address: protocol.poolManager, abi: pancakePoolManagerStateAbi, functionName: 'getSlot0', args: [id] }
        : { address: protocol.poolManager, abi: extsloadAbi, functionName: 'extsload', args: [stateSlot(id)] },
        value => { if ((chainId === 56 ? value[0] : decodeSlot0(value)[0]) === 0n) fail(i, 'uninitialized', { venue: 'V4' }) })
      add(i, chainId === 56
        ? { address: protocol.poolManager, abi: pancakePoolManagerStateAbi, functionName: 'getLiquidity', args: [id] }
        : { address: protocol.poolManager, abi: extsloadAbi, functionName: 'extsload', args: [liquiditySlot(id)] },
        value => { if (BigInt(value) === 0n) fail(i, 'noLiquidity', { venue: 'V4' }) })
      if (!sameAddress(pool.hooks, zeroAddress)) add(i,
        { address: protocol.registry, abi: basketRegistryAbi, functionName: 'trustedConstituentHooks', args: [pool.hooks] },
        value => { if (!value) fail(i, 'hookNotApproved') }, 'hookNotApproved')
    } else if (route.venue === 1) {
      if (!protocol.v3Factory || sameAddress(quote, zeroAddress)) { fail(i, 'v3NotConfigured'); continue }
      if (!Number.isInteger(route.v3Fee) || route.v3Fee <= 0 || route.v3Fee >= 1_000_000) { fail(i, 'invalidFee'); continue }
      add(i, { address: protocol.v3Factory, abi: v3FactoryAbi, functionName: 'getPool', args: [quote, asset, route.v3Fee] },
        value => { if (sameAddress(value, zeroAddress)) fail(i, 'poolNotFound', { venue: 'V3' }); else if (poolId && !sameAddress(value, poolId)) fail(i, 'unsupportedFactory'); else pools.set(i, getAddress(value)) })
    } else if (route.venue === 3) {
      if (!protocol.v2Factory || sameAddress(quote, zeroAddress)) { fail(i, 'routeIncompatible'); continue }
      add(i, { address: protocol.v2Factory, abi: v2FactoryAbi, functionName: 'getPair', args: [quote, asset] },
        value => { if (sameAddress(value, zeroAddress)) fail(i, 'poolNotFound', { venue: 'V2' }); else if (poolId && !sameAddress(value, poolId)) fail(i, 'unsupportedFactory'); else pools.set(i, getAddress(value)) })
    } else if (route.venue !== 2 || !sameAddress(asset, protocol.wrappedNative) || !sameAddress(quote, asset)) {
      fail(i, 'routeIncompatible'); continue
    }
    if (!sameAddress(quote, protocol.settlementToken)) {
      if (!protocol.nutboxRouter) { fail(i, 'nutboxRouteUnavailable'); continue }
      for (const [from, to] of [[quote, protocol.settlementToken], [protocol.settlementToken, quote]]) add(i,
        { address: protocol.nutboxRouter, abi: bridgeAbi, functionName: 'validateRoute', args: [from, to] },
        () => {}, 'nutboxRouteUnavailable')
    }
  }
  const run = async () => {
    const rows = await readBasketBatch(stage.map(item => item.call), chainId, fixedBlock, true)
    for (const [j, item] of stage.entries()) {
      if (!rows[j] || rows[j].status !== 'success') fail(item.i, item.issue)
      else item.apply(rows[j].result)
    }
    stage.length = 0
  }
  await run()
  for (const [i, address] of pools) {
    if (errors[i]) continue
    const route = legs[i].route
    if (route.venue === 1) {
      add(i, { address, abi: v3PoolValidationAbi, functionName: 'slot0' }, value => { if (value[0] === 0n) fail(i, 'uninitialized', { venue: 'V3' }) })
      add(i, { address, abi: v3PoolValidationAbi, functionName: 'liquidity' }, value => { if (value === 0n) fail(i, 'noLiquidity', { venue: 'V3' }) })
      // V3 Basket uses live spot, matching its constructor; historical V1 used TWAP.
      if (chainId === 4663 && version < 3) add(i, { address, abi: v3PoolValidationAbi, functionName: 'observe', args: [[V3_TWAP_WINDOW_SECONDS, 0]] }, () => {}, 'twapUnavailable')
    } else add(i, { address, abi: v2PairValidationAbi, functionName: 'getReserves' }, value => { if (value[0] === 0n || value[1] === 0n) fail(i, 'noLiquidity', { venue: 'V2' }) })
  }
  await run()
  return errors
}

export async function assertBasketRoutesUsable(legs: RouteInput[], chainId: number, blockNumber?: bigint): Promise<void> {
  const errors = await validateBasketRoutes(legs, chainId, blockNumber)
  const first = errors.find(error => error !== null)
  if (first) throw first
}

export const assertBasketRouteUsable = (route: BasketLegRoute, asset: Address, chainId: number, blockNumber?: bigint): Promise<void> =>
  assertBasketRoutesUsable([{ route, asset }], chainId, blockNumber)
