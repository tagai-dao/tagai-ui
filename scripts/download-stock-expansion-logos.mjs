// Cache the official PancakeSwap stock artwork locally so the selector does not
// depend on third-party image hosts at render time. Existing artwork is kept.
import { access, readFile, writeFile } from 'node:fs/promises'
const catalog = JSON.parse(await readFile(new URL('../src/utils/v13/creation-assets.json', import.meta.url), 'utf8'))
const pending = new Map()
for (const asset of catalog) {
  if (!asset.ticker || !['stock', 'etf'].includes(asset.assetType) || !asset.logoUrl.startsWith('/images/basket-assets/')) continue
  if (!/^[A-Z0-9]+$/.test(asset.ticker)) throw new Error(`Invalid ticker ${asset.ticker}`)
  pending.set(asset.ticker, asset)
}
for (const [ticker, asset] of pending) {
  const destination = new URL(`../public${asset.logoUrl}`, import.meta.url)
  if (await access(destination).then(() => true, () => false)) continue
  const source = `https://tokens.pancakeswap.finance/rwa/symbol-logos/${ticker}.png`
  const response = await fetch(source, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`${ticker}: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 100 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error(`${ticker}: source did not return a PNG`)
  }
  await writeFile(destination, bytes)
  console.log(`${ticker}: ${bytes.length} bytes`)
}
