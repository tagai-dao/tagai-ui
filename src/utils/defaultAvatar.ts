export const DEFAULT_AVATAR_BACKGROUNDS = [
  'linear-gradient(145deg, #FFE2C7 0%, #FFB96F 100%)',
  'linear-gradient(145deg, #FFF0B8 0%, #FFD45E 100%)',
  'linear-gradient(145deg, #D8F5E6 0%, #86DDB3 100%)',
  'linear-gradient(145deg, #DCEEFF 0%, #8DC7FF 100%)',
  'linear-gradient(145deg, #E9E0FF 0%, #BCA7F7 100%)',
  'linear-gradient(145deg, #FFE0E9 0%, #F4A5BB 100%)',
  'linear-gradient(145deg, #D8F3F4 0%, #7CCED1 100%)',
  'linear-gradient(145deg, #E8E9ED 0%, #B9BDC8 100%)',
] as const

/** Keep an account's fallback color stable across pages and sessions. */
export function defaultAvatarBackground(seed?: string | number | null): string {
  const value = String(seed || 'tagai-default')
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return DEFAULT_AVATAR_BACKGROUNDS[(hash >>> 0) % DEFAULT_AVATAR_BACKGROUNDS.length]
}
