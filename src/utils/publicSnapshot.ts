const PREFIX = 'tagai-public-snapshot:v1:'
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

type Snapshot<T> = {
  savedAt: number
  data: T
}

/** Persist only public, user-independent display data for transient offline use. */
export function writePublicSnapshot<T>(scope: string, data: T) {
  try {
    const snapshot: Snapshot<T> = { savedAt: Date.now(), data }
    localStorage.setItem(PREFIX + scope, JSON.stringify(snapshot))
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
