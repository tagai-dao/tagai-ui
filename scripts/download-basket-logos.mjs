import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = fileURLToPath(new URL('../public/images/basket-assets/', import.meta.url))
const stockSymbols = [
  'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'TSM',
  'XOM', 'NFLX', 'COST', 'ORCL', 'AMD', 'PLTR', 'ASML', 'COIN', 'INTC', 'MU',
  'AMAT', 'NOW', 'SOFI', 'GME', 'F', 'IONQ', 'RKLB', 'APLD',
]
const downloads = [
  ...stockSymbols.map(symbol => ({
    file: `${symbol.toLowerCase()}.png`,
    url: `https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${symbol}.png`,
  })),
  { file: 'aapl.png', url: 'https://financialmodelingprep.com/image-stock/AAPL.png' },
  { file: 'spy.png', url: 'https://assets.parqet.com/logos/symbol/SPY?format=png' },
  { file: 'qqq.png', url: 'https://assets.parqet.com/logos/symbol/QQQ?format=png' },
  { file: 'spcx.svg', url: 'https://cdn.simpleicons.org/spacex/005288' },
  {
    file: 'tagagent.jpg',
    url: 'https://tiptag.oss-cn-shenzhen.aliyuncs.com/tiptag/aa8db275b03c4366b55ac532bf81a399.jpg',
  },
]

await mkdir(outputDir, { recursive: true })
for (const item of downloads) {
  const response = await fetch(item.url)
  if (!response.ok) throw new Error(`${item.file}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 200) throw new Error(`${item.file}: response is too small`)
  await writeFile(`${outputDir}/${item.file}`, bytes)
  console.log(`${item.file} ${bytes.length} bytes`)
}
