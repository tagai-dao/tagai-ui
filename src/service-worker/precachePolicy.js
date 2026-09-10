// A Pages/CDN fallback can return index.html with HTTP 200 for a missing asset.
// Workbox's default status-only check would permanently cache it as JavaScript.
export function usablePrecacheResponse(request, response) {
  if (!response || !response.ok) return null
  const path = new URL(request.url).pathname
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (/\.(?:m?js)$/.test(path) && !/^(?:application|text)\/(?:x-)?(?:java|ecma)script$/.test(mime)) return null
  if (/\.css$/.test(path) && mime !== 'text/css') return null
  if (/\.html$/.test(path) && mime !== 'text/html') return null
  if (!/\.html$/.test(path) && mime === 'text/html') return null
  return response
}

export const validatedPrecachePlugin = {
  // Revalidate even hashed URLs when migrating from a poisoned HTTP cache.
  requestWillFetch: async ({ request }) => new Request(request, { cache: 'reload' }),
  cacheWillUpdate: async ({ request, response }) => usablePrecacheResponse(request, response),
  cachedResponseWillBeUsed: async ({ request, cachedResponse }) => usablePrecacheResponse(request, cachedResponse),
}

// Only app navigations use the cached shell. Keep assets, endpoints and the
// native OAuth trampoline out of the SPA fallback.
export const navigationDenylist = [
  /^\/(?:assets|api|\.well-known)(?:\/|$)/,
  /^\/[^/?]+\.(?:html|js|css|json|webmanifest|ico|png|svg|txt|xml)(?:\?|$)/,
]
