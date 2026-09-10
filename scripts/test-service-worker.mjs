import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { validatedPrecachePlugin as plugin, navigationDenylist } from '../src/service-worker/precachePolicy.js'

const request = path => new Request(`https://tagai.fun${path}`)
const response = (mime, status = 200) => new Response('body', { status, headers: { 'content-type': mime } })

test('HTML fallbacks cannot poison script, stylesheet or image precaches', async () => {
  for (const path of ['/assets/rhV4Swap-ahM51Hmh.js', '/assets/index.css', '/favicon.ico']) {
    assert.equal(await plugin.cacheWillUpdate({ request: request(path), response: response('text/html') }), null)
    assert.equal(await plugin.cachedResponseWillBeUsed({ request: request(path), cachedResponse: response('text/html') }), null)
  }
})
test('valid release assets and index remain cacheable; failures do not', async () => {
  for (const [path, mime] of [['/assets/index.js', 'application/javascript; charset=utf-8'], ['/assets/main.mjs', 'text/javascript'], ['/assets/main.css', 'text/css'], ['/index.html', 'text/html'], ['/logo.svg', 'image/svg+xml']]) {
    const valid = response(mime)
    assert.equal(await plugin.cacheWillUpdate({ request: request(path), response: valid }), valid)
    assert.equal(await plugin.cachedResponseWillBeUsed({ request: request(path), cachedResponse: valid }), valid)
    assert.equal(await plugin.cacheWillUpdate({ request: request(path), response: response(mime, 404) }), null)
  }
})
test('precache fetch revalidates old HTTP responses without altering URLs', async () => {
  const original = request('/assets/index.js')
  const fetched = await plugin.requestWillFetch({ request: original })
  assert.equal(fetched.cache, 'reload')
  assert.equal(fetched.url, original.url)
})

// Run the real worker entry with stubbed Workbox boundaries: verify the route
// uses the release's precached shell and validation precedes precaching.
const built = await build({
  stdin: { contents: readFileSync('public/sw.js', 'utf8'), resolveDir: `${process.cwd()}/public`, sourcefile: 'sw.js', loader: 'js' },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'workbox-test', setup(build) {
    build.onResolve({ filter: /^workbox-/ }, args => ({ path: args.path, namespace: 'mock' }))
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      const f = globalThis.swFixture;
      export const setCacheNameDetails = value => f.cacheDetails = value;
      export const addPlugins = value => f.plugins = value;
      export const cleanupOutdatedCaches = () => {};
      export const precacheAndRoute = () => { if (!f.plugins?.length) throw Error('Missing validation'); };
      export const createHandlerBoundToURL = url => () => f.cached[url];
      export const registerRoute = route => f.routes.push(route);
      export class NavigationRoute { constructor(handler, options) { this.handler=handler; this.options=options; } }
    `, loader: 'js' }))
  } }],
})
test('root and chain-prefixed refreshes use the same release shell, while assets and OAuth bypass it', async () => {
  const previousSelf = globalThis.self
  globalThis.self = { __WB_MANIFEST: [], addEventListener() {} }
  globalThis.swFixture = { routes: [], cached: { '/index.html': 'release-A' } }
  try {
    await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
    const f = globalThis.swFixture
    assert.equal(f.cacheDetails.prefix, 'tagai-validated-v1')
    assert.equal(f.routes.length, 1)
    const route = f.routes[0]
    for (const path of ['/', '/bsc', '/rh', '/bsc/baskets/0x123', '/rh/tag-detail/TAG?referee=alice']) {
      assert.equal(route.options.denylist.some(rule => rule.test(path)), false)
      assert.equal(await route.handler({ request: request(path) }), 'release-A')
    }
    for (const path of ['/assets/main.js', '/api/foo', '/.well-known/test', '/native-oauth-redirect.html', '/actions.json', '/sw.js', '/manifest.webmanifest']) {
      assert.equal(navigationDenylist.some(rule => rule.test(path)), true, path)
    }
  } finally {
    globalThis.self = previousSelf
    delete globalThis.swFixture
  }
})
