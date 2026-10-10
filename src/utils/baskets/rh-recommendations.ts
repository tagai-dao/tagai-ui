import { getBasketDeployment, type BasketAssetPreset } from '@/config/baskets'
import { getReadOnlyClient } from '@/utils/wallets'
import type { BasketLegRoute } from './types'
import { validateBasketRoutes } from './route-validation'
import { getBasketV4PoolId } from './route-validation'
import { rhUsdStockCandidates, selectRhUsdStockPresets, RH_BASKET_MIN_DEPTH_USD, type RhUsdStockCandidate } from './rh-preset-catalog'

let depthCache: { at: number; rows: RhUsdStockCandidate[] } | undefined
export const invalidateRhStockPresetCache = () => { depthCache = undefined }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const poolIdentity = (asset: BasketAssetPreset): string | undefined => !same(asset.route.poolQuoteToken ?? '', getBasketDeployment(4663).contracts.settlementToken) ? undefined : asset.route.venue === 0 ? getBasketV4PoolId(asset.route.v4Pool) :
  rhUsdStockCandidates.find(row => same(row.address, asset.address) && row.route.venue === asset.route.venue && row.route.v3Fee === asset.route.v3Fee)?.poolId

/** Multi-pool HTTP data supplies TVL; contract state is independently verified
 * at one fixed block. Missing data never resurrects the old ETH/5% presets. */
export async function readRhStockDepth(candidates: RhUsdStockCandidate[], signal?: AbortSignal): Promise<RhUsdStockCandidate[]> {
  const usdg = getBasketDeployment(4663).contracts.settlementToken
  const metadata = new Map<string, any>()
  for (let i = 0; i < candidates.length; i += 30) {
    const ids = [...new Set(candidates.slice(i, i + 30).map(row => row.poolId.toLowerCase()))]
    const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools/multi/${ids.join(',')}?include=base_token%2Cquote_token`, { signal })
    if (!response.ok) throw new Error('RH_STOCK_DEPTH_UNAVAILABLE')
    const json = await response.json()
    if (!Array.isArray(json.data)) throw new Error('RH_STOCK_DEPTH_UNAVAILABLE')
    for (const pool of json.data) if (typeof pool?.attributes?.address === 'string') metadata.set(pool.attributes.address.toLowerCase(), pool)
  }
  return candidates.flatMap(row => {
    const pool = metadata.get(row.poolId.toLowerCase())
    const tokens = ['base_token', 'quote_token'].map(key => String(pool?.relationships?.[key]?.data?.id ?? '').replace(/^robinhood_/, '').toLowerCase())
    const dex = String(pool?.relationships?.dex?.data?.id ?? '')
    const liquidityUsd = Number(pool?.attributes?.reserve_in_usd ?? 0)
    if (!Number.isFinite(liquidityUsd) || !(liquidityUsd > RH_BASKET_MIN_DEPTH_USD) ||
      !tokens.includes(row.address.toLowerCase()) || !tokens.includes(usdg.toLowerCase()) ||
      !dex.includes('uniswap') || !same(row.route.poolQuoteToken ?? '', usdg)) return []
    return [{ ...row, liquidityUsd }]
  })
}

export async function loadRhBasketStockPresets(signal?: AbortSignal): Promise<RhUsdStockCandidate[]> {
  // Briefly reuse completed depth reads when reopening the form; chain state
  // is still refreshed, and approval always performs an uncached depth check.
  const cached = depthCache && Date.now() - depthCache.at < 120_000 ? depthCache : undefined
  const fresh = cached ? cached.rows : await readRhStockDepth(rhUsdStockCandidates, signal)
  if (!cached && !signal?.aborted) depthCache = fresh.length ? { at: Date.now(), rows: fresh } : undefined
  if (signal?.aborted) throw new Error('RH_STOCK_DEPTH_UNAVAILABLE')
  const blockNumber = await getReadOnlyClient(4663).getBlockNumber()
  const errors = await validateBasketRoutes(fresh.map(row => ({ asset: row.address, route: row.route, poolId: row.poolId })), 4663, blockNumber)
  if (signal?.aborted) throw new Error('RH_STOCK_DEPTH_UNAVAILABLE')
  return selectRhUsdStockPresets(fresh.filter((_, i) => errors[i] === null))
}

/** Recheck selected recommendations before approval. Custom pools retain their
 * explicit user choice and normal on-chain validation. */
export async function assertRhRecommendedStockDepth(legs: { asset: { address: string }; route: BasketLegRoute }[]): Promise<void> {
  const selected = legs.flatMap(leg => {
    const poolId = poolIdentity({ ...leg.asset, route: leg.route } as BasketAssetPreset)
    const row = poolId && rhUsdStockCandidates.find(candidate => same(candidate.address, leg.asset.address) && same(candidate.poolId, poolId))
    return row ? [row] : []
  })
  if (!selected.length) return
  const fresh = await readRhStockDepth(selected)
  if (fresh.length !== selected.length) throw new Error('RH_STOCK_DEPTH_TOO_LOW')
}
