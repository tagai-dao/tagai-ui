import { zeroAddress, type Address } from 'viem'
import { getBasketDeployment, getBasketProtocol } from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import { getBasketTokenAbi, getRebalanceExecutorAbi, pancakePoolManagerStateAbi } from './abis'
import { applySlippage } from './hook-data'
import { getBasketV4PoolId } from './route-validation'
import { quoteAssetToWethForSwap, quoteBasketHubExactInput, quoteWethToAssetForSwap } from './trade'
import { quoteBscV3AssetToSettlement, quoteBscV3SettlementToAsset } from './bsc-v3-routing'
import { isBscBasketV3, toContractLegRoute } from './routes'
import type { BasketDetail } from './types'

type LegState = { asset: Address; weightBps: bigint; reserve: bigint; value: bigint }

const applyInputCeiling = (amount: bigint, bps: number) =>
  amount === 0n ? 0n : (amount * BigInt(10_000 + bps) + 9_999n) / 10_000n

const buildBscV3RebalanceLimits = async (detail: BasketDetail, slippageBps: number) => {
  const protocol = getBasketProtocol(detail.chainId, detail.version)
  const client = getReadOnlyClient(detail.chainId)
  const abi = getRebalanceExecutorAbi(detail.chainId, detail.version)
  const raw: any = await client.readContract({
    address: protocol.rebalanceExecutor,
    abi,
    functionName: 'previewRebalance',
    args: [detail.address],
  } as any)
  const preview = raw?.preview ?? raw
  const needed = Boolean(preview?.needed ?? preview?.[0])
  if (!needed) throw new Error('RebalanceNotNeeded')
  const sellMask = Number(preview?.sellMask ?? preview?.[1] ?? 0)
  const buyMask = Number(preview?.buyMask ?? preview?.[2] ?? 0)
  const assetIn = [...(preview?.assetIn ?? preview?.[5] ?? [])] as bigint[]
  const expectedSettlementOut = [...(preview?.expectedSettlementOut ?? preview?.[6] ?? [])] as bigint[]
  const settlementIn = [...(preview?.settlementIn ?? preview?.[7] ?? [])] as bigint[]
  const count = detail.holdings.length
  if (assetIn.length !== count || expectedSettlementOut.length !== count || settlementIn.length !== count) {
    throw new Error('InvalidLimits')
  }

  const maxAssetIn = Array.from({ length: count }, () => 0n)
  const minSettlementOut = Array.from({ length: count }, () => 0n)
  const maxSettlementIn = Array.from({ length: count }, () => 0n)
  const minAssetOut = Array.from({ length: count }, () => 0n)
  for (let index = 0; index < count; index += 1) {
    if ((sellMask & (1 << index)) === 0) continue
    const holding = detail.holdings[index]
    maxAssetIn[index] = applyInputCeiling(assetIn[index], slippageBps)
    const quoted = await quoteBscV3AssetToSettlement(holding.route, holding.asset, assetIn[index], detail.chainId)
    minSettlementOut[index] = applySlippage(quoted, slippageBps)
  }

  const expectedProceeds = expectedSettlementOut.reduce((sum, value) => sum + value, 0n)
  const protectedProceeds = minSettlementOut.reduce((sum, value) => sum + value, 0n)
  if (!expectedProceeds || !protectedProceeds) throw new Error('RebalanceNotNeeded')
  let allocated = 0n
  let lastBuy = -1
  for (let index = count - 1; index >= 0; index -= 1) {
    if ((buyMask & (1 << index)) !== 0) { lastBuy = index; break }
  }
  for (let index = 0; index < count; index += 1) {
    if ((buyMask & (1 << index)) === 0) continue
    const protectedIn = index === lastBuy
      ? protectedProceeds - allocated
      : protectedProceeds * settlementIn[index] / expectedProceeds
    allocated += protectedIn
    maxSettlementIn[index] = applyInputCeiling(settlementIn[index], slippageBps)
    const holding = detail.holdings[index]
    const quoted = await quoteBscV3SettlementToAsset(holding.route, holding.asset, protectedIn, detail.chainId)
    minAssetOut[index] = applySlippage(quoted, slippageBps)
  }

  return {
    expectedSellMask: sellMask,
    expectedBuyMask: buyMask,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    maxAssetIn,
    minSettlementOut,
    maxSettlementIn,
    minAssetOut,
  }
}

/**
 * Reproduces the executor's rebalance plan, but quotes actual DEX outputs so
 * venue fees and price impact are included before applying user slippage.
 * Buy floors use the minimum protected sell proceeds, making them attainable
 * even when every sell leg lands exactly on its caller-provided floor.
 */
export const buildRebalanceLimits = async (detail: BasketDetail, slippageBps: number) => {
  if (isBscBasketV3(detail.chainId, detail.version)) {
    const v3Limits = await buildBscV3RebalanceLimits(detail, slippageBps)
    return {
      v3Limits,
      minWethOut: v3Limits.minSettlementOut,
      minQuoteOut: v3Limits.minSettlementOut,
      minAssetOut: v3Limits.minAssetOut,
      minHubOut: 0n,
    }
  }
  const deployment = getBasketDeployment(detail.chainId)
  const protocol = getBasketProtocol(detail.chainId, detail.version)
  const tokenAbi = getBasketTokenAbi(detail.chainId, detail.version)
  const executorAbi = getRebalanceExecutorAbi(detail.chainId, detail.version)
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
      address: protocol.rebalanceExecutor,
      abi: executorAbi,
      functionName: quoteAssetFunction,
      args: [toContractLegRoute(detail.holdings[index].route, detail.chainId, detail.version), asset, reserve],
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
    return { v3Limits: undefined, minWethOut: minQuoteOut, minQuoteOut, minAssetOut, minHubOut: 0n }
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
  return { v3Limits: undefined, minWethOut: minQuoteOut, minQuoteOut, minAssetOut, minHubOut }
}
