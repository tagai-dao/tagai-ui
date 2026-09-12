export interface AndroidRelease {
  versionCode: number
  versionName: string
  notes: string
  downloadUrl: string
}

// Only the first-party download host is trusted. No arbitrary manifest links.
export function parseAndroidRelease(value: unknown, installed: number): AndroidRelease | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v.enabled !== true || v.applicationId !== 'fun.tagai.app' ||
      !Number.isSafeInteger(installed) || installed < 1 ||
      typeof v.versionCode !== 'number' || !Number.isSafeInteger(v.versionCode) ||
      v.versionCode <= installed || typeof v.versionName !== 'string' ||
      !v.versionName.trim() || v.versionName.length > 40 ||
      typeof v.notes !== 'string' || v.notes.length > 4000 ||
      typeof v.downloadUrl !== 'string') return null
  try {
    const url = new URL(v.downloadUrl)
    if (url.origin !== 'https://tagai.fun' || url.username || url.password ||
        !url.pathname.startsWith('/downloads/') || !url.pathname.endsWith('.apk') ||
        url.search || url.hash) return null
    return { versionCode: v.versionCode, versionName: v.versionName, notes: v.notes, downloadUrl: url.href }
  } catch { return null }
}

export const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000
export const UPDATE_SNOOZE = 24 * 60 * 60 * 1000
