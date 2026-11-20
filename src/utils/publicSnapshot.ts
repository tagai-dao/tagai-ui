const PREFIX = 'tagai-public-snapshot:v1:'
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

type Snapshot<T> = {
  savedAt: number
  data: T
}

// Keep public display data within 512 Ki UTF-16 code units across all scopes.
const MAX_CACHE_CHARS = 512 * 1024

function snapshotKeys() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  return keys
}

export function isStorageQuotaError(error: unknown) {
  const e = error as { name?: string; message?: string } | null
  return e?.name === 'QuotaExceededError' || /exceeded the quota|quota exceeded/i.test(String(e?.message ?? error))
}

export function clearPublicSnapshots() {
  try {
    for (const key of snapshotKeys()) localStorage.removeItem(key)
  } catch { /* Storage can also be disabled by browser policy. */ }
}

export function prepareLoginStorage() {
  // Probe on the TagAI origin before Privy mounts, including on OAuth return.
  const key = 'tagai:login-storage-probe'
  try {
    localStorage.setItem(key, '0'.repeat(32768))
    localStorage.removeItem(key)
  } catch (error) {
    if (isStorageQuotaError(error)) {
      clearPublicSnapshots()
    }
  }
}

/** Persist only public, user-independent display data for transient offline use. */
export function writePublicSnapshot<T>(scope: string, data: T) {
  try {
    const snapshot: Snapshot<T> = { savedAt: Date.now(), data }
    const key = PREFIX + scope
    const value = JSON.stringify(snapshot)
    if (key.length + value.length > MAX_CACHE_CHARS) return
    const keys = snapshotKeys().filter(k => k !== key)
    let used = key.length + value.length
    for (const k of keys) used += k.length + (localStorage.getItem(k)?.length ?? 0)
    for (const k of keys) {
      if (used <= MAX_CACHE_CHARS) break
      used -= k.length + (localStorage.getItem(k)?.length ?? 0)
      localStorage.removeItem(k)
    }
    localStorage.setItem(key, value)
  } catch {
    // Storage may be unavailable/private or full; live data still works.
  }
}

export function readPublicSnapshot<T>(scope: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + scope)
    if (!raw) return null
    const snapshot = JSON.parse(raw) as Snapshot<T>
    if (!snapshot || !Number.isFinite(snapshot.savedAt) || Date.now() - snapshot.savedAt > maxAgeMs) {
      localStorage.removeItem(PREFIX + scope)
      return null
    }
    return structuredClone(snapshot.data)
  } catch {
    return null
  }
}
