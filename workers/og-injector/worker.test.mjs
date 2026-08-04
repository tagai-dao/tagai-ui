import test from 'node:test'
import assert from 'node:assert/strict'

import worker, { buildMetaRequest, matchOgRoute } from './worker.js'

test('matches chain-prefixed OG routes', () => {
  assert.deepEqual(matchOgRoute('/rh/tag-detail/RH-TAG'), {
    chainId: 4663,
    chainSlug: 'rh',
    type: 'tag',
    id: 'RH-TAG',
  })
  assert.deepEqual(matchOgRoute('/bsc/post-detail/123'), {
    chainId: 56,
    chainSlug: 'bsc',
    type: 'post',
    id: '123',
  })
})

test('keeps legacy routes as BSC aliases', () => {
  assert.deepEqual(matchOgRoute('/commerce/order%2F1'), {
    chainId: 56,
    chainSlug: 'bsc',
    type: 'commerce',
    id: 'order/1',
  })
})

test('does not match unrelated or incomplete paths', () => {
  assert.equal(matchOgRoute('/eth/tag-detail/ABC'), null)
  assert.equal(matchOgRoute('/rh/tag-detail'), null)
  assert.equal(matchOgRoute('/rh/create'), null)
})

test('forwards the chain through the API header and cache-key query', () => {
  const request = buildMetaRequest(matchOgRoute('/rh/commerce/42'))
  const url = new URL(request.url)

  assert.equal(url.searchParams.get('type'), 'commerce')
  assert.equal(url.searchParams.get('id'), '42')
  assert.equal(url.searchParams.get('chainId'), '4663')
  assert.equal(request.init.headers['X-Chain-Id'], '4663')
})

test('injects RH metadata into crawler responses', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    if (input instanceof Request) {
      return new Response('<html><head><title>Static</title></head><body></body></html>', {
        headers: { 'content-length': '61', 'content-type': 'text/html' },
      })
    }
    return Response.json({
      title: '$RH | TagAI',
      description: 'RH community',
      image: 'https://images.example/rh.png',
      url: 'https://tagai.fun/rh/tag-detail/RH',
    })
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  const response = await worker.fetch(new Request('https://tagai.fun/rh/tag-detail/RH', {
    headers: { 'user-agent': 'Twitterbot' },
  }))
  const html = await response.text()

  assert.equal(calls.length, 2)
  assert.equal(calls[1].init.headers['X-Chain-Id'], '4663')
  assert.match(html, /<meta property="og:url" content="https:\/\/tagai\.fun\/rh\/tag-detail\/RH">/)
  assert.doesNotMatch(html, /<title>Static<\/title>/)
  assert.equal(response.headers.get('content-length'), null)
})
