import manifest from './rh-usdg-presets.json'
import type { BasketAssetPreset } from '@/config/baskets'

export type RhUsdStockCandidate = BasketAssetPreset & { poolId: string; liquidityUsd: number }
export const RH_BASKET_MIN_DEPTH_USD = 50_000
export const rhUsdStockCandidates = manifest.candidates as RhUsdStockCandidate[]
export function selectRhUsdStockPresets(candidates: RhUsdStockCandidate[]): RhUsdStockCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const fee = (row: RhUsdStockCandidate) => row.route.venue === 0 ? row.route.v4Pool.fee : row.route.v3Fee
    return fee(a) - fee(b) || b.liquidityUsd - a.liquidityUsd || a.symbol.localeCompare(b.symbol)
  })
  const seen = new Set<string>()
  return sorted.filter(row => {
    const key = row.address.toLowerCase()
    if (!(row.liquidityUsd > RH_BASKET_MIN_DEPTH_USD) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
