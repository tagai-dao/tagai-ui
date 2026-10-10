// RH stocks use the same company artwork as BSC; only cache missing RH-only logos.
import { access, readFile, writeFile } from 'node:fs/promises'
const catalog = [
  ...JSON.parse(await readFile(new URL('../src/utils/v14/rh-creation-assets.json', import.meta.url), 'utf8')),
  ...JSON.parse(await readFile(new URL('../src/utils/v14/rh-display-stock-assets.json', import.meta.url), 'utf8')),
]
const missing = []
for (const asset of catalog) {
  if (!asset.logoUrl.startsWith('/images/basket-assets/')) continue
  const destination = new URL(`../public${asset.logoUrl}`, import.meta.url)
  if (await access(destination).then(() => true, () => false)) continue
  if (!/^[A-Z0-9]+$/.test(asset.ticker)) throw new Error(`Invalid ticker ${asset.ticker}`)
  const sources = [
    ...(asset.ticker === 'SKYHY' ? ['https://www.skhynix.com.cn/images/prCi.png'] : []),
    `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${asset.ticker}.png`,
    `https://assets.parqet.com/logos/symbol/${asset.ticker}?format=png`,
    `https://financialmodelingprep.com/image-stock/${asset.ticker}.png`,
  ]
  let downloaded = false
  for (const source of sources) {
    const response = await fetch(source, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) continue
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 100 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) continue
    await writeFile(destination, bytes)
    console.log(`${asset.ticker}: ${bytes.length} bytes (${source})`)
    downloaded = true
    break
  }
  if (!downloaded) missing.push(asset.ticker)
}
if (missing.length) throw new Error(`Company logos unavailable: ${missing.join(', ')}`)
