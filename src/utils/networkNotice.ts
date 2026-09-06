export function isNetworkFailure(message: unknown): boolean {
  return typeof message === 'string' && (
    /^network error$/i.test(message.trim()) ||
    /^timeout of \d+ms exceeded$/i.test(message.trim()) ||
    /^(failed to fetch|load failed)$/i.test(message.trim())
  )
}

/** One visible connectivity notice across concurrent requests and components. */
export function createNetworkNoticeGate(now = Date.now, cooldown = 15000) {
  let active = false
  let lastShown = -Infinity
  return {
    acquire() {
      if (active || now() - lastShown < cooldown) return false
      active = true
      lastShown = now()
      return true
    },
    release() { active = false },
  }
}
