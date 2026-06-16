/**
 * PCS V4 Infinity CL 流动性管理（SPCXB 专用）
 */
import {
  PCSCLPositionManager,
} from '@/config'
import { useAccountStore } from '@/stores/web3'
import {
  getV4PoolKeyByPoolId,
  getV4PoolState,
  sqrtPriceX96ToBnbPerToken,
  ensurePermit2AllowanceForSpender,
  type PoolKey as RawPoolKey,
} from '@/utils/pcsV4Swap'
import { getReadOnlyClient, getWalletClient, setup, waitForTx } from '@/utils/wallets'
import { customBsc } from '@/utils/privy'
import { getClPositions } from '@/apis/api'
import errCode from '@/errCode'
import {
  clPoolIdToPoolKey,
  decodeCLPoolParameters,
  encodeCLPositionManagerMintCalldata,
  encodeCLPositionManagerDecreaseLiquidityCalldata,
  encodeCLPositionModifyLiquidities,
  getPoolId,
  CLPositionManagerAbi,
  type PoolKey as SdkPoolKey,
  type CLPositionConfig,
} from '@pancakeswap/infinity-sdk'
import {
  TickMath,
  nearestUsableTick,
  maxLiquidityForAmounts,
  PositionMath,
} from '@pancakeswap/v3-sdk'
import {
  concat,
  encodeAbiParameters,
  parseAbiParameters,
  toHex,
  zeroAddress,
  type Hex,
} from 'viem'
import type { ClPositionSummary } from '@/types/liquidity'

const DEADLINE_SEC = 1200

export const toSdkPoolKey = (raw: RawPoolKey): SdkPoolKey<'CL'> => ({
  currency0: raw.currency0,
  currency1: raw.currency1,
  hooks: raw.hooks ?? zeroAddress,
  poolManager: raw.poolManager,
  fee: raw.fee,
  parameters: decodeCLPoolParameters(raw.parameters),
})

export const fetchSdkPoolKey = async (poolId: `0x${string}`) => {
  const client = getReadOnlyClient()
  // infinity-sdk 内置 viem 版本与项目不一致，此处 cast 规避类型冲突
  const key = await clPoolIdToPoolKey({ poolId, publicClient: client as any })
  if (!key) {
    const raw = await getV4PoolKeyByPoolId(poolId)
    return toSdkPoolKey(raw)
  }
  return key
}

export const fetchPoolOverview = async (poolId: `0x${string}`) => {
  const [{ sqrtPriceX96, tick, lpFee }, poolKey] = await Promise.all([
    getV4PoolState(poolId),
    fetchSdkPoolKey(poolId),
  ])
  const tickSpacing = poolKey.parameters.tickSpacing
  const priceBnb = sqrtPriceX96ToBnbPerToken(sqrtPriceX96)
  return { sqrtPriceX96, tick, lpFee, poolKey, tickSpacing, priceBnb }
}

export const tickToBnbPerToken = (tick: number): number => {
  const sqrt = TickMath.getSqrtRatioAtTick(tick)
  return sqrtPriceX96ToBnbPerToken(sqrt)
}

/** BNB/Token 价格 → tick（bnbPerToken 越低 tick 越高，须与 tickToBnbPerToken 互逆） */
export const bnbPerTokenToTick = (bnbPerToken: number, tickSpacing: number): number => {
  if (bnbPerToken <= 0) return nearestUsableTick(TickMath.MIN_TICK, tickSpacing)
  let lo = TickMath.MIN_TICK
  let hi = TickMath.MAX_TICK
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    // tick 越大 → BNB/Token 越低
    if (tickToBnbPerToken(mid) > bnbPerToken) lo = mid + 1
    else hi = mid
  }
  return nearestUsableTick(lo, tickSpacing)
}

export const ticksFromPriceRange = (
  minBnbPerToken: number,
  maxBnbPerToken: number,
  tickSpacing: number,
  currentTick: number,
) => {
  const low = Math.min(minBnbPerToken, maxBnbPerToken)
  const high = Math.max(minBnbPerToken, maxBnbPerToken)
  // 低 BNB/Token 价 → 高 tick；必须 min/max 保证 tickLower < tickUpper
  const tickAtLowPrice = bnbPerTokenToTick(low, tickSpacing)
  const tickAtHighPrice = bnbPerTokenToTick(high, tickSpacing)
  const tickLower = Math.min(tickAtLowPrice, tickAtHighPrice)
  const tickUpper = Math.max(tickAtLowPrice, tickAtHighPrice)
  if (tickLower >= tickUpper) {
    const fallbackLower = nearestUsableTick(currentTick - tickSpacing * 10, tickSpacing)
    const fallbackUpper = nearestUsableTick(currentTick + tickSpacing * 10, tickSpacing)
    return {
      tickLower: Math.min(fallbackLower, fallbackUpper),
      tickUpper: Math.max(fallbackLower, fallbackUpper),
    }
  }
  return { tickLower, tickUpper }
}

export const ticksFromPreset = (
  preset: 'full' | '5' | '10',
  spotBnbPerToken: number,
  tickSpacing: number,
  currentTick: number,
) => {
  if (preset === 'full') {
    return {
      tickLower: nearestUsableTick(TickMath.MIN_TICK, tickSpacing),
      tickUpper: nearestUsableTick(TickMath.MAX_TICK, tickSpacing),
    }
  }
  const pct = preset === '5' ? 0.05 : 0.1
  return ticksFromPriceRange(
    spotBnbPerToken * (1 - pct),
    spotBnbPerToken * (1 + pct),
    tickSpacing,
    currentTick,
  )
}

export const calcLiquidityAmounts = (
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  amount0: bigint,
  amount1: bigint,
) => {
  const sqrtLower = TickMath.getSqrtRatioAtTick(tickLower)
  const sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpper)
  const liquidity = maxLiquidityForAmounts(
    sqrtPriceX96,
    sqrtLower,
    sqrtUpper,
    amount0,
    amount1,
    true,
  )
  return { liquidity, sqrtLower, sqrtUpper }
}

const MAX_U128 = 2n ** 128n - 1n

/** 根据单边输入计算另一边所需数量 */
export const computePairAmount = (
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  side: 'bnb' | 'token',
  amount: bigint,
): bigint => {
  if (amount <= 0n) return 0n
  const tickCurrent = TickMath.getTickAtSqrtRatio(sqrtPriceX96)
  // 区间外仅支持单边资产
  if (side === 'bnb' && tickCurrent >= tickUpper) return 0n
  if (side === 'token' && tickCurrent < tickLower) return 0n

  const { liquidity } = side === 'bnb'
    ? calcLiquidityAmounts(sqrtPriceX96, tickLower, tickUpper, amount, MAX_U128)
    : calcLiquidityAmounts(sqrtPriceX96, tickLower, tickUpper, MAX_U128, amount)
  if (liquidity <= 0n) return 0n
  return side === 'bnb'
    ? PositionMath.getToken1Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, liquidity)
    : PositionMath.getToken0Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, liquidity)
}

const applySlippageMax = (amount: bigint, slippageBps: number) =>
  amount + (amount * BigInt(slippageBps)) / 10000n

const applySlippageMin = (amount: bigint, slippageBps: number) =>
  amount - (amount * BigInt(slippageBps)) / 10000n

const sendPositionManagerTx = async (data: Hex, value: bigint) => {
  const account = useAccountStore().ethConnectAddress as `0x${string}`
  const client = getWalletClient()
  const publicClient = getReadOnlyClient()
  if (!client) throw 'no wallet client'
  if (useAccountStore().getWalletType !== 'privy') await setup()

  await publicClient.call({
    account,
    to: PCSCLPositionManager as `0x${string}`,
    data,
    value,
  })

  const hash = await client.sendTransaction({
    account,
    to: PCSCLPositionManager as `0x${string}`,
    data,
    value,
    chain: customBsc,
  })
  const receipt = await waitForTx(hash)
  if (!receipt) throw errCode.TRANSACTION_INVALID
  return receipt
}

/** 添加 CL 流动性（mint 新 NFT） */
export const addClLiquidity = async (params: {
  poolKey: SdkPoolKey<'CL'>
  tickLower: number
  tickUpper: number
  amount0: bigint
  amount1: bigint
  slippageBps: number
}) => {
  const { poolKey, tickLower, tickUpper, amount0, amount1, slippageBps } = params
  const account = useAccountStore().ethConnectAddress as `0x${string}`
  const poolId = getPoolId(poolKey)
  const { sqrtPriceX96 } = await getV4PoolState(poolId as `0x${string}`)

  const amount0Max = applySlippageMax(amount0, slippageBps)
  const amount1Max = applySlippageMax(amount1, slippageBps)

  if (poolKey.currency0 !== zeroAddress && amount0Max > 0n) {
    await ensurePermit2AllowanceForSpender(
      poolKey.currency0 as `0x${string}`,
      PCSCLPositionManager as `0x${string}`,
      amount0Max,
    )
  }
  if (poolKey.currency1 !== zeroAddress && amount1Max > 0n) {
    await ensurePermit2AllowanceForSpender(
      poolKey.currency1 as `0x${string}`,
      PCSCLPositionManager as `0x${string}`,
      amount1Max,
    )
  }

  const { liquidity } = calcLiquidityAmounts(sqrtPriceX96, tickLower, tickUpper, amount0, amount1)
  if (liquidity <= 0n) throw new Error('invalid liquidity')
  const MAX_UINT128 = 2n ** 128n - 1n
  if (liquidity > MAX_UINT128) throw new Error('liquidity too large')

  const positionConfig: CLPositionConfig = { poolKey, tickLower, tickUpper }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SEC)

  const data = encodeCLPositionManagerMintCalldata(
    positionConfig,
    liquidity,
    account,
    amount0Max,
    amount1Max,
    deadline,
    '0x',
  ) as Hex

  return sendPositionManagerTx(data, amount0Max)
}

/** CL_BURN_POSITION action id */
const CL_BURN_POSITION = 3
const CLOSE_CURRENCY = 18
const SWEEP = 20

/**
 * 构建 burn calldata。
 * infinity-sdk@1.0.8 的 encodeCLPositionManagerBurnCalldata 多传了 PositionConfig，
 * 与链上 decodeCLBurnParams(tokenId, amount0Min, amount1Min, hookData) 不一致，会触发 SliceOutOfBounds(0x3b99b53d)。
 */
const encodeClPositionBurnCalldata = (
  tokenId: bigint,
  poolKey: SdkPoolKey<'CL'>,
  amount0Min: bigint,
  amount1Min: bigint,
  sweepRecipient: `0x${string}`,
  deadline: bigint,
  hookData: Hex = '0x',
) => {
  const burnParam = encodeAbiParameters(
    parseAbiParameters('uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData'),
    [tokenId, amount0Min, amount1Min, hookData],
  )
  const close0Param = encodeAbiParameters(parseAbiParameters('address currency'), [poolKey.currency0])
  const close1Param = encodeAbiParameters(parseAbiParameters('address currency'), [poolKey.currency1])

  const isNativePool = poolKey.currency0 === zeroAddress
  const actionBytes = isNativePool
    ? concat([
      toHex(CL_BURN_POSITION, { size: 1 }),
      toHex(CLOSE_CURRENCY, { size: 1 }),
      toHex(CLOSE_CURRENCY, { size: 1 }),
      toHex(SWEEP, { size: 1 }),
    ])
    : concat([
      toHex(CL_BURN_POSITION, { size: 1 }),
      toHex(CLOSE_CURRENCY, { size: 1 }),
      toHex(CLOSE_CURRENCY, { size: 1 }),
    ])

  const params = isNativePool
    ? [
      burnParam,
      close0Param,
      close1Param,
      encodeAbiParameters(parseAbiParameters('address currency, address to'), [poolKey.currency0, sweepRecipient]),
    ]
    : [burnParam, close0Param, close1Param]

  const payload = encodeAbiParameters(parseAbiParameters('bytes, bytes[]'), [actionBytes, params])
  return encodeCLPositionModifyLiquidities(payload, deadline) as Hex
}

/** 移除流动性；100% 时 burn NFT */
export const removeClLiquidity = async (params: {
  tokenId: bigint
  poolKey: SdkPoolKey<'CL'>
  tickLower: number
  tickUpper: number
  liquidity: bigint
  percent: number
  sqrtPriceX96: bigint
  tickCurrent: number
  slippageBps: number
}) => {
  const {
    tokenId, poolKey, tickLower, tickUpper, liquidity, percent,
    sqrtPriceX96, tickCurrent, slippageBps,
  } = params
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SEC)
  const removeLiquidity = (liquidity * BigInt(Math.round(percent))) / 100n
  if (removeLiquidity <= 0n) throw new Error('invalid remove amount')

  const amount0 = PositionMath.getToken0Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, removeLiquidity)
  const amount1 = PositionMath.getToken1Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, removeLiquidity)
  const amount0Min = applySlippageMin(amount0, slippageBps)
  const amount1Min = applySlippageMin(amount1, slippageBps)

  const account = useAccountStore().ethConnectAddress as `0x${string}`

  let data: Hex
  if (percent >= 100) {
    data = encodeClPositionBurnCalldata(
      tokenId,
      poolKey,
      amount0Min,
      amount1Min,
      account,
      deadline,
    )
  } else {
    data = encodeCLPositionManagerDecreaseLiquidityCalldata({
      tokenId,
      poolKey,
      liquidity: removeLiquidity,
      amount0Min,
      amount1Min,
      hookData: '0x',
      deadline,
    }) as Hex
  }

  return sendPositionManagerTx(data, 0n)
}

type ClPositionOnChainResult = readonly [
  {
    currency0: `0x${string}`
    currency1: `0x${string}`
    hooks: `0x${string}`
    poolManager: `0x${string}`
    fee: number
    parameters: Hex
  },
  number,
  number,
  bigint,
  bigint,
  bigint,
  `0x${string}`,
]

const MULTICALL_BATCH_SIZE = 100

/** 批量 multicall 读取 PositionManager.positions(tokenId) */
const readClPositionsMulticall = async (tokenIds: bigint[]) => {
  const client = getReadOnlyClient()
  const resultMap = new Map<bigint, ClPositionOnChainResult | null>()

  for (let i = 0; i < tokenIds.length; i += MULTICALL_BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + MULTICALL_BATCH_SIZE)
    const contracts = batch.map((tokenId) => ({
      address: PCSCLPositionManager as `0x${string}`,
      abi: CLPositionManagerAbi,
      functionName: 'positions' as const,
      args: [tokenId] as const,
    }))
    const results = await client.multicall({ contracts, allowFailure: true })
    batch.forEach((tokenId, idx) => {
      const row = results[idx]
      resultMap.set(
        tokenId,
        row?.status === 'success' ? (row.result as ClPositionOnChainResult) : null,
      )
    })
  }

  return resultMap
}

/** 通过 API（The Graph）获取 tokenId 列表，multicall 读链上仓位后按 poolId 过滤 */
export const fetchUserClPositions = async (
  user: `0x${string}`,
  targetPoolId: `0x${string}`,
): Promise<ClPositionSummary[]> => {
  const indexRes = await getClPositions(user.toLowerCase())
  const indexed = indexRes?.c === 0 ? indexRes.d?.positions ?? [] : []
  const tokenIds = indexed
    .map((p) => BigInt(p.tokenId))
    .filter((id) => id > 0n)

  if (tokenIds.length === 0) return []

  const targetPoolIdLower = targetPoolId.toLowerCase()
  const [{ sqrtPriceX96, tick: tickCurrent }, onChainMap] = await Promise.all([
    getV4PoolState(targetPoolId),
    readClPositionsMulticall(tokenIds),
  ])

  const positions: ClPositionSummary[] = []

  for (const tokenId of tokenIds) {
    const result = onChainMap.get(tokenId)
    if (!result) continue

    const [poolKeyTuple, tickLower, tickUpper, liquidity] = result
    if (liquidity === 0n) continue

    const poolKey: SdkPoolKey<'CL'> = {
      currency0: poolKeyTuple.currency0,
      currency1: poolKeyTuple.currency1,
      hooks: poolKeyTuple.hooks,
      poolManager: poolKeyTuple.poolManager,
      fee: poolKeyTuple.fee,
      parameters: decodeCLPoolParameters(poolKeyTuple.parameters),
    }
    if (getPoolId(poolKey).toLowerCase() !== targetPoolIdLower) continue

    const amount0 = PositionMath.getToken0Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, liquidity)
    const amount1 = PositionMath.getToken1Amount(tickCurrent, tickLower, tickUpper, sqrtPriceX96, liquidity)
    positions.push({
      tokenId,
      tickLower,
      tickUpper,
      liquidity,
      amount0,
      amount1,
      inRange: tickCurrent >= tickLower && tickCurrent < tickUpper,
    })
  }

  return positions
}

/** lpFee 为 ppm（4000 = 0.4%），去掉尾随零 */
export const formatLpFee = (lpFee: number) => `${parseFloat((lpFee / 10000).toFixed(4))}%`
