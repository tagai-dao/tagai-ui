const EXTERNAL_PROFILE_PAGE_PATTERNS = [
  /^https?:\/\/(?:www\.)?fomo\.family\/profile(?:\/|$)/i,
  /^https?:\/\/(?:www\.)?pump\.fun\/profile(?:\/|$)/i,
]

/** Return only URLs that can reasonably be rendered by an <img>. */
export function normalizeAvatarImageUrl(value?: string | null): string {
  const url = String(value || '').trim()
  if (!url || EXTERNAL_PROFILE_PAGE_PATTERNS.some(pattern => pattern.test(url))) return ''
  if (/^javascript:/i.test(url)) return ''
  // Ask X for a useful avatar size without modifying unrelated URL text.
  if (/^https?:\/\/pbs\.twimg\.com\//i.test(url)) {
    return url.replace(/_normal(?=\.[a-z0-9]+(?:\?|$))/i, '_200x200')
  }
  return url
}
