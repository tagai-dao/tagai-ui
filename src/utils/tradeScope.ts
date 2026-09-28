// Kept-alive community views still observe the global route after navigation.
// Only token routes may use route.params.id as a ticker; embedded trade sheets
// carry their own explicit ticker on post/profile/feed routes.
export function resolveTradeTick(explicitTick: unknown, route: { name?: unknown; params: { id?: unknown } }): string | null {
  if (typeof explicitTick === 'string' && explicitTick.trim()) return explicitTick
  if (!['tag-detail', 'buy-sell'].includes(String(route.name))) return null
  return typeof route.params.id === 'string' && route.params.id.trim() ? route.params.id : null
}
