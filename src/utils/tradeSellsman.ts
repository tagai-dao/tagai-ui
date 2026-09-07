import { isAddress, zeroAddress, type Address } from 'viem'

// Public IPShare subjects: BSC TipTagAi and Robinhood tagagen78.
export const DEFAULT_TRADE_SELLSMAN: Record<number, Address> = {
  56: '0xf0a27ec9bb8AC28007cB474fC1ea0A9396fe6991',
  4663: '0xcb3A8062935b1C3f2C8eA4965eD490623aa186AD',
}

/** Match the legacy WrapSwaper branch in pump.buyToken/sellToken, not just listed state. */
export function requiresIPShareSellsman(community: {
  listed?: boolean
  isImport?: boolean | number | null
  version?: number | string | null
}): boolean {
  if (!community.listed) return true
  // Imported wrappers and V4 hooks have their own referral policy. Legacy
  // issued-token WrapSwaper instead reverts for nonzero subjects without IPShare.
  return !community.isImport && ![7, 8, 9, 11].includes(Number(community.version))
}

/**
 * Modern listed trades resolve referral fallback in the wrapper or swap hook.
 * Preserve any caller-supplied address, including one without an IPShare;
 * only values that cannot be ABI-encoded are normalized to the zero address.
 */
export function resolveListedTradeSellsman(
  candidate: string | null | undefined,
): Address {
  return candidate && isAddress(candidate) ? candidate : zeroAddress
}

export async function resolveTradeSellsman(
  chainId: number,
  candidate: string | null | undefined,
  hasIPShare: (address: Address) => Promise<boolean>,
): Promise<Address> {
  const fallback = DEFAULT_TRADE_SELLSMAN[chainId]
  if (!fallback) throw new Error('Unsupported chain for trade referral')
  // Do not catch RPC errors: an unavailable lookup is not proof that the
  // creator has no IPShare, and must not silently redirect their rewards.
  if (candidate && isAddress(candidate) && candidate.toLowerCase() !== zeroAddress &&
      await hasIPShare(candidate)) return candidate
  if (await hasIPShare(fallback)) return fallback
  throw new Error('Default trade IPShare is unavailable. Please try again later.')
}
