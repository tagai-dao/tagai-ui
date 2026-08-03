import { zeroAddress, type Address } from 'viem'
import { getBasketDeployment, toContractPoolKey } from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { getBasketTokenAbi, getRebalanceExecutorAbi, pancakePoolManagerStateAbi } from './abis'
import { applySlippage } from './hook-data'
import { getBasketV4PoolId } from './route-validation'
import { quoteAssetToWethForSwap, quoteBasketHubExactInput, quoteWethToAssetForSwap } from './trade'
import type { BasketDetail } from './types'

type LegState = { asset: Address; weightBps: bigint; reserve: bigint; value: bigint }

/**
 * Reproduces the executor's rebalance plan, but quotes actual DEX outputs so
 * venue fees and price impact are included before applying user slippage.
 * Buy floors use the minimum protected sell proceeds, making them attainable
 * even when every sell leg lands exactly on its caller-provided floor.
 */
export const buildRebalanceLimits = async (detail: BasketDetail, slippageBps: number) => {
  const deployment = getBasketDeployment(detail.chainId)
  const tokenAbi = getBasketTokenAbi(detail.chainId)
  const executorAbi = getRebalanceExecutorAbi(detail.chainId)
  const quoteAssetFunction = detail.chainId === 56 ? 'quoteAssetToWbnb' : 'quoteAssetToWeth'
  const client = getReadOnlyClient(detail.chainId)
  const rawStates = await Promise.all(detail.holdings.map((_, index) => client.readContract({
    address: detail.address,
    abi: tokenAbi,
    functionName: 'assetAt',
    args: [BigInt(index)],
  })))
  const legs: LegState[] = await Promise.all(rawStates.map(async (raw: any, index) => {
    const asset = (raw?.asset ?? raw?.[0]) as Address
    const weightBps = BigInt(raw?.targetWeightBps ?? raw?.[1] ?? 0)
    const reserve = BigInt(raw?.activeReserve ?? raw?.[2] ?? 0)
    const value = await client.readContract({
      address: deployment.contracts.rebalanceExecutor,
      abi: executorAbi,
      functionName: quoteAssetFunction,
      args: [{ ...detail.holdings[index].route, v4Pool: toContractPoolKey(detail.holdings[index].route.v4Pool, detail.chainId) }, asset, reserve],
    } as any) as bigint
    return { asset, weightBps, reserve, value }
  }))

  const total = legs.reduce((sum, leg) => sum + leg.value, 0n)
  if (!total) throw new Error('OracleUnavailable')
  const minQuoteOut = Array.from({ length: legs.length }, () => 0n)
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
    const quoted = await quoteAssetToWethForSwap(detail.holdings[index].route, leg.asset, amountToSell, detail.chainId)
    minQuoteOut[index] = applySlippage(quoted, slippageBps)
  }

  if (!totalDeficit || lastDeficit < 0) throw new Error('RebalanceNotNeeded')

  if (detail.chainId !== 56) {
    const protectedWeth = minQuoteOut.reduce((sum, amount) => sum + amount, 0n)
    if (!protectedWeth) throw new Error('RebalanceNotNeeded')
    let allocated = 0n
    for (let index = 0; index < legs.length; index += 1) {
      if (!deficits[index]) continue
      const wethIn = index === lastDeficit
        ? protectedWeth - allocated
        : protectedWeth * deficits[index] / totalDeficit
      allocated += wethIn
      if (!wethIn) continue
      const quoted = await quoteWethToAssetForSwap(detail.holdings[index].route, legs[index].asset, wethIn, detail.chainId)
      minAssetOut[index] = applySlippage(quoted, slippageBps)
    }
    return { minWethOut: minQuoteOut, minQuoteOut, minAssetOut, minHubOut: 0n }
  }

  let protectedWbnb = 0n
  let protectedSettlement = 0n
  let wbnbDeficit = 0n
  let settlementDeficit = 0n
  let lastWbnbDeficit = -1
  let lastSettlementDeficit = -1
  for (let index = 0; index < legs.length; index += 1) {
    if (detail.holdings[index].route.quoteToken === 1) {
      protectedSettlement += minQuoteOut[index]
      if (deficits[index]) {
        settlementDeficit += deficits[index]
        lastSettlementDeficit = index
      }
    } else {
      protectedWbnb += minQuoteOut[index]
      if (deficits[index]) {
        wbnbDeficit += deficits[index]
        lastWbnbDeficit = index
      }
    }
  }
  if (!protectedWbnb && !protectedSettlement) throw new Error('RebalanceNotNeeded')

  const hubPoolId = getBasketV4PoolId(deployment.hubPool, detail.chainId)
  const hubState = await client.readContract({
    address: deployment.contracts.poolManager,
    abi: pancakePoolManagerStateAbi,
    functionName: 'getSlot0',
    args: [hubPoolId],
  })
  const sqrtPriceX96 = hubState[0]
  if (!sqrtPriceX96) throw new Error('OracleUnavailable')
  const q96 = 1n << 96n
  const quoteHubSpot = (input: Address, amount: bigint) => {
    if (!amount) return 0n
    return input.toLowerCase() === deployment.contracts.settlementToken.toLowerCase()
      ? (amount * q96 / sqrtPriceX96) * q96 / sqrtPriceX96
      : (amount * sqrtPriceX96 / q96) * sqrtPriceX96 / q96
  }

  let minHubOut = 0n
  if (!wbnbDeficit && protectedWbnb) {
    const quoted = await quoteBasketHubExactInput(zeroAddress, protectedWbnb, detail.chainId)
    minHubOut = applySlippage(quoted, slippageBps)
    protectedSettlement += minHubOut
    protectedWbnb = 0n
  } else if (!settlementDeficit && protectedSettlement) {
    const quoted = await quoteBasketHubExactInput(
      deployment.contracts.settlementToken,
      protectedSettlement,
      detail.chainId,
    )
    minHubOut = applySlippage(quoted, slippageBps)
    protectedWbnb += minHubOut
    protectedSettlement = 0n
  } else if (wbnbDeficit && settlementDeficit) {
    const settlementValue = quoteHubSpot(deployment.contracts.settlementToken, protectedSettlement)
    const targetWbnb = (protectedWbnb + settlementValue) * wbnbDeficit / totalDeficit
    if (protectedWbnb < targetWbnb) {
      const shortage = targetWbnb - protectedWbnb
      const settlementIn = [quoteHubSpot(zeroAddress, shortage), protectedSettlement]
        .reduce((minimum, value) => value < minimum ? value : minimum)
      if (settlementIn) {
        const quoted = await quoteBasketHubExactInput(
          deployment.contracts.settlementToken,
          settlementIn,
          detail.chainId,
        )
        minHubOut = applySlippage(quoted, slippageBps)
        protectedSettlement -= settlementIn
        protectedWbnb += minHubOut
      }
    } else if (protectedWbnb > targetWbnb) {
      const wbnbIn = protectedWbnb - targetWbnb
      const quoted = await quoteBasketHubExactInput(zeroAddress, wbnbIn, detail.chainId)
      minHubOut = applySlippage(quoted, slippageBps)
      protectedWbnb -= wbnbIn
      protectedSettlement += minHubOut
    }
  }

  let allocatedWbnb = 0n
  let allocatedSettlement = 0n
  for (let index = 0; index < legs.length; index += 1) {
    if (!deficits[index]) continue
    const settlementQuoted = detail.holdings[index].route.quoteToken === 1
    const quoteIn = settlementQuoted
      ? index === lastSettlementDeficit
        ? protectedSettlement - allocatedSettlement
        : protectedSettlement * deficits[index] / settlementDeficit
      : index === lastWbnbDeficit
        ? protectedWbnb - allocatedWbnb
        : protectedWbnb * deficits[index] / wbnbDeficit
    if (settlementQuoted) allocatedSettlement += quoteIn
    else allocatedWbnb += quoteIn
    if (!quoteIn) continue
    const quoted = await quoteWethToAssetForSwap(detail.holdings[index].route, legs[index].asset, quoteIn, detail.chainId)
    minAssetOut[index] = applySlippage(quoted, slippageBps)
  }
  return { minWethOut: minQuoteOut, minQuoteOut, minAssetOut, minHubOut }
}
