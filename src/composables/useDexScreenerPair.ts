import { computed, ref, watch } from 'vue'

type Pair = {
  chainId: string
  pairAddress: string
  baseToken: { address: string }
  liquidity?: { usd?: number }
  priceChange?: Record<string, number>
}

/** Only embed a market confirmed by DexScreener; otherwise use our candles. */
export function useDexScreenerPair(options: () => {
  chain: string
  token?: string
  preferred?: string
  enabled: boolean
}) {
  const pair = ref<Pair | null>(null)
  const embedFailed = ref(false)
  const useDexScreener = computed(() => !!pair.value && !embedFailed.value)

  watch(options, ({ chain, token, preferred, enabled }, _, cleanup) => {
    pair.value = null
    embedFailed.value = false
    if (!enabled || !token) return
    let disposed = false
    let controller: AbortController | undefined
    async function refresh() {
      if (controller) return
      const request = new AbortController()
      controller = request
      const timeout = setTimeout(() => request.abort(), 10000)
      try {
        const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chain}/${token}`, { signal: request.signal })
        if (!response.ok) throw new Error('Market data unavailable')
        const rows: unknown = await response.json()
        const eligible: Pair[] = Array.isArray(rows) ? rows.filter(p =>
          p?.chainId === chain && typeof p.pairAddress === 'string' && p.pairAddress.trim()
          && typeof p.baseToken?.address === 'string' && p.baseToken.address.toLowerCase() === token!.toLowerCase()) : []
        const next = eligible.find(p => p.pairAddress.toLowerCase() === preferred?.toLowerCase())
          || eligible.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] || null
        if (!disposed) pair.value = next
      } catch {
        if (!disposed) pair.value = null
      } finally {
        clearTimeout(timeout)
        controller = undefined
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 60000)
    cleanup(() => { disposed = true; clearInterval(timer); controller?.abort() })
  }, { immediate: true, flush: 'sync' })

  return { pair, useDexScreener, onEmbedError: () => { embedFailed.value = true } }
}
