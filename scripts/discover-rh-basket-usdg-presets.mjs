import { createPublicClient, http, parseAbi, decodeAbiParameters, encodeAbiParameters, keccak256, zeroAddress } from 'viem'
import { readFile, writeFile } from 'node:fs/promises'

// Reproducible read-only discovery. Every contract batch, including dependent
// factory/pool stages, uses Multicall3 at this one block.
const rpc = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const multicall = '0xcA11bde05977b3631167028862bE2a173976CA11'
const router = '0xfc82178523687Edd56F7474d6529a14F7655Ab15'
const manager = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
const factory = '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA'
const usdg = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
const client = createPublicClient({ transport: http(rpc, {fetchOptions:{headers:{'User-Agent':'Mozilla/5.0'}}}) })
const blockNumber = await client.getBlockNumber()
const assets = JSON.parse(await readFile('src/utils/v14/rh-creation-assets.json', 'utf8'))
const abi = parseAbi([
  'function routePoolCount(address,address) view returns (uint256)',
  'function routePoolAt(address,address,uint256) view returns (bytes32)',
  'function pricePool(bytes32) view returns (bool,uint32,address,address,uint8,bytes)',
  'function getPool(address,address,uint24) view returns (address)',
  'function fee() view returns (uint24)',
])
const batch = async (contracts) => {
  const output = []
  for (let i = 0; i < contracts.length; i += 25) {
    output.push(...await client.multicall({ multicallAddress: multicall, blockNumber, batchSize: 0, allowFailure: false, contracts: contracts.slice(i, i + 25) }))
    await new Promise(resolve => setTimeout(resolve, 1_200))
  }
  return output
}
const same = (a, b) => a.toLowerCase() === b.toLowerCase()
const components = [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }]
const emptyPool = { currency0: zeroAddress, currency1: zeroAddress, fee: 0, tickSpacing: 0, hooks: zeroAddress }
const candidates = new Map()
const add = (asset, poolId, route) => candidates.set(poolId.toLowerCase(), { address: asset.address, symbol: asset.symbol, name: asset.name, logoUrl: asset.logoUrl, category: 'stock', poolId, route })
const counts = await batch(assets.map(a => ({ address: router, abi, functionName: 'routePoolCount', args: [usdg, a.address] })))
const direct = assets.filter((_, i) => counts[i] === 1n)
const ids = await batch(direct.map(a => ({ address: router, abi, functionName: 'routePoolAt', args: [usdg, a.address, 0n] })))
const sources = await batch(ids.map(id => ({ address: router, abi, functionName: 'pricePool', args: [id] })))
for (const [i, asset] of direct.entries()) {
  const [enabled, , token0, token1, type, data] = sources[i]
  if (!enabled || ![token0, token1].some(t => same(t, asset.address)) || ![token0, token1].some(t => same(t, usdg))) continue
  if (type === 2) {
    const [source] = decodeAbiParameters([{ type: 'tuple', components: [{ name: 'poolManager', type: 'address' }, ...components] }], data)
    if (!same(source.poolManager, manager)) continue
    const { poolManager, ...pool } = source
    const poolId = keccak256(encodeAbiParameters([{ type: 'tuple', components }], [pool]))
    add(asset, poolId, { venue: 0, poolQuoteToken: usdg, v4Pool: pool, v3Fee: 0, defaultMaxExecutionLossBps: 100 })
  }
}
// Include lower-fee canonical V3 USDG pools, even if the Pump router currently
// selects a different pool. Basket legs do not require Pump approval of a pool.
const requests = assets.flatMap(asset => [100, 500, 3000, 10000].map(fee => ({ asset, fee })))
const pools = await batch(requests.map(({ asset, fee }) => ({ address: factory, abi, functionName: 'getPool', args: [asset.address, usdg, fee] })))
for (const [i, pool] of pools.entries()) {
  if (same(pool, zeroAddress)) continue
  const { asset, fee } = requests[i]
  add(asset, pool, { venue: 1, poolQuoteToken: usdg, v4Pool: emptyPool, v3Fee: fee, defaultMaxExecutionLossBps: 100 })
}
const rows = [...candidates.values()]
await writeFile('/tmp/rh-basket-candidate-pools.json', JSON.stringify({block:blockNumber.toString(),rows},null,2))
// Pool TVL is a public off-chain metric; never infer dollar depth from v4
// virtual reserves. Fetch pool-specific data in documented multi-pool batches.
const metadata = new Map()
for (let i = 0; i < rows.length; i += 30) {
  const url = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/multi/${rows.slice(i, i + 30).map(a => a.poolId.toLowerCase()).join(',')}?include=base_token%2Cquote_token`
  let response
  for (let attempt=0; attempt<4; attempt++) {
    response = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0'}})
    if (response.status !== 429) break
    await new Promise(resolve => setTimeout(resolve, 10_000))
  }
  if (!response.ok) throw new Error(`Pool depth request failed: ${response.status}`)
  for (const pool of (await response.json()).data ?? []) metadata.set(pool.attributes.address.toLowerCase(), pool)
}
const output = rows.flatMap(row => {
  const pool = metadata.get(row.poolId.toLowerCase())
  const tokens = ['base_token', 'quote_token'].map(k => String(pool?.relationships?.[k]?.data?.id ?? '').replace(/^robinhood_/, '').toLowerCase())
  const dex = pool?.relationships?.dex?.data?.id ?? ''
  const liquidityUsd = Number(pool?.attributes?.reserve_in_usd ?? 0)
  if (!tokens.includes(row.address.toLowerCase()) || !tokens.includes(usdg.toLowerCase()) || !dex.includes('uniswap') || !(liquidityUsd > 50_000)) return []
  return [{ ...row, liquidityUsd }]
})
output.sort((a, b) => a.symbol.localeCompare(b.symbol) || (a.route.venue === 0 ? a.route.v4Pool.fee : a.route.v3Fee) - (b.route.venue === 0 ? b.route.v4Pool.fee : b.route.v3Fee) || b.liquidityUsd - a.liquidityUsd)
const manifest = { chainId: 4663, sourceBlock: blockNumber.toString(), checkedAt: new Date().toISOString(), minLiquidityUsd: 50_000, multicall, candidates: output }
await writeFile('src/utils/baskets/rh-usdg-presets.json', JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ block: blockNumber.toString(), discoveredPools: rows.length, qualifiedPools: output.length, assets: new Set(output.map(a => a.address.toLowerCase())).size, feeTiers: [...new Set(output.map(a => a.route.venue === 0 ? a.route.v4Pool.fee : a.route.v3Fee))] }))
