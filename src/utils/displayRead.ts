type Entry = { data: unknown; savedAt: number; updatedAt: string; stale: boolean }
export type ReadStatus = { key: string; path: string; chainId: number; pending: boolean; failed: boolean; stale: boolean; updatedAt?: string; touchedAt: number; backgroundComplete?: boolean }
export const displayReadStatus = new Map<string, ReadStatus>()
const eventName = 'tagai:display-read'
const publish = (status: ReadStatus) => {
  displayReadStatus.set(status.key, status)
  while (displayReadStatus.size > 200) displayReadStatus.delete(displayReadStatus.keys().next().value!)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(eventName, { detail: status }))
}

function preparingRetryDelay(error: unknown): number | undefined {
  const response = (error as { response?: { status?: number; data?: { code?: string; retryAfter?: number }; headers?: Record<string, unknown> } })?.response
  if (response?.status !== 503 || response.data?.code !== 'PAGE_PREPARING') return undefined
  const seconds = Number(response.headers?.['retry-after'] ?? response.data.retryAfter ?? 5)
  return (Number.isFinite(seconds) ? Math.min(10, Math.max(1, seconds)) : 5) * 1000
}

/** Display-only SWR. Never call this for balances, quotes, signatures or writes. */
export function createDisplayReader(
  fetcher: (path: string, query: Record<string, unknown>, chainId: number) => Promise<{ data: unknown; updatedAt?: string; stale?: boolean }>,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
) {
  const entries = new Map<string, Entry>(), pending = new Map<string, Promise<unknown>>()
  let active = 0
  const queue: Array<() => void> = []
  const clone = <T>(data: T): T => structuredClone(data)
  const run = async <T>(work: () => Promise<T>) => {
    if (active >= 4) await new Promise<void>((resolve, reject) => {
      const start = () => { clearTimeout(timer); resolve() }
      // A cold network request may take 10 seconds. Allow queued tabs to wait
      // for capacity instead of failing before the first requests can finish.
      const timer = setTimeout(() => { const i = queue.indexOf(start); if (i >= 0) queue.splice(i, 1); reject(new Error('Page request queue timed out')) }, 30000)
      queue.push(start)
    })
    active++
    try { return await work() } finally { active--; queue.shift()?.() }
  }
  const fetchWithRetry = async (path: string, query: Record<string, unknown>, chainId: number) => {
    for (let attempt = 0; ; attempt++) {
      try { return await run(() => fetcher(path, query, chainId)) }
      catch (error) {
        const delay = preparingRetryDelay(error)
        if (attempt >= 2 || delay === undefined) throw error
        // Keep same-key reads coalesced, but release network capacity while
        // the backend prepares its snapshot. Never retry indefinitely.
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  const read = async (path: string, query: Record<string, unknown>, chainId: number, freshMs = 30000) => {
    const sorted = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)))
    const key = `${chainId}:${path}:${JSON.stringify(sorted)}`
    // Viewer-specific feed annotations stay in memory and never in shared or
    // persistent browser storage. Account IDs are part of the memory key.
    const persist = !sorted.twitterId && !sorted.accountId && !sorted.ethAddr
    const storageKey = 'tagai-display:v1:' + key
    const status: ReadStatus = { key, path, chainId, pending: false, failed: false, stale: false, touchedAt: Date.now() }
    let hit = entries.get(key)
    if (!hit && persist) {
      try { const raw = storage?.getItem(storageKey); if (raw) hit = JSON.parse(raw) } catch (_) { /* private/storage-full mode */ }
    }
    if (hit && (!Number.isFinite(hit.savedAt) || Date.now() - hit.savedAt > 86400000)) hit = undefined
    const refresh = () => {
      if (!pending.has(key)) {
        publish({ ...status, pending: true, stale: !!hit, updatedAt: hit?.updatedAt })
        const task = fetchWithRetry(path, sorted, chainId).then(result => {
          const entry = { data: clone(result.data), savedAt: Date.now(), updatedAt: result.updatedAt || new Date().toISOString(), stale: !!result.stale }
          entries.set(key, entry)
          while (entries.size > 150) {
            const oldest = entries.keys().next().value!
            entries.delete(oldest)
            try { storage?.removeItem('tagai-display:v1:' + oldest) } catch (_) {}
          }
          if (persist) { try { storage?.setItem(storageKey, JSON.stringify(entry)) } catch (_) {} }
          publish({ ...status, stale: entry.stale, updatedAt: entry.updatedAt, backgroundComplete: !!hit && Number(sorted.page ?? sorted.pages ?? 0) === 0 })
          return clone(entry.data)
        }).catch(error => {
          publish({ ...status, failed: true, stale: !!hit, updatedAt: hit?.updatedAt })
          // Mark display failures for silent handling; trading errors remain untouched.
          if (error && typeof error === 'object') error.displayRead = true
          throw error
        }).finally(() => pending.delete(key))
        pending.set(key, task)
      }
      return pending.get(key)!.then(clone)
    }
    if (hit) {
      entries.set(key, hit)
      publish({ ...status, stale: hit.stale || Date.now() - hit.savedAt >= freshMs, updatedAt: hit.updatedAt })
      if (Date.now() - hit.savedAt >= freshMs) void refresh().catch(() => {})
      return clone(hit.data)
    }
    return refresh()
  }
  return Object.assign(read, { invalidate(paths: string[], chainId: number) {
    for (const [key, status] of displayReadStatus) {
      if (status.chainId === chainId && paths.some(path => status.path.startsWith(path))) {
        entries.delete(key)
        try { storage?.removeItem('tagai-display:v1:' + key) } catch (_) {}
      }
    }
  } })
}

export const DISPLAY_READ_EVENT = eventName
