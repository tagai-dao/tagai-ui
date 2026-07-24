import type { Address } from 'viem'
import { BASKET_CHAIN_ID, BASKET_CONTRACTS } from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { basketTokenAbi, rebalanceExecutorAbi } from './abis'
import { applySlippage } from './hook-data'
import { quoteAssetToWethForSwap, quoteWethToAssetForSwap } from './trade'
import type { BasketDetail } from './types'

type LegState = { asset: Address; weightBps: bigint; reserve: bigint; value: bigint }

/**
 * Reproduces the executor's rebalance plan, but quotes actual DEX outputs so
 * venue fees and price impact are included before applying user slippage.
 * Buy floors use the minimum protected sell proceeds, making them attainable
 * even when every sell leg lands exactly on its caller-provided floor.
 */
export const buildRebalanceLimits = async (detail: BasketDetail, slippageBps: number) => {
  const client = getReadOnlyClient(BASKET_CHAIN_ID)
  const rawStates = await Promise.all(detail.holdings.map((_, index) => client.readContract({
    address: detail.address,
    abi: basketTokenAbi,
    functionName: 'assetAt',
    args: [BigInt(index)],
  })))
  const legs: LegState[] = await Promise.all(rawStates.map(async (raw: any, index) => {
    const asset = (raw?.asset ?? raw?.[0]) as Address
    const weightBps = BigInt(raw?.targetWeightBps ?? raw?.[1] ?? 0)
    const reserve = BigInt(raw?.activeReserve ?? raw?.[2] ?? 0)
    const value = await client.readContract({
      address: BASKET_CONTRACTS.rebalanceExecutor,
      abi: rebalanceExecutorAbi,
      functionName: 'quoteAssetToWeth',
      args: [detail.holdings[index].route, asset, reserve],
    })
    return { asset, weightBps, reserve, value }
  }))

  const total = legs.reduce((sum, leg) => sum + leg.value, 0n)
  if (!total) throw new Error('OracleUnavailable')
  const minWethOut = Array.from({ length: legs.length }, () => 0n)
  const minAssetOut = Array.from({ length: legs.length }, () => 0n)
  const deficits = Array.from({ length: legs.length }, () => 0n)
  let totalDeficit = 0n
  let lastDeficit = -1

  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index]
    const target = total * leg.weightBps / 10_000n
    if (leg.value <= target) {
      const deficit = target - leg.value
      deficits[index] = deficit
      if (deficit) { totalDeficit += deficit; lastDeficit = index }
      continue
    }
    const amountToSell = leg.reserve * (leg.value - target) / leg.value
    if (!amountToSell) continue
    const quoted = await quoteAssetToWethForSwap(detail.holdings[index].route, leg.asset, amountToSell)
    minWethOut[index] = applySlippage(quoted, slippageBps)
  }

  const protectedWeth = minWethOut.reduce((sum, amount) => sum + amount, 0n)
  if (!protectedWeth || !totalDeficit || lastDeficit < 0) throw new Error('RebalanceNotNeeded')
  let allocated = 0n
  for (let index = 0; index < legs.length; index += 1) {
    if (!deficits[index]) continue
    const wethIn = index === lastDeficit
      ? protectedWeth - allocated
      : protectedWeth * deficits[index] / totalDeficit
    allocated += wethIn
    if (!wethIn) continue
    const quoted = await quoteWethToAssetForSwap(detail.holdings[index].route, legs[index].asset, wethIn)
    minAssetOut[index] = applySlippage(quoted, slippageBps)
  }
  return { minWethOut, minAssetOut }
}
