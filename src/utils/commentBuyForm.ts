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
export const COMMENT_BUY_PROTOCOL_CAP_BPS = 300

/** Fee comes from the public API; never fall back to a zero-fee authorization on bad data. */
export function commentBuyExecutionFee(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value)) return null
  return BigInt(value)
}

/** Suggested reserve for one buy, not a charge or a guarantee of execution. */
export function commentBuyFeeReserve(principal: bigint, executionFee: bigint): bigint {
  return executionFee + (principal * BigInt(COMMENT_BUY_PROTOCOL_CAP_BPS) + 9999n) / 10000n
}

export function commentBuyLimitIssue(total: string, trade: string, daily: string): 'amount' | 'total' | 'daily' | null {
  const values = [total, trade, daily].map(commentBuyAmount)
  if (values.some(v => v === null || v <= 0n)) return 'amount'
  if (values[0]! < values[1]!) return 'total'
  if (values[2]! < values[1]!) return 'daily'
  return null
}
