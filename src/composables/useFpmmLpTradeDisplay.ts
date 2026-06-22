import type { FPMMTrade } from '@/types'

export type LpOutcomeAmount = {
  outcomeIndex: number
  amount: number
}

const DUST = 0.01

/** 解析 LP 操作里的各 outcome 进/出池数量 */
export function parseLpPoolAmounts(item: FPMMTrade): number[] {
  if (item.opType !== 2) return []
  if (typeof item.amounts === 'string') {
    try {
      return JSON.parse(item.amounts) as number[]
    } catch {
      return []
    }
  }
  return Array.isArray(item.amounts) ? item.amounts : []
}

/**
 * 添加流动性时投入的抵押品数量。
 * 与后端 volume 口径一致：max(amountsAdded)；无 amounts 时回退 shares。
 */
export function getLpAddCollateral(item: FPMMTrade): number {
  const amounts = parseLpPoolAmounts(item)
  if (amounts.length === 0) return item.amount
  const maxPool = Math.max(...amounts)
  return maxPool > 0 ? maxPool : item.amount
}

/** 添加流动性时退还给用户的 outcome 代币：collateral - poolAmount */
export function getLpAddSendBackOutcomes(item: FPMMTrade): LpOutcomeAmount[] {
  const amounts = parseLpPoolAmounts(item)
  if (amounts.length === 0) return []
  const funding = getLpAddCollateral(item)
  return amounts
    .map((pool, outcomeIndex) => ({ outcomeIndex, amount: funding - pool }))
    .filter((o) => o.amount > DUST)
    .sort((a, b) => b.amount - a.amount)
}

/**
 * 添加流动性时用于 UI 展示的单一 outcome 返还。
 * - 二元：仅当两侧进池量不等时展示少进池一侧的返还（兼容旧逻辑）
 * - 多元：仅当恰好一种 outcome 有返还时展示，避免误把前两个池子差额当成某队返还
 */
export function getLpAddDisplaySendBack(item: FPMMTrade, outcomeCount: number): LpOutcomeAmount | null {
  const sendBacks = getLpAddSendBackOutcomes(item)
  if (sendBacks.length === 0) return null

  if (outcomeCount === 2) {
    const amounts = parseLpPoolAmounts(item)
    if (amounts.length < 2 || Math.abs(amounts[0] - amounts[1]) <= DUST) return null
    const idx = amounts[0] > amounts[1] ? 1 : 0
    return sendBacks.find((s) => s.outcomeIndex === idx) ?? null
  }

  return sendBacks.length === 1 ? sendBacks[0] : null
}

/** 移除流动性时取回的各 outcome 代币 */
export function getLpRemoveOutcomes(item: FPMMTrade): LpOutcomeAmount[] {
  return parseLpPoolAmounts(item)
    .map((amount, outcomeIndex) => ({ outcomeIndex, amount }))
    .filter((o) => o.amount > DUST)
    .sort((a, b) => b.amount - a.amount)
}
