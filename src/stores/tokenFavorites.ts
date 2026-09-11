import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAccountStore } from './web3'
import { useChainStore } from './chain'
import { favoriteRequest, type FavoriteToken } from '@/apis/tokenFavorites'

export const useTokenFavoritesStore = defineStore('tokenFavorites', () => {
  const accountStore = useAccountStore()
  const chainStore = useChainStore()
  const accountId = computed(() => String(accountStore.getAccountInfo?.twitterId || ''))
  const entries = ref<FavoriteToken[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const failed = ref(false)
  const pending = ref(new Set<string>())
  let generation = 0
  let revision = 0
  let loadedAt = 0
  let request: Promise<void> | undefined
  const key = (address: string) => address.toLowerCase()

  watch([accountId, () => chainStore.activeChainId], () => {
    generation++
    revision++
    entries.value = []
    loaded.value = loading.value = failed.value = false
    pending.value = new Set()
    loadedAt = 0
    request = undefined
  }, { flush: 'sync' })

  function load(force = false): Promise<void> {
    if (!accountId.value) return Promise.resolve()
    if (request) return request
    if (pending.value.size || (loaded.value && !force && Date.now() - loadedAt < 60_000)) return Promise.resolve()
    const current = generation
    const version = revision
    loading.value = true
    failed.value = false
    request = favoriteRequest<FavoriteToken[]>('list', accountId.value, chainStore.activeChainId)
      .then(rows => {
        if (current !== generation || version !== revision) return
        entries.value = rows
        loaded.value = true
        loadedAt = Date.now()
      }).catch(error => {
        if (current === generation) failed.value = true
        throw error
      }).finally(() => {
        if (current === generation) {
          loading.value = false
          request = undefined
        }
      })
    return request
  }

  const contains = (address: string) => entries.value.some(row => key(row.address) === key(address))
  const isPending = (address: string) => pending.value.has(key(address))

  async function toggle(token: FavoriteToken) {
    const current = generation
    const twitterId = accountId.value
    if (!twitterId || token.chainId !== chainStore.activeChainId || isPending(token.address)) return
    const address = key(token.address)
    // Resolve membership before toggling, including after a failed initial load.
    await load()
    if (current !== generation || isPending(address)) return
    pending.value.add(address)
    revision++
    const favorite = !contains(address)
    try {
      await favoriteRequest('set', twitterId, token.chainId, { ...token, address, favorite })
      if (current !== generation) return
      entries.value = entries.value.filter(row => key(row.address) !== address)
      if (favorite) entries.value.unshift({ ...token, address })
    } finally {
      if (current === generation) pending.value.delete(address)
    }
  }

  return { accountId, entries, loaded, loading, failed, contains, isPending, load, toggle }
})
