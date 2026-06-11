/**
 * TagAI OG 注入 Worker（crawler-only）
 *
 * 部署到 tagai.fun 的 Cloudflare 路由上（zone worker route: tagai.fun/*）。
 * 普通用户请求原样透传；社交爬虫访问 /tag-detail/:id 或 /post-detail/:id 时，
 * 向后端 /meta/og 取动态摘要，把 OG/Twitter meta 注入 index.html，
 * 让分享到 X / Telegram / Discord 的链接带预览卡。
 *
 * 状态：代码已就绪，未部署 —— 需要 Cloudflare zone 权限执行：
 *   cd workers/og-injector && npx wrangler deploy
 */

const META_API = 'https://bsc-api.tagai.fun/meta/og'

const CRAWLER_UA = /twitterbot|facebookexternalhit|telegrambot|discordbot|slackbot|linkedinbot|whatsapp|line-podcast|skypeuripreview|embedly|pinterestbot|redditbot|googlebot|bingbot/i

const ROUTE_PATTERNS = [
  { regex: /^\/tag-detail\/([^/]+)/, type: 'tag' },
  { regex: /^\/post-detail\/([^/]+)/, type: 'post' },
]

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

export default {
  async fetch(request, env, ctx) {
    const ua = request.headers.get('user-agent') || ''
    const url = new URL(request.url)

    if (request.method !== 'GET' || !CRAWLER_UA.test(ua)) {
      return fetch(request)
    }

    const match = ROUTE_PATTERNS
      .map((p) => ({ ...p, m: url.pathname.match(p.regex) }))
      .find((p) => p.m)
    if (!match) {
      return fetch(request)
    }

    const [origin, metaResp] = await Promise.all([
      fetch(request),
      fetch(`${META_API}?type=${match.type}&id=${encodeURIComponent(match.m[1])}`, {
        cf: { cacheTtl: 60 },
      }).catch(() => null),
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
    return new Response(injected, {
      status: origin.status,
      headers: origin.headers,
    })
  },
}
