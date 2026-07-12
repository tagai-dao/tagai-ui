/**
 * Spectrum revert 人话解码（精简版）
 */
import { decodeErrorResult, parseAbi, type Hex } from 'viem'

const HINTS: Record<string, string> = {
  'InsufficientFirstDeposit()':
    'First buy of a new basket must be at least 10 USDC — try a larger amount',
  'FirstMintUnderValued()':
    'Seed buy moved constituents past the first-mint guard — try a larger amount or wait',
  'SlippageExceeded()': 'Price moved past your slippage floor — refresh or raise tolerance',
  'LegMinNotMet()': 'A constituent filled below its per-leg minimum — refresh the quote',
  'NoOutput()': 'Amount is too small and rounds to zero output',
  'ZeroSupply()': 'Basket has no supply yet — needs a first buy (min ~10 USDC)',
  'MissingHookData()': 'Trade was sent without protection payload — refresh and retry',
  'BadLegMinsLength()': 'Quote mismatch (leg count) — refresh the page and retry',
}

const ERROR_SIGS = Object.keys(HINTS).concat([
  'ExactInputOnly()',
  'NothingToBurn()',
  'BelowBridgeThreshold()',
])

const customErrorAbi = parseAbi(ERROR_SIGS.map((s) => `error ${s}`))

const unwrapMessage = (err: unknown): string => {
  if (!err) return 'Transaction failed'
  if (typeof err === 'string') return err
  const e = err as {
    shortMessage?: string
    message?: string
    cause?: { reason?: string; message?: string; data?: Hex }
    data?: Hex
  }
  return e.shortMessage || e.message || e.cause?.reason || e.cause?.message || 'Transaction failed'
}

/** 尽量把自定义错误 / WrappedError 解成人话 */
export const friendlySpectrumRevert = (err: unknown): string => {
  const msg = unwrapMessage(err)
  for (const [sig, hint] of Object.entries(HINTS)) {
    if (msg.includes(sig.replace('()', '')) || msg.includes(sig)) return hint
  }

  const data = (err as { data?: Hex; cause?: { data?: Hex } })?.data
    ?? (err as { cause?: { data?: Hex } })?.cause?.data
  if (data && typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
    try {
      const decoded = decodeErrorResult({ abi: customErrorAbi, data })
      const name = `${decoded.errorName}()`
      return HINTS[name] || name
    } catch {
      // ignore
    }
  }
  return msg
}
