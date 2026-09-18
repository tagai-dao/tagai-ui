import { parseEther } from 'viem'

/** Do not allow parseEther to silently round an input with more than 18 decimals. */
export function commentBuyAmount(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value.trim())) return null
  try {
    const amount = parseEther(value.trim())
    return amount <= (1n << 256n) - 1n ? amount : null
  } catch { return null }
}

export const COMMENT_BUY_SLIPPAGE_BPS = 500

/** Fee comes from the public API; never fall back to a zero-fee authorization on bad data. */
export function commentBuyExecutionFee(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value)) return null
  return BigInt(value)
}

export type CommentBuyGrant = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]
type LegacyCommentBuyGrant = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, number, boolean]

/** Legacy reads only: remove the old fee-cap slot without shifting expiry or spending data. */
export function normalizeLegacyCommentBuyGrant(g: LegacyCommentBuyGrant): CommentBuyGrant {
  return [g[0], g[1], g[2], g[3], g[4], g[5], g[6], g[7], g[8], g[10], g[11]]
}

/** An unchanged top-up must not replenish a spent budget or extend the original expiry. */
export function commentBuyGrantChanged(form: { budget: string; perTrade: string; perDay: string; days: string }, grant?: CommentBuyGrant): boolean {
  return !grant || commentBuyAmount(form.budget) !== grant[0] || commentBuyAmount(form.perTrade) !== grant[1] ||
    commentBuyAmount(form.perDay) !== grant[2] || form.days !== 'keep'
}

export function commentBuyFundingPlan(amount: string, updateGrant: boolean) {
  const value = commentBuyAmount(amount)
  if (value === null || value <= 0n) throw new Error('INVALID_DEPOSIT')
  return { functionName: updateGrant ? 'authorize' as const : 'deposit' as const, value }
}

export function commentBuyLimitIssue(total: string, trade: string, daily: string): 'amount' | 'total' | 'daily' | null {
  const values = [total, trade, daily].map(commentBuyAmount)
  if (values.some(v => v === null || v <= 0n)) return 'amount'
  if (values[0]! < values[1]!) return 'total'
  if (values[2]! < values[1]!) return 'daily'
  return null
}
