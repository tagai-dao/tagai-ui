/**
 * TagAI OG 注入 Worker（crawler-only）
 *
 * 部署到 tagai.fun 的 Cloudflare 路由上。
 * 普通用户请求原样透传；社交爬虫访问 /:chain/tag-detail/:id、
 * /:chain/post-detail/:id 或 /:chain/commerce/:id 时，
 * 向后端 /meta/og 取动态摘要，把 OG/Twitter meta 注入 index.html，
 * 让分享到 X / Telegram / Discord 的链接带预览卡。
 *
 * 状态：代码已就绪，未部署 —— 需要 Cloudflare zone 权限执行：
 *   cd workers/og-injector && npx wrangler deploy
 */

const META_API = 'https://bsc-api.tagai.fun/meta/og'
const DEFAULT_CHAIN_SLUG = 'bsc'
const CHAIN_IDS = Object.freeze({ bsc: 56, rh: 4663 })
const ACTIONS_PATH = '/actions.json'
const ACTIONS_CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-blockchain-ids, x-action-version',
  'Access-Control-Max-Age': '86400',
})

const CRAWLER_UA = /twitterbot|facebookexternalhit|telegrambot|discordbot|slackbot|linkedinbot|whatsapp|line-podcast|skypeuripreview|embedly|pinterestbot|redditbot|googlebot|bingbot/i

const ROUTE_PATTERN = /^\/(?:(bsc|rh)\/)?(tag-detail|post-detail|commerce)\/([^/]+)(?:\/|$)/
const ROUTE_TYPES = Object.freeze({
  'tag-detail': 'tag',
  'post-detail': 'post',
  commerce: 'commerce',
})

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function matchOgRoute(pathname) {
  const match = pathname.match(ROUTE_PATTERN)
  if (!match) return null

  const chainSlug = match[1] || DEFAULT_CHAIN_SLUG
  return {
    chainId: CHAIN_IDS[chainSlug],
    chainSlug,
    type: ROUTE_TYPES[match[2]],
    id: decodePathSegment(match[3]),
  }
}

export function buildMetaRequest(route) {
  const url = new URL(META_API)
  url.searchParams.set('type', route.type)
  url.searchParams.set('id', route.id)
  // chainId also splits Cloudflare's cache key; the API gateway routes by header.
  url.searchParams.set('chainId', String(route.chainId))

  return {
    url: url.toString(),
    init: {
      headers: { 'X-Chain-Id': String(route.chainId) },
      cf: { cacheTtl: 60 },
    },
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function buildMetaTags(meta) {
  const title = escapeHtml(meta.title)
  const desc = escapeHtml(meta.description)
  const image = escapeHtml(meta.image)
  const url = escapeHtml(meta.url)
  return [
    `<title>${title}</title>`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join('\n    ')
}

// 去掉静态 index.html 里写死的同名 meta / title，避免爬虫读到两份
function stripStaticMeta(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:name|property)="(?:og:title|og:description|og:image|og:url|og:type|twitter:title|twitter:description|twitter:image|twitter:card)"[^>]*>\s*/gi, '')
}

function withActionsCors(response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(ACTIONS_CORS_HEADERS)) {
    headers.set(name, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request) {
    const ua = request.headers.get('user-agent') || ''
    const url = new URL(request.url)

    if (url.pathname === ACTIONS_PATH) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: ACTIONS_CORS_HEADERS })
      }
      return withActionsCors(await fetch(request))
    }

    if (request.method !== 'GET' || !CRAWLER_UA.test(ua)) {
      return fetch(request)
    }

    const route = matchOgRoute(url.pathname)
    if (!route) {
      return fetch(request)
    }

    const metaRequest = buildMetaRequest(route)

    const [origin, metaResp] = await Promise.all([
      fetch(request),
      fetch(metaRequest.url, metaRequest.init).catch(() => null),
    ])

    if (!metaResp || !metaResp.ok) {
      return origin
    }
    const meta = await metaResp.json().catch(() => null)
    if (!meta?.title) {
      return origin
    }

    const html = await origin.text()
    const injected = stripStaticMeta(html).replace(
      /<head>/i,
      `<head>\n    ${buildMetaTags(meta)}`
    )
    const headers = new Headers(origin.headers)
    headers.delete('content-length')
    return new Response(injected, {
      status: origin.status,
      headers,
    })
  },
}
