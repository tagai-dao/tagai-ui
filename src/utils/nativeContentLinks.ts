const ORIGIN = 'https://tagai.fun'

/** Content navigation only: never accept OAuth, arbitrary hosts or API URLs. */
export function nativeContentPath(value: string): string | null {
  try {
    if (value.length > 8192) return null
    let url = new URL(value)
    if (url.protocol === 'tagai:' && url.host === 'open' &&
        !url.username && !url.password && !url.hash && !url.pathname &&
        url.searchParams.getAll('url').length === 1) {
      url = new URL(url.searchParams.get('url')!)
    }
    if (url.origin !== ORIGIN || url.username || url.password) return null
    // Encoded separators can turn a harmless-looking path into another route.
    if (/%(?:2f|5c|00)/i.test(url.pathname) || /[\\\x00-\x1f]/.test(decodeURIComponent(url.pathname))) return null
    const route = url.pathname.replace(/^\/(?:bsc|rh)(?=\/|$)/, '') || '/'
    if (!/^\/(?:commerce|tag-detail|buy-sell|post-detail|space-detail|user)\/[^/]+(?:\/[^/]+)?\/?$/.test(route)) return null
    if ([...url.searchParams.keys()].some(key => /^privy_oauth_|^(?:access_token|id_token|refresh_token)$/i.test(key))) return null
    return url.pathname + url.search + url.hash
  } catch { return null }
}

export function androidContentIntent(value: string): string | null {
  const path = nativeContentPath(value)
  if (!path) return null
  const target = ORIGIN + path
  return `intent://open?url=${encodeURIComponent(target)}#Intent;scheme=tagai;package=fun.tagai.app;S.browser_fallback_url=${encodeURIComponent(target)};end`
}
