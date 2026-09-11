import { onScopeDispose, ref, watch } from 'vue'
import { isAddress, type Address } from 'viem'
import { getCommunityDetail, getEthPrice } from '@/apis/api'
import { getBasketPerformances } from '@/utils/baskets/api'
import { getBasketDetail } from '@/utils/baskets/data'
import { useTokenFavoritesStore } from '@/stores/tokenFavorites'
import { useChainStore } from '@/stores/chain'

const positive = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

/** USD market cap for communities; USD NAV per token for basket indices. */
export function useWatchlistMetrics() {
  const favorites = useTokenFavoritesStore()
  const chain = useChainStore()
  const values = ref<Record<string, number>>({})
  const key = (address: string) => address.toLowerCase()
  const scope = () => JSON.stringify([favorites.accountId, chain.activeChainId,
    favorites.entries.map(token => [token.chainId, key(token.address), token.kind, token.symbol])])
  let generation = 0
  let loadedAt = 0
  let pending: Promise<void> | undefined

  function refresh(force = false): Promise<void> {
    if (pending) return pending
    if (!favorites.accountId || (!force && Date.now() - loadedAt < 60_000)) return Promise.resolve()
    const current = generation
    const currentScope = scope()
    const chainId = chain.activeChainId
    const tokens = favorites.entries.filter(token => token.chainId === chainId && isAddress(token.address))
    if (!tokens.length) return Promise.resolve()
    const active = () => current === generation && currentScope === scope()
    const save = (address: string, value: unknown) => {
      const amount = positive(value)
      if (active() && amount !== undefined) values.value[key(address)] = amount
    }
    // Limit individual detail/RPC reads for larger watchlists. A failed token
    // does not block the remaining cards or replace an existing value with zero.
    const each = async <T>(rows: T[], read: (row: T) => Promise<void>) => {
      let index = 0
      await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
        while (active() && index < rows.length) {
          const row = rows[index++]!
          try { await read(row) } catch { /* Keep the last available value. */ }
        }
      }))
    }
    pending = (async () => {
      await Promise.allSettled([
        (async () => {
          const communities = tokens.filter(token => token.kind === 'community')
          if (!communities.length) return
          const nativeUsd = positive(await getEthPrice(chainId, true))
          if (!nativeUsd || !active()) return
          await each(communities, async token => {
            const community = await getCommunityDetail(token.symbol, chainId, true) as { token?: string; chainId?: number; marketCap?: number }
            if (community?.token?.toLowerCase() !== key(token.address)
              || (community.chainId != null && Number(community.chainId) !== chainId)) return
            const marketCap = positive(community.marketCap)
            if (marketCap) save(token.address, marketCap * nativeUsd)
          })
        })(),
        (async () => {
          const baskets = tokens.filter(token => token.kind === 'basket')
          if (!baskets.length) return
          const snapshots = await getBasketPerformances(baskets.map(token => token.address as Address), chainId).catch(() => [])
          const byAddress = new Map(snapshots.map(item => [key(item.address), item]))
          await each(baskets, async token => {
            const snapshot = byAddress.get(key(token.address))
            if (snapshot?.dataQuality === 'complete' && positive(snapshot.currentNav)) {
              save(token.address, snapshot.currentNav)
              return
            }
            // Match the index page's on-chain fallback when its NAV snapshot
            // is not ready. NAV is already USD and must not be multiplied by BNB.
            const detail = await getBasketDetail(token.address as Address, chainId, { force })
            if (detail.chainId === chainId && key(detail.address) === key(token.address) && detail.fullyPriced) {
              save(token.address, detail.navPerToken)
            }
          })
        })(),
      ])
    })().finally(() => {
      if (current === generation) {
        loadedAt = Date.now()
        pending = undefined
      }
    })
    return pending
  }

  watch(scope, () => {
    generation++
    loadedAt = 0
    pending = undefined
    values.value = {}
    void refresh()
  }, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { values, refresh }
}
