type PagesContext = { request: Request; env: { ASSETS: Fetcher } }

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  const shell = await env.ASSETS.fetch(new URL('/index.html', request.url))
  const headers = new Headers(shell.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('Referrer-Policy', 'no-referrer')
  return new Response(shell.body, { status: shell.status, headers })
}
