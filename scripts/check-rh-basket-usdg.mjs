import { build } from 'esbuild'
import { createPublicClient, http } from 'viem'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const dir = await mkdtemp(join(tmpdir(), 'rh-basket-live-'))
const file = join(dir, 'live.cjs')
await build({ stdin: { contents: `export * from './src/utils/baskets/rh-recommendations.ts'; export * from './src/utils/baskets/execution-quote.ts'; export * from './src/config/baskets.ts'`, resolveDir: process.cwd() }, alias: { '@': join(process.cwd(), 'src') }, bundle: true, platform: 'node', format: 'cjs', outfile: file, define: { 'import.meta.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'readonly', setup(b) {
  b.onResolve({ filter: /^@\/utils\/wallets$/ }, () => ({ path: 'wallet', namespace: 'readonly' }))
  b.onResolve({ filter: /^@\/config$/ }, () => ({ path: 'config', namespace: 'readonly' }))
  b.onLoad({ filter: /.*/, namespace: 'readonly' }, a => ({ contents: a.path === 'wallet' ? 'export const getReadOnlyClient=()=>globalThis.__rhBasketLiveClient;' : "export const FeeAddress='0x0000000000000000000000000000000000000000';" }))
} }] })
const raw = createPublicClient({ transport: http(process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', { fetchOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } }) })
const calls = []
globalThis.__rhBasketLiveClient = { getBlockNumber: () => raw.getBlockNumber(), multicall: async p => {
  const result = await raw.multicall(p)
  calls.push({ target: p.multicallAddress, block: p.blockNumber.toString(), childCount: p.contracts.length })
  return result
} }
const nativeFetch = globalThis.fetch
// CLI uses the same public endpoint and response checks as the browser.
globalThis.fetch = (url, init) => nativeFetch(url, { ...init, headers: { ...init?.headers, 'User-Agent': 'Mozilla/5.0' } })
try {
  const ui = createRequire(import.meta.url)(file)
  const catalogueOnly = process.argv.includes('--catalogue-only')
  const presets = catalogueOnly ? ui.getBasketDeployment(4663).assetPresets.filter(row=>row.category==='stock') : await ui.loadRhBasketStockPresets()
  if (!presets.length) throw new Error('No usable USDG stock pools')
  const selected = [...['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'META'].map(symbol => presets.find(a => a.symbol === symbol)), ...ui.getBasketDeployment(4663).assetPresets.filter(a => a.category === 'platform')]
  if (selected.some(a => !a)) throw new Error('A required stock is unavailable')
  const legs = selected.map(row => ({ asset: row.address, route: row.route, amount: 10_000_000n }))
  const outputs = await ui.quoteBasketSettlementLegs(legs, 4663)
  if (outputs.some(n => n <= 0n)) throw new Error('Non-positive constituent output')
  const losses = await ui.getBasketExecutionLosses(legs, 4663)
  const allOutputs = await ui.quoteBasketSettlementLegs(presets.map(row => ({asset:row.address,route:row.route,amount:10_000_000n})),4663)
  if (allOutputs.some(n=>n<=0n)) throw new Error('A recommended pool has no executable output')
  const report = { checkedAt: new Date().toISOString(), depthSource: catalogueOnly ? 'reviewed-catalogue-snapshot' : 'live-geckoterminal', assets: presets.length, executableStockQuotes: allOutputs.length, selected: selected.map((row, i) => ({ symbol: row.symbol, poolId: row.poolId ?? null, venue: row.route.venue, quote: row.route.poolQuoteToken, fee: row.route.venue === 0 ? row.route.v4Pool.fee : row.route.v3Fee, liquidityUsd: row.liquidityUsd ?? null, amountInUsdG: '10', tokenOutRaw: outputs[i].toString(), defaultMaxExecutionLossBps: losses[i] })), calls }
  await writeFile('/tmp/rh-basket-usdg-live-validation.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} catch (error) {
  console.error(error.shortMessage || error.message)
  process.exitCode = 1
} finally {
  globalThis.fetch = nativeFetch
  delete globalThis.__rhBasketLiveClient
  await rm(dir, { recursive: true, force: true })
}
