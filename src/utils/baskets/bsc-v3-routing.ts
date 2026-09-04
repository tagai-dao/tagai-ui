import {
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { getBasketDeployment, getBasketProtocol, toContractPoolKey, type BasketPoolKey } from '@/config/baskets'
import { getChainDeployment } from '@/config/chains'
import { getReadOnlyClient } from '@/utils/wallets'
import { pancakePoolManagerStateAbi, pancakeV4QuoterAbi, v3QuoterAbi, v4QuoterAbi } from './abis'
import { getPoolQuoteToken } from './routes'
import type { BasketLegRoute } from './types'

const nutboxRouterAbi = parseAbi([
  'function validateRoute(address tokenIn,address tokenOut) view',
  'function quote(address tokenIn,address tokenOut,uint256 amountIn) view returns (uint256 amountOut)',
  'function routePoolCount(address tokenIn,address tokenOut) view returns (uint256)',
  'function routePoolAt(address tokenIn,address tokenOut,uint256 index) view returns (bytes32 poolId)',
  'function pricePool(bytes32 poolId) view returns (bool enabled,uint32 routeReferences,address token0,address token1,uint8 sourceType,bytes sourceData)',
])

const v2FactoryAbi = parseAbi(['function getPair(address tokenA,address tokenB) view returns (address pair)'])
const v2PairAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)',
])
const v3PoolMetaAbi = parseAbi(['function fee() view returns (uint24)'])

const BPS = 10_000
const PANCAKE_V2_FEE_BPS = 25
const DYNAMIC_FEE_FLAG = 0x800000

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const normalizeEndpoint = (token: Address, wrappedNative: Address): Address =>
  sameAddress(token, zeroAddress) ? wrappedNative : token

const poolId = (pool: BasketPoolKey): Hex => keccak256(encodeAbiParameters([{
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'hooks', type: 'address' },
    { name: 'poolManager', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'parameters', type: 'bytes32' },
  ],
}], [toContractPoolKey(pool, 56) as any]))

const quoteV4ExactInput = async (
  pool: BasketPoolKey,
  tokenIn: Address,
  amountIn: bigint,
  chainId = 56,
): Promise<bigint> => {
  const { result } = await getReadOnlyClient(chainId).simulateContract({
    address: getChainDeployment(chainId).dex.v4Quoter,
    abi: chainId === 56 ? pancakeV4QuoterAbi : v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      poolKey: toContractPoolKey(pool, chainId),
      zeroForOne: sameAddress(pool.currency0, tokenIn),
      exactAmount: amountIn,
      hookData: '0x',
    }],
  } as any)
  return typeof result === 'bigint' ? result : result[0]
}

const quoteV3ExactInput = async (
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
  chainId = 56,
): Promise<bigint> => {
  const deployment = getBasketDeployment(chainId)
  const { result } = await getReadOnlyClient(chainId).simulateContract({
    address: deployment.v3Quoter,
    abi: v3QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
  })
  return result[0]
}

const quoteV2ExactInput = async (
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  factory: Address,
  expectedPair?: Address,
  chainId = 56,
): Promise<bigint> => {
  const client = getReadOnlyClient(chainId)
  const pair = await client.readContract({
    address: factory,
    abi: v2FactoryAbi,
    functionName: 'getPair',
    args: [tokenIn, tokenOut],
  })
  if (sameAddress(pair, zeroAddress) || (expectedPair && !sameAddress(pair, expectedPair))) {
    throw new Error('Pancake V2 route is unavailable')
  }
  const [token0, reserves] = await Promise.all([
    client.readContract({ address: pair, abi: v2PairAbi, functionName: 'token0' }),
    client.readContract({ address: pair, abi: v2PairAbi, functionName: 'getReserves' }),
  ])
  const zeroForOne = sameAddress(token0, tokenIn)
  const reserveIn = BigInt(zeroForOne ? reserves[0] : reserves[1])
  const reserveOut = BigInt(zeroForOne ? reserves[1] : reserves[0])
  if (reserveIn === 0n || reserveOut === 0n) throw new Error('Pancake V2 route has no liquidity')
  const amountInWithFee = amountIn * BigInt(BPS - (chainId === 56 ? PANCAKE_V2_FEE_BPS : 30))
  return amountInWithFee * reserveOut / (reserveIn * BigInt(BPS) + amountInWithFee)
}

type NutboxPool = {
  token0: Address
  token1: Address
  sourceType: number
  sourceData: Hex
}

const readNutboxPools = async (tokenIn: Address, tokenOut: Address, chainId = 56): Promise<NutboxPool[]> => {
  const protocol = getBasketProtocol(chainId, 3)
  if (!protocol.nutboxRouter) throw new Error('NutboxRouter is not configured')
  const client = getReadOnlyClient(chainId)
  const count = Number(await client.readContract({
    address: protocol.nutboxRouter,
    abi: nutboxRouterAbi,
    functionName: 'routePoolCount',
    args: [tokenIn, tokenOut],
  }))
  if (!count) throw new Error('Nutbox route is unavailable')
  const ids = await Promise.all(Array.from({ length: count }, (_, index) => client.readContract({
    address: protocol.nutboxRouter!,
    abi: nutboxRouterAbi,
    functionName: 'routePoolAt',
    args: [tokenIn, tokenOut, BigInt(index)],
  })))
  return Promise.all(ids.map(async (id) => {
    const row = await client.readContract({
      address: protocol.nutboxRouter!,
      abi: nutboxRouterAbi,
      functionName: 'pricePool',
      args: [id],
    })
    if (!row[0]) throw new Error('Nutbox route pool is disabled')
    return {
      token0: getAddress(row[2]),
      token1: getAddress(row[3]),
      sourceType: Number(row[4]),
      sourceData: row[5],
    }
  }))
}

const nextRouteToken = (
  current: Address,
  pool: NutboxPool,
  wrappedNative: Address,
): Address => {
  const token0 = normalizeEndpoint(pool.token0, wrappedNative)
  const token1 = normalizeEndpoint(pool.token1, wrappedNative)
  if (sameAddress(current, token0)) return token1
  if (sameAddress(current, token1)) return token0
  throw new Error('Nutbox route is disconnected')
}

const decodePancakeV4Source = (data: Hex) => decodeAbiParameters([{
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'hooks', type: 'address' },
    { name: 'poolManager', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'parameters', type: 'bytes32' },
  ],
}], data)[0]

export const validateNutboxRoute = async (tokenIn: Address, tokenOut: Address, chainId = 56): Promise<void> => {
  if (sameAddress(tokenIn, tokenOut)) return
  const router = getBasketProtocol(chainId, 3).nutboxRouter
  if (!router) throw new Error('NutboxRouter is not configured')
  await getReadOnlyClient(chainId).readContract({
    address: router,
    abi: nutboxRouterAbi,
    functionName: 'validateRoute',
    args: [tokenIn, tokenOut],
  })
}

export const quoteNutboxExactInput = async (
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  chainId = 56,
): Promise<bigint> => {
  if (sameAddress(tokenIn, tokenOut)) return amountIn
  const deployment = getBasketDeployment(chainId)
  const protocol = getBasketProtocol(chainId, 3)
  const pools = await readNutboxPools(tokenIn, tokenOut, chainId)
  let current = normalizeEndpoint(tokenIn, protocol.wrappedNative)
  let amount = amountIn
  for (const pool of pools) {
    const next = nextRouteToken(current, pool, protocol.wrappedNative)
    if (pool.sourceType === 0) {
      const [factory, pair] = decodeAbiParameters([{ type: 'address' }, { type: 'address' }], pool.sourceData)
      amount = await quoteV2ExactInput(current, next, amount, factory, pair, chainId)
    } else if (pool.sourceType === 1) {
      const [, v3Pool] = decodeAbiParameters([{ type: 'address' }, { type: 'address' }], pool.sourceData)
      const fee = await getReadOnlyClient(chainId).readContract({
        address: v3Pool,
        abi: v3PoolMetaAbi,
        functionName: 'fee',
      })
      amount = await quoteV3ExactInput(current, next, amount, Number(fee), chainId)
    } else if (pool.sourceType === 2) {
      const [source] = decodeAbiParameters([{
        type: 'tuple', components: [
          { name: 'poolManager', type: 'address' }, { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
        ],
      }], pool.sourceData)
      const sourcePool: BasketPoolKey = {
        currency0: source.currency0, currency1: source.currency1, fee: Number(source.fee),
        tickSpacing: Number(source.tickSpacing), hooks: source.hooks,
      }
      const actualInput = sameAddress(normalizeEndpoint(source.currency0, protocol.wrappedNative), current)
        ? source.currency0 : source.currency1
      amount = await quoteV4ExactInput(sourcePool, actualInput, amount, chainId)
    } else if (pool.sourceType === 3) {
      const source = decodePancakeV4Source(pool.sourceData)
      const sourcePool: BasketPoolKey = {
        currency0: source.currency0,
        currency1: source.currency1,
        hooks: source.hooks,
        poolManager: source.poolManager,
        fee: Number(source.fee),
        parameters: source.parameters,
        tickSpacing: 0,
      }
      const actualInput = sameAddress(normalizeEndpoint(source.currency0, protocol.wrappedNative), current)
        ? source.currency0
        : source.currency1
      amount = await quoteV4ExactInput(sourcePool, actualInput, amount, chainId)
    } else {
      // No Uniswap V4 quoter is configured on BSC. Reject instead of creating
      // an unsafe minOut from a fee-free spot quote.
      throw new Error('This Nutbox route source cannot be execution-quoted')
    }
    current = next
  }
  if (!sameAddress(current, normalizeEndpoint(tokenOut, protocol.wrappedNative))) {
    throw new Error('Nutbox route output does not match the requested token')
  }
  // Keep the deployment read in this path so a malformed cross-chain config
  // cannot silently quote against a foreign settlement token.
  if (!sameAddress(deployment.contracts.settlementToken, protocol.settlementToken)) {
    throw new Error('Basket settlement configuration mismatch')
  }
  return amount
}

const quoteDirect = async (
  route: BasketLegRoute,
  asset: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  chainId = 56,
): Promise<bigint> => {
  const protocol = getBasketProtocol(chainId, 3)
  if (route.venue === 0) return quoteV4ExactInput(route.v4Pool, tokenIn, amountIn, chainId)
  if (route.venue === 1) return quoteV3ExactInput(tokenIn, tokenOut, amountIn, route.v3Fee, chainId)
  if (route.venue === 2) {
    if (!sameAddress(asset, protocol.wrappedNative)) throw new Error('Invalid WBNB constituent route')
    return amountIn
  }
  if (route.venue === 3) {
    if (!protocol.v2Factory) throw new Error('Pancake V2 is not configured')
    return quoteV2ExactInput(tokenIn, tokenOut, amountIn, protocol.v2Factory, undefined, chainId)
  }
  throw new Error('Unsupported Basket constituent venue')
}

export const quoteBscV3SettlementToAsset = async (
  route: BasketLegRoute,
  asset: Address,
  settlementIn: bigint,
  chainId = 56,
): Promise<bigint> => {
  const protocol = getBasketProtocol(chainId, 3)
  const poolQuote = getPoolQuoteToken(route, chainId, 3)
  const directIn = sameAddress(poolQuote, protocol.settlementToken)
    ? settlementIn
    : await quoteNutboxExactInput(protocol.settlementToken, poolQuote, settlementIn, chainId)
  return quoteDirect(route, asset, poolQuote, asset, directIn, chainId)
}

export const quoteBscV3AssetToSettlement = async (
  route: BasketLegRoute,
  asset: Address,
  assetIn: bigint,
  chainId = 56,
): Promise<bigint> => {
  const protocol = getBasketProtocol(chainId, 3)
  const poolQuote = getPoolQuoteToken(route, chainId, 3)
  const directOut = await quoteDirect(route, asset, asset, poolQuote, assetIn, chainId)
  return sameAddress(poolQuote, protocol.settlementToken)
    ? directOut
    : quoteNutboxExactInput(poolQuote, protocol.settlementToken, directOut, chainId)
}

const currentInfinityFeeBps = async (pool: BasketPoolKey): Promise<number> => {
  const raw = await getReadOnlyClient(56).readContract({
    address: pool.poolManager!,
    abi: pancakePoolManagerStateAbi,
    functionName: 'getSlot0',
    args: [poolId(pool)],
  })
  const fee = pool.fee === DYNAMIC_FEE_FLAG ? Number(raw[3]) : pool.fee
  return Math.ceil(fee / 100)
}

const nutboxRouteFeeBps = async (tokenIn: Address, tokenOut: Address): Promise<number[]> => {
  if (sameAddress(tokenIn, tokenOut)) return []
  const pools = await readNutboxPools(tokenIn, tokenOut)
  const fees: number[] = []
  for (const pool of pools) {
    if (pool.sourceType === 0) fees.push(PANCAKE_V2_FEE_BPS)
    else if (pool.sourceType === 1) {
      const [, v3Pool] = decodeAbiParameters([{ type: 'address' }, { type: 'address' }], pool.sourceData)
      const fee = await getReadOnlyClient(56).readContract({ address: v3Pool, abi: v3PoolMetaAbi, functionName: 'fee' })
      fees.push(Math.ceil(Number(fee) / 100))
    } else if (pool.sourceType === 3) {
      const source = decodePancakeV4Source(pool.sourceData)
      fees.push(await currentInfinityFeeBps({
        currency0: source.currency0,
        currency1: source.currency1,
        hooks: source.hooks,
        poolManager: source.poolManager,
        fee: Number(source.fee),
        parameters: source.parameters,
        tickSpacing: 0,
      }))
    } else {
      throw new Error('This Nutbox route fee cannot be determined')
    }
  }
  return fees
}

/** Static fallback used only when a swap omits explicit aggregate hookData limits. */
export const getBscV3DefaultExecutionLossBps = async (
  route: BasketLegRoute,
  userSlippageBps = 100,
  chainId = 56,
): Promise<number> => {
  const protocol = getBasketProtocol(chainId, 3)
  const poolQuote = getPoolQuoteToken(route, chainId, 3)
  const directFee = route.venue === 0
    ? chainId === 56 ? await currentInfinityFeeBps(route.v4Pool) : Math.ceil(route.v4Pool.fee / 100)
    : route.venue === 1 ? Math.ceil(route.v3Fee / 100) : route.venue === 3 ? (chainId === 56 ? PANCAKE_V2_FEE_BPS : 30) : 0
  const bridgeFees = sameAddress(poolQuote, protocol.settlementToken)
    ? []
    : chainId === 56
      ? await nutboxRouteFeeBps(protocol.settlementToken, poolQuote)
      : [userSlippageBps]
  let remaining = BigInt(BPS)
  for (const fee of [directFee, ...bridgeFees, userSlippageBps]) {
    remaining = remaining * BigInt(Math.max(0, BPS - fee)) / BigInt(BPS)
  }
  const rawLoss = BPS - Number(remaining)
  return Math.min(9_900, Math.ceil(rawLoss / 25) * 25)
}
