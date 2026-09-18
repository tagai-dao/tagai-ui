import { parseEther } from 'viem'

/** Do not allow parseEther to silently round an input with more than 18 decimals. */
export function commentBuyAmount(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value.trim())) return null
  try {
    const amount = parseEther(value.trim())
    return amount <= (1n << 256n) - 1n ? amount : null
  } catch { return null }
}

/** User-facing percentages, converted exactly to the contract's integer basis points. */
export function commentBuyBps(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(bps) && bps <= 1000 ? bps : null
}

export function commentBuyLimitIssue(total: string, trade: string, daily: string): 'amount' | 'total' | 'daily' | null {
  const values = [total, trade, daily].map(commentBuyAmount)
  if (values.some(v => v === null || v <= 0n)) return 'amount'
  if (values[0]! < values[1]!) return 'total'
  if (values[2]! < values[1]!) return 'daily'
  return null
}
