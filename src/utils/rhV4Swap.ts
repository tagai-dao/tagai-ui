import { encodeAbiParameters, isAddress, keccak256, parseAbiItem, zeroAddress } from 'viem'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { readContract, resolveContractAddress, writeContract } from './contract'
import { getReadOnlyClient } from './wallets'
import { sqrtPriceX96ToBnbPerToken } from './pcsV4Swap'

/** Uniswap v4 PoolKey; intentionally separate from Pancake Infinity PoolKey. */
export type RhV4PoolKey = {
  currency0: `0x${string}`
  currency1: `0x${string}`
  fee: number
  tickSpacing: number
  hooks: `0x${string}`
}

/**
 * Uniswap v4 PoolManager 没有 PCS 的 getSlot0(bytes32)。
 * 池状态在 mapping(PoolId => Pool)，StateLibrary.POOLS_SLOT = 6；
 * 用 extsload(keccak256(abi.encode(poolId, 6))) 读出 packed slot0。
 */
const RH_V4_POOLS_SLOT = 6n

const extsloadAbi = [{
  inputs: [{ name: 'slot', type: 'bytes32' }],
  name: 'extsload',
  outputs: [{ name: 'value', type: 'bytes32' }],
  stateMutability: 'view',
  type: 'function',
}] as const

export type RhV4Slot0 = {
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  lpFee: number
}

/** poolId → PoolManager 存储槽（与 Uniswap v4 StateLibrary 一致） */
export const getRhV4PoolStateSlot = (poolId: `0x${string}`): `0x${string}` =>
  keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }],
    [poolId, RH_V4_POOLS_SLOT],
  ))

/** 解包 slot0：sqrtPriceX96 | tick | protocolFee | lpFee */
export const decodeRhV4Slot0 = (word: bigint | string): RhV4Slot0 => {
  const w = typeof word === 'bigint' ? word : BigInt(word)
  const sqrtPriceX96 = w & ((1n << 160n) - 1n)
  let tick = Number((w >> 160n) & 0xffffffn)
  if (tick >= 0x800000) tick -= 0x1000000
  const protocolFee = Number((w >> 184n) & 0xffffffn)
  const lpFee = Number((w >> 208n) & 0xffffffn)
  return { sqrtPriceX96, tick, protocolFee, lpFee }
}

const requireRhV4PoolManager = () => {
  const deployment = useChainStore().deployment
  if (deployment.dex.kind !== 'uniswap') {
    throw new Error('RH V4 pool state called outside an Uniswap chain')
  }
  if (deployment.dex.v4PoolManager === zeroAddress) {
    throw new Error(`Uniswap V4 PoolManager is not configured on ${deployment.name}`)
  }
  return deployment
}

/** 读 RH Uniswap V4 池 slot0（extsload，非 getSlot0） */
export const getRhV4PoolState = async (poolId: `0x${string}`): Promise<RhV4Slot0> => {
  const deployment = requireRhV4PoolManager()
  const word = await getReadOnlyClient().readContract({
    address: deployment.dex.v4PoolManager,
    abi: extsloadAbi,
    functionName: 'extsload',
    args: [getRhV4PoolStateSlot(poolId)],
  })
  return decodeRhV4Slot0(word as `0x${string}`)
}

/** RH V4 现货价（原生币/Token），数学与 PCS 路径相同 */
export const getRhV4SpotPrice = async (poolId: `0x${string}`): Promise<number> => {
  const { sqrtPriceX96 } = await getRhV4PoolState(poolId)
  if (sqrtPriceX96 === 0n) return 0
  return sqrtPriceX96ToBnbPerToken(sqrtPriceX96)
}

/**
 * makerdao multicall 条目：用 extsload 取 sqrtPriceX96，
 * 供 getTokenOnchainInfo / 导入币批量补价复用。
 */
export const buildRhV4SqrtPriceMulticall = (
  poolManager: `0x${string}`,
  poolId: `0x${string}`,
  returnKey: string,
) => ({
  target: poolManager,
  call: ['extsload(bytes32)(bytes32)', getRhV4PoolStateSlot(poolId)],
  returns: [[returnKey, (val: any) => decodeRhV4Slot0(val).sqrtPriceX96]],
})

const isUint24 = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xffffff
const isInt24 = (value: number) => Number.isInteger(value) && value >= -0x800000 && value <= 0x7fffff

export const resolveRhV4PoolKey = (pair: string | null | undefined): RhV4PoolKey | null => {
  if (!pair?.trim().startsWith('{')) return null
  try {
    const value = JSON.parse(pair) as Partial<RhV4PoolKey>
    if (!value.currency0 || !value.currency1 || !value.hooks) return null
    if (!isAddress(value.currency0) || !isAddress(value.currency1) || !isAddress(value.hooks)) return null
    if (!isUint24(Number(value.fee)) || !isInt24(Number(value.tickSpacing))) return null
    return {
      currency0: value.currency0,
      currency1: value.currency1,
      fee: Number(value.fee),
      tickSpacing: Number(value.tickSpacing),
      hooks: value.hooks,
    }
  } catch {
    return null
  }
}

const initializeEvent = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
)

/** Standard Uniswap v4 stores the full PoolKey in Initialize logs, keyed by poolId. */
export const getRhV4PoolKeyByPoolId = async (poolId: `0x${string}`): Promise<RhV4PoolKey> => {
  const { deployment } = requireRhV4()
  const logs = await getReadOnlyClient().getLogs({
    address: deployment.dex.v4PoolManager,
    event: initializeEvent,
    args: { id: poolId },
    fromBlock: 0n,
    toBlock: 'latest',
    strict: true,
  })
  const args = logs.at(-1)?.args
  if (!args?.currency0 || !args.currency1 || args.fee === undefined ||
      args.tickSpacing === undefined || !args.hooks) {
    throw new Error(`PoolKey not found for poolId ${poolId}`)
  }
  return {
    currency0: args.currency0,
    currency1: args.currency1,
    fee: Number(args.fee),
    tickSpacing: Number(args.tickSpacing),
    hooks: args.hooks,
  }
}

export const resolveRhV4PoolKeyForTrade = async (pair: string | null | undefined): Promise<RhV4PoolKey | null> => {
  const embedded = resolveRhV4PoolKey(pair)
  if (embedded) return embedded
  const value = pair?.trim()
  if (value?.startsWith('0x') && value.length === 66) {
    return getRhV4PoolKeyByPoolId(value as `0x${string}`)
  }
  return null
}

const requireRhV4 = () => {
  const deployment = useChainStore().deployment
  if (deployment.dex.kind !== 'uniswap') throw new Error('RH V4 called outside an Uniswap chain')
  const wrapper = resolveContractAddress('TagAISwapWrapper')
  if (!wrapper || deployment.dex.v4PoolManager === zeroAddress) {
    throw new Error(`RH V4 contracts are not configured on ${deployment.name}`)
  }
  return { deployment, wrapper }
}

export const getRhWrapperFeeBps = async (): Promise<number> => {
  const [sellsman, tagai] = await Promise.all([
    readContract('TagAISwapWrapper', 'sellsmanRatio', []) as Promise<number>,
    readContract('TagAISwapWrapper', 'tagaiRatio', []) as Promise<number>,
  ])
  return Number(sellsman) + Number(tagai)
}

const quoterAbi = [{
  inputs: [{
    name: 'params', type: 'tuple', components: [
      { name: 'poolKey', type: 'tuple', components: [
        { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
      ] },
      { name: 'zeroForOne', type: 'bool' }, { name: 'exactAmount', type: 'uint128' }, { name: 'hookData', type: 'bytes' },
    ],
  }],
  name: 'quoteExactInputSingle',
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  stateMutability: 'nonpayable', type: 'function',
}] as const

export const quoteRhV4 = async (poolKey: RhV4PoolKey, amountIn: bigint, buying: boolean): Promise<bigint> => {
  const { deployment } = requireRhV4()
  if (deployment.dex.v4Quoter === zeroAddress) throw new Error(`Uniswap V4 Quoter is not configured on ${deployment.name}`)
  const feeBps = await getRhWrapperFeeBps()
  const quotedInput = buying ? amountIn * BigInt(10_000 - feeBps) / 10_000n : amountIn
  const nativeIs0 = poolKey.currency0 === zeroAddress || poolKey.currency0.toLowerCase() === deployment.wrappedNative.toLowerCase()
  const zeroForOne = buying ? nativeIs0 : !nativeIs0
  const { result } = await getReadOnlyClient().simulateContract({
    address: deployment.dex.v4Quoter,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne, exactAmount: quotedInput, hookData: '0x' }],
  })
  const amountOut = typeof result === 'bigint' ? result : result[0]
  return buying ? amountOut : amountOut * BigInt(10_000 - feeBps) / 10_000n
}

export const buyTokenV4Rh = async (
  poolKey: RhV4PoolKey,
  ethAmount: bigint,
  amountOutMin: bigint,
  sellsman: `0x${string}` = zeroAddress,
) => {
  const { deployment } = requireRhV4()
  return writeContract({
    contractName: 'TagAISwapWrapper', functionName: 'buyTokenV4',
    args: [sellsman, amountOutMin, poolKey, useAccountStore().ethConnectAddress,
      deployment.dex.v4PoolManager, 0n],
    value: ethAmount,
  })
}

export const sellTokenV4Rh = async (
  poolKey: RhV4PoolKey,
  token: `0x${string}`,
  amountIn: bigint,
  amountOutMin: bigint,
  sellsman: `0x${string}` = zeroAddress,
) => {
  const { deployment, wrapper } = requireRhV4()
  const owner = useAccountStore().ethConnectAddress as `0x${string}`
  const allowance = await readContract('Token1', 'allowance', [owner, wrapper], token) as bigint
  if (allowance < amountIn) {
    await writeContract({ contractName: 'Token1', functionName: 'approve', args: [wrapper, amountIn], address: token })
  }
  return writeContract({
    contractName: 'TagAISwapWrapper', functionName: 'sellTokenV4',
    args: [amountIn, amountOutMin, poolKey, owner, sellsman, deployment.dex.v4PoolManager, 0n],
  })
}
