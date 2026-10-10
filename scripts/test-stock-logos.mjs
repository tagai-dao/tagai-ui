import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const bsc = JSON.parse(await readFile('src/utils/v13/creation-assets.json', 'utf8'))
const rh = JSON.parse(await readFile('src/utils/v14/rh-creation-assets.json', 'utf8'))
const dir = await mkdtemp(join(tmpdir(), 'stock-logos-'))
await build({ entryPoints: ['src/utils/baskets/logos.ts'], alias: { '@': join(process.cwd(), 'src') },
  bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'logos.cjs'),
  define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const { presetBasketAssetLogo, resolveBasketAssetLogo } = createRequire(import.meta.url)(join(dir, 'logos.cjs'))
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
  for (const asset of rh) {
    if (!asset.logoUrl.startsWith('/images/')) continue
    const bytes = await readFile(`public${asset.logoUrl}`)
    if (asset.logoUrl.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.ticker)
    else assert.match(bytes.toString(), /<svg\b/, asset.ticker)
  }
})
