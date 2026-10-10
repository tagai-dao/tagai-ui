import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const bsc = JSON.parse(await readFile('src/utils/v13/creation-assets.json', 'utf8'))
const rh = JSON.parse(await readFile('src/utils/v14/rh-creation-assets.json', 'utf8'))
const display = JSON.parse(await readFile('src/utils/v14/rh-display-stock-assets.json', 'utf8'))
const dir = await mkdtemp(join(tmpdir(), 'stock-logos-'))
await build({ stdin: { contents: "export * from './src/utils/baskets/logos.ts'; export * from './src/utils/communityLogo.ts'", resolveDir: process.cwd() }, alias: { '@': join(process.cwd(), 'src') },
  bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'logos.cjs'),
  define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const { presetBasketAssetLogo, resolveBasketAssetLogo, getCommunityLogoUrl } = createRequire(import.meta.url)(join(dir, 'logos.cjs'))
after(() => rm(dir, { recursive: true, force: true }))

test('RH and BSC stock/ETF contracts for the same company share artwork, including ticker aliases', () => {
  const company = asset => asset.ticker ?? ({ RDDTB: 'RDDT' })[asset.symbol]
  const canonical = new Map(bsc.filter(company).map(a => [company(a), a.logoUrl]))
  let shared = 0
  for (const asset of rh) {
    const ticker = asset.ticker === 'SKYHY' ? 'SKHY' : asset.ticker
    if (!canonical.has(ticker)) continue
    assert.equal(asset.logoUrl, canonical.get(ticker), ticker)
    shared++
  }
  assert.ok(shared >= 20)
  assert.equal(rh.find(a => a.ticker === 'SKYHY').logoUrl, canonical.get('SKHY'))
  assert.equal(rh.find(a => a.ticker === 'RDDT').logoUrl, canonical.get('RDDT'))
})
test('every approved RH asset resolves by chain and address without issuer artwork or token-logo fetch', async () => {
  assert.equal(rh.length, 52)
  for (const asset of rh) {
    assert.equal(presetBasketAssetLogo(4663, asset.address.toUpperCase()), asset.logoUrl)
    assert.equal(await resolveBasketAssetLogo(4663, asset.address), asset.logoUrl)
    assert.doesNotMatch(asset.logoUrl, /coingecko|robinhood/i)
    assert.equal(presetBasketAssetLogo(56, asset.address), null)
  }
  for (const asset of bsc) assert.equal(presetBasketAssetLogo(56, asset.address), asset.logoUrl)
})
test('all locally referenced company logos are shipped as valid image assets', async () => {
  for (const asset of [...rh, ...display]) {
    if (!asset.logoUrl.startsWith('/images/')) continue
    const bytes = await readFile(`public${asset.logoUrl}`)
    if (asset.logoUrl.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.ticker)
    else assert.match(bytes.toString(), /<svg\b/, asset.ticker)
  }
})
test('stock community cards override issuer/custom pictures by contract identity and preserve ordinary communities', () => {
  const apple = rh.find(a => a.ticker === 'AAPL')
  const identity = { chainId: 4663, token: apple.address.toUpperCase() }
  assert.equal(getCommunityLogoUrl('https://example.com/robinhood.png', 200, identity), apple.logoUrl)
  assert.equal(getCommunityLogoUrl('', 200, identity), apple.logoUrl)
  const custom = 'https://example.com/community.png'
  assert.equal(getCommunityLogoUrl(custom, 200, { chainId: 56, token: apple.address }), custom)
  assert.equal(getCommunityLogoUrl(custom, 200, { chainId: 4663, token: '0x' + 'ab'.repeat(20), tick: 'AAPL' }), custom)
  assert.equal(getCommunityLogoUrl('https://tiptag.oss-cn-shenzhen.aliyuncs.com/meme.png'), 'https://tiptag.oss-cn-shenzhen.aliyuncs.com/meme.png?x-oss-process=image/resize,w_200')
})
test('display-only historical stock/ETF addresses have artwork without changing V14 creation eligibility', () => {
  assert.equal(display.length, 8)
  const approved = new Set(rh.map(a => a.address.toLowerCase()))
  for (const asset of display) {
    assert.equal(approved.has(asset.address.toLowerCase()), false)
    assert.equal(getCommunityLogoUrl(null, 200, { chainId: 4663, token: asset.address }), asset.logoUrl)
    assert.equal(presetBasketAssetLogo(4663, asset.address), asset.logoUrl)
  }
  assert.equal(rh.length, 52)
})
