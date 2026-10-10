import { decodeAbiParameters, getAddress, zeroAddress, type Address } from 'viem'
import { getBasketDeployment, getBasketProtocol, toContractPoolKey, type BasketPoolKey } from '@/config/baskets'
import { getChainDeployment, ROBINHOOD_TIPTAG_HOOK_FEE_PIPS } from '@/config/chains'
import { getReadOnlyClient } from '@/utils/wallets'
import { pancakeV4QuoterAbi, v3QuoterAbi, v4QuoterAbi, pancakePoolManagerStateAbi } from './abis'
import { parseAbi } from 'viem'
import { getPoolQuoteToken } from './routes'
import { readBasketBatch } from './read-batch'
import { getBasketV4PoolId } from './route-validation'
import { decodeSlot0, stateSlot } from '@/utils/v14/uniswap-state'
import type { BasketLegRoute } from './types'

const bridgeAbi = parseAbi([
  'function routePoolCount(address,address) view returns (uint256)',
  'function routePoolAt(address,address,uint256) view returns (bytes32)',
  'function pricePool(bytes32) view returns (bool,uint32,address,address,uint8,bytes)',
])
const poolAbi = parseAbi(['function fee() view returns (uint24)', 'function token0() view returns (address)', 'function getReserves() view returns (uint112,uint112,uint32)'])
const factoryAbi = parseAbi(['function getPair(address,address) view returns (address)'])
const extsloadAbi = parseAbi(['function extsload(bytes32) view returns (bytes32)'])
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
type Hop = { venue: number; pool?: BasketPoolKey; fee?: number; pair?: Address; factory?: Address; token0: Address; token1: Address }
type Request = { tokenIn: Address; tokenOut: Address; amount: bigint }
type Leg = { route: BasketLegRoute; asset: Address; amount: bigint }

const sourceHop = (source: any): Hop => {
  if (!source[0]) throw new Error('Nutbox route pool is disabled')
  const [token0, token1, kind, data] = [source[2], source[3], Number(source[4]), source[5]]
  if (kind === 0 || kind === 1) {
    const [factory, pair] = decodeAbiParameters([{ type: 'address' }, { type: 'address' }], data)
    return { venue: kind === 0 ? 3 : 1, factory, pair, token0, token1 }
  }
  if (kind === 2) {
    const [key] = decodeAbiParameters([{ type: 'tuple', components: [
      { name: 'poolManager', type: 'address' }, { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
    ] }], data)
    return { venue: 0, token0: key.currency0, token1: key.currency1, pool: key }
  }
  if (kind === 3) {
    const [key] = decodeAbiParameters([{ type: 'tuple', components: [
      { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'hooks', type: 'address' },
      { name: 'poolManager', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'parameters', type: 'bytes32' },
    ] }], data)
    return { venue: 0, token0: key.currency0, token1: key.currency1, pool: { ...key, tickSpacing: 0 } }
  }
  throw new Error('Unsupported Nutbox route source')
}

async function bridgePaths(requests: Request[], chainId: number, version: number, block: bigint): Promise<Hop[][]> {
  const protocol = getBasketProtocol(chainId, version)
  const paths: Hop[][] = requests.map(() => [])
  const active = requests.map((request, index) => ({ ...request, index })).filter(r => !same(r.tokenIn, r.tokenOut))
  if (!active.length) return paths
  if (!protocol.nutboxRouter) throw new Error('NutboxRouter is not configured')
  const counts = await readBasketBatch(active.map(r => ({ address: protocol.nutboxRouter!, abi: bridgeAbi, functionName: 'routePoolCount', args: [r.tokenIn, r.tokenOut] })), chainId, block)
  if (counts.some(count => count < 1n || count > 8n)) throw new Error('Nutbox route is unavailable')
  const indexes = active.flatMap((r, i) => Array.from({ length: Number(counts[i]) }, (_, hop) => ({ ...r, hop })))
  const ids = await readBasketBatch(indexes.map(r => ({ address: protocol.nutboxRouter!, abi: bridgeAbi, functionName: 'routePoolAt', args: [r.tokenIn, r.tokenOut, BigInt(r.hop)] })), chainId, block)
  const sources = await readBasketBatch(ids.map(id => ({ address: protocol.nutboxRouter!, abi: bridgeAbi, functionName: 'pricePool', args: [id] })), chainId, block)
  sources.forEach((source, i) => paths[indexes[i].index].push(sourceHop(source)))
  for (const path of paths) for (const hop of path) {
    if (hop.venue === 0 && !same(hop.pool!.poolManager ?? protocol.poolManager, protocol.poolManager)) throw new Error('Unsupported pool manager')
    if (hop.venue === 1 && (!protocol.v3Factory || !same(hop.factory!, protocol.v3Factory))) throw new Error('Unsupported V3 factory')
    if (hop.venue === 3 && (!protocol.v2Factory || !same(hop.factory!, protocol.v2Factory))) throw new Error('Unsupported V2 factory')
  }
  return paths
}

async function quotePaths(requests: Request[], paths: Hop[][], chainId: number, block: bigint): Promise<bigint[]> {
  const deployment = getBasketDeployment(chainId)
  const normalize = (token: Address) => same(token, zeroAddress) ? deployment.contracts.wrappedNative : token
  const current = requests.map(r => normalize(r.tokenIn))
  const amounts = requests.map(r => r.amount)
  for (let stage = 0; stage < Math.max(0, ...paths.map(path => path.length)); stage++) {
    const active = paths.flatMap((path, i) => path[stage] ? [{ i, hop: path[stage], tokenIn: zeroAddress as Address, tokenOut: zeroAddress as Address }] : [])
    for (const item of active) {
      const { hop, i } = item
      if (same(current[i], normalize(hop.token0))) [item.tokenIn, item.tokenOut] = [hop.token0, hop.token1]
      else if (same(current[i], normalize(hop.token1))) [item.tokenIn, item.tokenOut] = [hop.token1, hop.token0]
      else throw new Error('Nutbox route is disconnected')
      // V2/V3 operate on ERC20 WETH/WBNB; only V4 accepts native currency.
      if (hop.venue !== 0) { item.tokenIn = normalize(item.tokenIn); item.tokenOut = normalize(item.tokenOut) }
    }
    const feeReads = active.filter(a => a.hop.venue === 1 && a.hop.fee === undefined)
    const fees = await readBasketBatch(feeReads.map(a => ({ address: a.hop.pair!, abi: poolAbi, functionName: 'fee' })), chainId, block)
    feeReads.forEach((a, i) => { a.hop.fee = Number(fees[i]) })
    const v2 = active.filter(a => a.hop.venue === 3)
    const pairs = await readBasketBatch(v2.map(a => ({ address: a.hop.factory!, abi: factoryAbi, functionName: 'getPair', args: [a.tokenIn, a.tokenOut] })), chainId, block)
    pairs.forEach((pair, i) => {
      if (same(pair, zeroAddress) || (v2[i].hop.pair && !same(pair, v2[i].hop.pair!))) throw new Error('V2 route is unavailable')
      v2[i].hop.pair = getAddress(pair)
    })
    const reserves = await readBasketBatch(v2.flatMap(a => ['token0', 'getReserves'].map(functionName => ({ address: a.hop.pair!, abi: poolAbi, functionName }))), chainId, block)
    v2.forEach((a, i) => {
      const [token0, row] = reserves.slice(i * 2, i * 2 + 2)
      const [reserveIn, reserveOut] = same(token0, a.tokenIn) ? [row[0], row[1]] : [row[1], row[0]]
      if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('V2 route has no liquidity')
      const net = amounts[a.i] * BigInt(10_000 - (chainId === 56 ? 25 : 30))
      amounts[a.i] = net * reserveOut / (reserveIn * 10_000n + net)
    })
    const quoted = active.filter(a => a.hop.venue !== 3)
    const results = await readBasketBatch(quoted.map(a => a.hop.venue === 0 ? {
      address: getChainDeployment(chainId).dex.v4Quoter,
      abi: chainId === 56 ? pancakeV4QuoterAbi : v4QuoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ poolKey: toContractPoolKey(a.hop.pool!, chainId), zeroForOne: same(a.hop.pool!.currency0, a.tokenIn), exactAmount: amounts[a.i], hookData: '0x' }],
    } : {
      address: deployment.v3Quoter, abi: v3QuoterAbi, functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: a.tokenIn, tokenOut: a.tokenOut, amountIn: amounts[a.i], fee: a.hop.fee!, sqrtPriceLimitX96: 0n }],
    }), chainId, block)
    quoted.forEach((a, i) => { amounts[a.i] = typeof results[i] === 'bigint' ? results[i] : results[i][0] })
    active.forEach(a => { current[a.i] = normalize(a.tokenOut) })
  }
  if (current.some((token, i) => !same(token, normalize(requests[i].tokenOut)))) throw new Error('Route output does not match requested token')
  return amounts
}

const directPath = (leg: Leg, chainId: number, version: number): Hop[] => {
  const protocol = getBasketProtocol(chainId, version)
  const quote = getPoolQuoteToken(leg.route, chainId, version)
  if (leg.route.venue === 2) {
    if (!same(leg.asset, protocol.wrappedNative) || !same(quote, leg.asset)) throw new Error('Invalid wrapped-native constituent')
    return []
  }
  if (leg.route.venue === 0) return [{ venue: 0, pool: leg.route.v4Pool, token0: leg.route.v4Pool.currency0, token1: leg.route.v4Pool.currency1 }]
  return [{ venue: leg.route.venue, fee: leg.route.v3Fee, factory: leg.route.venue === 1 ? protocol.v3Factory : protocol.v2Factory, token0: quote, token1: leg.asset }]
}

export async function quoteBasketSettlementLegs(legs: Leg[], chainId: number, version = 3, blockNumber?: bigint): Promise<bigint[]> {
  const protocol = getBasketProtocol(chainId, version)
  const block = blockNumber ?? await getReadOnlyClient(chainId).getBlockNumber()
  const requests = legs.map(leg => ({ tokenIn: protocol.settlementToken, tokenOut: getPoolQuoteToken(leg.route, chainId, version), amount: leg.amount }))
  const bridges = await bridgePaths(requests, chainId, version, block)
  const directAmounts = await quotePaths(requests, bridges, chainId, block)
  return quotePaths(legs.map((leg, i) => ({ tokenIn: requests[i].tokenOut, tokenOut: leg.asset, amount: directAmounts[i] })), legs.map(leg => directPath(leg, chainId, version)), chainId, block)
}

export async function getBasketExecutionLosses(legs: Leg[], chainId: number, version = 3, userSlippageBps = 100, blockNumber?: bigint): Promise<number[]> {
  const protocol = getBasketProtocol(chainId, version)
  const block = blockNumber ?? await getReadOnlyClient(chainId).getBlockNumber()
  const requests = legs.map(leg => ({ tokenIn: protocol.settlementToken, tokenOut: getPoolQuoteToken(leg.route, chainId, version), amount: 0n }))
  const bridges = await bridgePaths(requests, chainId, version, block)
  const paths = bridges.map((path, i) => [...path, ...directPath(legs[i], chainId, version)])
  const all = paths.flat()
  const feeReads = all.filter(h => h.venue === 1 && h.fee === undefined)
  const fees = await readBasketBatch(feeReads.map(h => ({ address: h.pair!, abi: poolAbi, functionName: 'fee' })), chainId, block)
  feeReads.forEach((h, i) => { h.fee = Number(fees[i]) })
  const dynamic = all.filter(h => h.venue === 0 && h.pool!.fee === 0x800000)
  const values = await readBasketBatch(dynamic.map(h => chainId === 56
    ? { address: protocol.poolManager, abi: pancakePoolManagerStateAbi, functionName: 'getSlot0', args: [getBasketV4PoolId(h.pool!, chainId)] }
    : { address: protocol.poolManager, abi: extsloadAbi, functionName: 'extsload', args: [stateSlot(getBasketV4PoolId(h.pool!, chainId))] }), chainId, block)
  dynamic.forEach((h, i) => { h.fee = Number(chainId === 56 ? values[i][3] : decodeSlot0(values[i])[3]) })
  return paths.map(path => {
    let remaining = 10_000n
    const fees = path.map(h => h.venue === 0 && chainId === 4663 && same(h.pool!.hooks, getChainDeployment(4663).contracts.tipTagSwapHook9) ? Math.ceil(ROBINHOOD_TIPTAG_HOOK_FEE_PIPS / 100) : h.venue === 3 ? chainId === 56 ? 25 : 30 : Math.ceil((h.fee ?? h.pool?.fee ?? 0) / 100))
    for (const fee of [...fees, userSlippageBps]) remaining = remaining * BigInt(Math.max(0, 10_000 - fee)) / 10_000n
    return Math.min(9_900, Math.ceil((10_000 - Number(remaining)) / 25) * 25)
  })
}
