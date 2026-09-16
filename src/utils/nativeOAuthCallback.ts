/** OAuth returns use a separate strict parser from ordinary content links. */
export const NATIVE_OAUTH_REDIRECT_URL = 'https://tagai.fun/native-oauth-redirect'

export function nativeOAuthCallbackPath(value: string): string | null {
  try {
    const url = new URL(value)
    const legacy = url.protocol === 'tagai:' && url.host === 'auth-callback' &&
      (url.pathname === '' || url.pathname === '/')
    const verified = url.origin === 'https://tagai.fun' &&
      ['/native-oauth-redirect', '/native-oauth-redirect.html'].includes(url.pathname)
    if ((!legacy && !verified) || url.username || url.password) return null
    const params = url.searchParams
    const keys = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider']
    if (keys.some(key => params.getAll(key).length > 1)) return null
    if (!params.get('privy_oauth_state') || params.get('privy_oauth_provider') !== 'twitter') return null
    if (!params.get('privy_oauth_code')) return null
    const safe = new URLSearchParams()
    for (const key of keys) {
      const value = params.get(key)
      if (value) safe.set(key, value)
    }
    // Keep PKCE/state verification in Privy. Never copy tokens or arbitrary routing params.
    return `/callback?${safe}`
  } catch {
    return null
  }
}
