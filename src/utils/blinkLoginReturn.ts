const KEY = 'tagai-blink-login-return'
const TTL = 20 * 60 * 1000
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
function stores(): Store[] {
  const result: Store[] = []
  try { result.push(window.sessionStorage) } catch { /* restricted browser */ }
  try { result.push(window.localStorage) } catch { /* restricted browser */ }
  return result
}

/** Only product-local content destinations; never persist OAuth parameters or external redirects. */
export function safeBlinkReturn(path: unknown): string | null {
  if (typeof path !== 'string' || path.length > 2000 || !/^\/(bsc|rh)\/(commerce|post-detail|space-detail|tag-detail|buy-sell)\/[^/?#]+/.test(path) || /[\\\r\n]/.test(path)) return null
  try {
    const url = new URL(path, 'https://tagai.fun')
    if (url.origin !== 'https://tagai.fun' || /%(?:2f|5c|2e)/i.test(url.pathname)) return null
    if (!/^\/(bsc|rh)\/(commerce|post-detail|space-detail|tag-detail|buy-sell)\/[^/]+$/.test(url.pathname)) return null
    const query = new URLSearchParams()
    for (const key of ['blink', 'preview']) {
      const value = url.searchParams.get(key)
      if (value && value.length <= 200) query.set(key, value)
    }
    return url.pathname + (query.size ? `?${query}` : '')
  } catch { return null }
}

/** Called only when a user starts a different login, not on mount/resume:
 * Android OAuth remounts must keep the pending Blinks destination. */
export function clearBlinkLoginReturn(storage = stores()): void {
  for (const store of storage) {
    try { store.removeItem(KEY) } catch { /* restricted browser */ }
  }
}

export function saveBlinkLoginReturn(path: string, storage = stores(), now = Date.now()): boolean {
  clearBlinkLoginReturn(storage)
  const safe = safeBlinkReturn(path)
  if (!safe) return false
  let saved = false
  for (const store of storage) {
    try { store.setItem(KEY, JSON.stringify({ path: safe, createdAt: now })); saved = true } catch { /* try next store */ }
  }
  return saved
}
export function takeBlinkLoginReturn(storage = stores(), now = Date.now()): string | null {
  let result: string | null = null
  for (const store of storage) {
    try {
      const saved = JSON.parse(store.getItem(KEY) || 'null')
      store.removeItem(KEY)
      if (!result && saved && Number.isFinite(saved.createdAt) && now >= saved.createdAt && now - saved.createdAt <= TTL) result = safeBlinkReturn(saved.path)
    } catch { /* malformed or unavailable storage */ }
  }
  return result
}
