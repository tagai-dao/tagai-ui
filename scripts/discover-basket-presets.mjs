import { createPublicClient, http, parseAbiItem, zeroAddress } from 'viem'

const RPC = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951'
const V4_QUOTER = '0x8dc178efb8111bb0973dd9d722ebeff267c98f94'
const LIMIT = Number(process.env.BASKET_PRESET_LIMIT || 30)
const QUOTE_AMOUNT = 5_000_000_000_000_000n
const PREFERRED_SYMBOLS = [
  'NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'TSM', 'LLY',
  'SPY', 'QQQ', 'XOM', 'NFLX', 'COST', 'ORCL', 'AMD', 'PLTR', 'ASML', 'QCOM',
  'COIN', 'MSTR', 'INTC', 'MU', 'AMAT', 'CRWD', 'NOW', 'SHOP', 'BA', 'DELL',
  'SMCI', 'RDDT', 'SOFI', 'RBLX', 'RIVN', 'GME', 'F', 'BABA', 'IONQ', 'RKLB',
]
const initializeEvent = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)',
)
const quoterAbi = [{
  inputs: [{
    name: 'params', type: 'tuple', components: [
      { name: 'poolKey', type: 'tuple', components: [
        { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
      ] },
      { name: 'zeroForOne', type: 'bool' }, { name: 'exactAmount', type: 'uint128' }, { name: 'hookData', type: 'bytes' },
    ],
  }],
  name: 'quoteExactInputSingle',
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  stateMutability: 'nonpayable', type: 'function',
}]
const client = createPublicClient({ transport: http(RPC) })

async function fetchOfficialAssets() {
  const response = await fetch('https://api.robinhood.com/rhj/assets')
  if (!response.ok) throw new Error(`Robinhood assets API returned HTTP ${response.status}`)
  const json = await response.json()
  return (json.assets ?? []).flatMap(asset => {
    const address = asset.deployments?.find(item => item.chainId === 4663)?.contractAddress
    return address && asset.status === 'ASSET_STATUS_ACTIVE' ? [{ ...asset, address }] : []
  })
}

const poolKeyFromLog = log => ({
  currency0: log.args.currency0,
  currency1: log.args.currency1,
  fee: Number(log.args.fee),
  tickSpacing: Number(log.args.tickSpacing),
  hooks: log.args.hooks,
})

async function quotePool(poolKey) {
  const { result } = await client.simulateContract({
    address: V4_QUOTER,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{ poolKey, zeroForOne: true, exactAmount: QUOTE_AMOUNT, hookData: '0x' }],
  })
  return typeof result === 'bigint' ? result : result[0]
}

async function main() {
  const official = await fetchOfficialAssets()
  const symbolRank = new Map(PREFERRED_SYMBOLS.map((symbol, index) => [symbol, index]))
  const candidates = [...official].sort((a, b) =>
    (symbolRank.get(a.tokenSymbol) ?? 10_000) - (symbolRank.get(b.tokenSymbol) ?? 10_000))

  const output = []
  for (const asset of candidates) {
    const logs = await client.getLogs({
      address: POOL_MANAGER,
      event: initializeEvent,
      args: { currency0: zeroAddress, currency1: asset.address },
      fromBlock: 0n,
      toBlock: 'latest',
      strict: true,
    })
    let best = null
    for (const log of logs) {
      const args = log.args
      if (!args.id || args.fee === undefined || args.tickSpacing === undefined || !args.currency0 || !args.currency1 || !args.hooks) continue
      if (Number(args.fee) > 50_000) continue
      const pool = { id: args.id, poolKey: poolKeyFromLog(log) }
      try {
        const amountOut = await quotePool(pool.poolKey)
        if (amountOut > 0n && (!best || amountOut > best.amountOut)) best = { ...pool, amountOut }
      } catch {
        // Empty or hook-restricted pools are intentionally excluded.
      }
    }
    if (!best) continue
    output.push({
      symbol: asset.tokenSymbol,
      name: asset.tokenName.replace(/\s*•\s*Robinhood Token$/, ''),
      address: asset.address,
      logoUrl: asset.logoUrl,
      poolId: best.id,
      pool: best.poolKey,
    })
    if (output.length >= LIMIT) break
  }

  console.log(JSON.stringify(output, null, 2))
  if (output.length < LIMIT) {
    console.error(`Only ${output.length} compatible and quotable assets were found.`)
    process.exitCode = 1
  }
}

await main()
