import {
  decodeFunctionResult,
  encodeFunctionData,
  encodePacked,
  formatEther,
  isAddress,
  parseEther,
  zeroAddress,
  type Hex,
} from 'viem'

import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { readContract, resolveContractAddress, writeContract } from './contract'
import { getReadOnlyClient } from './wallets'

export const SPCXB_TOKEN = '0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1' as const
const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955' as const
const FIRST_HOP_FEES = [100, 500, 2_500, 10_000] as const
const USDT_SPCXB_FEE = 2_500

const QUOTER_ABI = [{
  inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }],
  name: 'quoteExactInput',
  outputs: [
    { name: 'amountOut', type: 'uint256' },
    { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
    { name: 'initializedTicksCrossedList', type: 'uint32[]' },
    { name: 'gasEstimate', type: 'uint256' },
  ],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const

type BridgeFee = typeof FIRST_HOP_FEES[number]

type RouteQuote = {
  path: Hex
  amountOut: bigint
  bridgeFee: BridgeFee
}

const requireBscDeployment = () => {
  const deployment = useChainStore().deployment
  if (deployment.key !== 'bsc') throw new Error('SPCXB deep route is only available on BSC')
  const executor = resolveContractAddress('SPCXBSwapExecutor')
  if (!executor) throw new Error('SPCXB deep-route executor is not configured')
  if (!isAddress(deployment.dex.v3Quoter) || deployment.dex.v3Quoter === zeroAddress) {
    throw new Error('Pancake V3 quoter is not configured')
  }
  return { deployment, executor }
}

export const isSpcxbToken = (token?: string | null) =>
  Boolean(token && token.toLowerCase() === SPCXB_TOKEN.toLowerCase())

const buildBuyPath = (wrappedNative: `0x${string}`, bridgeFee: number) =>
  encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [wrappedNative, bridgeFee, BSC_USDT, USDT_SPCXB_FEE, SPCXB_TOKEN],
  )

const buildSellPath = (wrappedNative: `0x${string}`, bridgeFee: number) =>
  encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [SPCXB_TOKEN, USDT_SPCXB_FEE, BSC_USDT, bridgeFee, wrappedNative],
  )

const quotePath = async (path: Hex, amountIn: bigint): Promise<bigint> => {
  const { deployment } = requireBscDeployment()
  const client = getReadOnlyClient()
  const data = encodeFunctionData({
    abi: QUOTER_ABI,
    functionName: 'quoteExactInput',
    args: [path, amountIn],
  })
  const response = await client.call({ to: deployment.dex.v3Quoter, data })
  if (!response.data) throw new Error('SPCXB quoter returned no data')
  const result = decodeFunctionResult({ abi: QUOTER_ABI, functionName: 'quoteExactInput', data: response.data })
  return BigInt(result[0])
}

const bestRoute = async (amountIn: bigint, direction: 'buy' | 'sell'): Promise<RouteQuote> => {
  if (amountIn <= 0n) throw new Error('Trade amount must be greater than zero')
  const { deployment } = requireBscDeployment()
  const quotes = await Promise.all(FIRST_HOP_FEES.map(async (bridgeFee): Promise<RouteQuote | null> => {
    const path = direction === 'buy'
      ? buildBuyPath(deployment.wrappedNative, bridgeFee)
      : buildSellPath(deployment.wrappedNative, bridgeFee)
    try {
      const amountOut = await quotePath(path, amountIn)
      return amountOut > 0n ? { path, amountOut, bridgeFee } : null
    } catch {
      return null
    }
  }))
  const available = quotes.filter((quote): quote is RouteQuote => quote !== null)
  if (!available.length) throw new Error('No liquid Pancake V3 route is available for SPCXB')
  return available.reduce((best, current) => current.amountOut > best.amountOut ? current : best)
}

const previewFees = async (nativeAmount: bigint) => {
  const result = await readContract('SPCXBSwapExecutor', 'previewFees', [nativeAmount]) as readonly bigint[]
  const swapAmount = BigInt(result[0] ?? 0)
  const creatorFee = BigInt(result[1] ?? 0)
  const tagaiFee = BigInt(result[2] ?? 0)
  if (swapAmount <= 0n || swapAmount + creatorFee + tagaiFee !== nativeAmount) {
    throw new Error('SPCXB fee preview is invalid')
  }
  return { swapAmount, creatorFee, tagaiFee }
}

export const quoteSpcxbBuy = async (nativeAmount: bigint): Promise<bigint> => {
  const fees = await previewFees(nativeAmount)
  return (await bestRoute(fees.swapAmount, 'buy')).amountOut
}

export const quoteSpcxbSell = async (tokenAmount: bigint): Promise<bigint> => {
  const grossNativeOut = (await bestRoute(tokenAmount, 'sell')).amountOut
  return (await previewFees(grossNativeOut)).swapAmount
}

export const getSpcxbSpotBnbPerToken = async (): Promise<number> => {
  const referenceAmount = parseEther('0.000001')
  const fees = await previewFees(referenceAmount)
  const tokenOut = (await bestRoute(fees.swapAmount, 'buy')).amountOut
  if (tokenOut <= 0n) return 0
  return Number(formatEther(fees.swapAmount)) / Number(formatEther(tokenOut))
}

const normalizeCreator = (creator?: string | null): `0x${string}` =>
  creator && isAddress(creator) ? creator : zeroAddress

export const buySpcxbDeepRoute = async (
  nativeAmount: bigint,
  minimumTokenOut: bigint,
  creator?: string | null,
) => {
  const fees = await previewFees(nativeAmount)
  const route = await bestRoute(fees.swapAmount, 'buy')
  return writeContract({
    contractName: 'SPCXBSwapExecutor',
    functionName: 'buySpcxb',
    args: [route.path, minimumTokenOut, useAccountStore().ethConnectAddress, normalizeCreator(creator)],
    value: nativeAmount,
  })
}

export const sellSpcxbDeepRoute = async (
  tokenAmount: bigint,
  minimumNativeOut: bigint,
  creator?: string | null,
) => {
  const executor = resolveContractAddress('SPCXBSwapExecutor')
  if (!executor) throw new Error('SPCXB deep-route executor is not configured')
  const owner = useAccountStore().ethConnectAddress as `0x${string}`
  const allowance = await readContract('Token1', 'allowance', [owner, executor], SPCXB_TOKEN) as bigint
  if (allowance < tokenAmount) {
    await writeContract({
      contractName: 'Token1',
      functionName: 'approve',
      args: [executor, tokenAmount],
      address: SPCXB_TOKEN,
    })
  }
  const route = await bestRoute(tokenAmount, 'sell')
  return writeContract({
    contractName: 'SPCXBSwapExecutor',
    functionName: 'sellSpcxb',
    args: [route.path, tokenAmount, minimumNativeOut, owner, normalizeCreator(creator)],
  })
}
