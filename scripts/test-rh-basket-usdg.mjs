import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { zeroAddress, toHex, encodeAbiParameters, encodeEventTopics } from 'viem'

const dir = await mkdtemp(join(tmpdir(), 'rh-basket-usdg-'))
const outfile = join(dir, 'test.cjs')
await build({ stdin: { contents: `export * from './src/utils/baskets/rh-recommendations.ts'; export * from './src/utils/baskets/rh-preset-catalog.ts'; export * from './src/utils/baskets/execution-quote.ts'; export * from './src/utils/baskets/route-validation.ts'; export * from './src/utils/baskets/draft.ts'; export * from './src/utils/baskets/routes.ts'; export * from './src/config/baskets.ts'; export * from './src/utils/baskets/create.ts'; export * from './src/utils/baskets/abis.ts'`, resolveDir: process.cwd() }, alias: { '@': join(process.cwd(), 'src') }, bundle: true, platform: 'node', format: 'cjs', outfile, define: { 'import.meta.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'io', setup(b) {
  b.onResolve({ filter: /^@\/utils\/wallets$/ }, () => ({ path: 'wallet', namespace: 'io' }))
  b.onResolve({ filter: /^@\/config$/ }, () => ({ path: 'config', namespace: 'io' }))
  b.onResolve({filter:/^@\/stores\/(web3|chain)$/},a=>({path:a.path,namespace:'io'}))
  b.onLoad({ filter: /.*/, namespace: 'io' }, a => ({ contents: a.path === 'wallet' ? 'export const getReadOnlyClient=id=>globalThis.__rhBasket.client;export const getWalletClient=()=>globalThis.__rhBasket.wallet;export const waitForTx=async()=>true;' : a.path.startsWith('@/stores/') ? `export const useAccountStore=()=>({ethConnectAddress:globalThis.__rhBasket.account});export const useChainStore=()=>({activeChainId:globalThis.__rhBasket.chainId});` : `export const FeeAddress='${zeroAddress}';` }))
} }] })
const ui = createRequire(import.meta.url)(outfile)
const manifest = JSON.parse(await readFile('src/utils/baskets/rh-usdg-presets.json', 'utf8'))
const originalFetch = globalThis.fetch
const usdg = ui.getBasketDeployment(4663).contracts.settlementToken
const manager = ui.getBasketDeployment(4663).contracts.poolManager
const v3Factory = ui.getBasketDeployment(4663).contracts.v3Factory
const canonical = (args) => manifest.candidates.find(a => a.route.venue === 1 && a.address.toLowerCase() === args[1].toLowerCase() && a.route.v3Fee === args[2])?.poolId ?? zeroAddress
const metadata = (row, depth = row.liquidityUsd) => ({ attributes: { address: row.poolId, reserve_in_usd: String(depth) }, relationships: { dex: { data: { id: `uniswap-v${row.route.venue === 0 ? 4 : 3}-robinhood` } }, base_token: { data: { id: `robinhood_${row.address.toLowerCase()}` } }, quote_token: { data: { id: `robinhood_${usdg.toLowerCase()}` } } } })
const addr = n => '0x' + n.toString(16).padStart(40, '0')
beforeEach(() => {
  ui.invalidateRhStockPresetCache()
  const fixture = { calls: [], account:addr(51), chainId:4663, sent:[], simulations:[], roleApproval:true, failPool: undefined, failCall: undefined, depth: undefined, targetMismatch: false }
  fixture.client = { chain: { id: 4663 }, getBlockNumber: async () => 123n, readContract: async p => { assert.equal(p.functionName,'allowance','Individual contract RPC forbidden');return 100n*10n**18n }, getBytecode:async()=> '0x1234', simulateContract: async p => { assert.equal(p.functionName,fixture.chainId===56?'createAndBuyExactSettlement':'createAndBuyExactUsdg','Individual quote RPC forbidden');fixture.simulations.push(p);if(fixture.changeChain)fixture.chainId=56;return {request:p} }, getTransactionReceipt:async()=>fixture.receipt, multicall: async request => {
    fixture.calls.push(request)
    assert.equal(request.multicallAddress.toLowerCase(), '0xca11bde05977b3631167028862be2a173976ca11')
    assert.equal(request.blockNumber, 123n)
    assert.equal(request.batchSize, 0)
    const values = request.contracts.map(c => {
      if (c.functionName === 'approvedRegistrars' || c.functionName === 'approvedCreatorForwarders') return fixture.roleApproval
      if (c.functionName === 'symbol') return 'NVDA'
      if (c.functionName === 'isBasket') return false
      if (c.functionName === 'getPool') { assert.equal(c.address.toLowerCase(), ui.getBasketDeployment(fixture.chainId).contracts.v3Factory.toLowerCase()); return fixture.targetMismatch ? addr(99) : fixture.chainId===56 ? addr(81) : canonical(c.args) }
      if (c.functionName === 'slot0') return [c.address === fixture.failPool ? 0n : 1n << 96n, 0, 0, 0, 0, 0, true]
      if (c.functionName === 'liquidity') return 1000n
      if (c.functionName === 'extsload') { assert.equal(c.address, manager); return toHex(1n << 96n, { size: 32 }) }
      if (c.functionName === 'trustedConstituentHooks') return false
      if (c.functionName === 'validateRoute') return undefined
      if (c.functionName === 'routePoolCount') return 1n
      if (c.functionName === 'routePoolAt') return toHex(1n, { size: 32 })
      if (c.functionName === 'pricePool') return [true, 1, zeroAddress, usdg, 2, encodeAbiParameters([{ type: 'tuple', components: [{ name: 'poolManager', type: 'address' }, { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] }], [{ poolManager: manager, currency0: zeroAddress, currency1: usdg, fee: 500, tickSpacing: 10, hooks: zeroAddress }])]
      if (c.functionName === 'quoteExactInputSingle') {
        const p = c.args[0], amount = p.amountIn ?? p.exactAmount
        return [amount * 99n / 100n, 1n, 0, 1n]
      }
      throw Error('Unexpected Multicall child ' + c.functionName)
    })
    return request.allowFailure ? values.map((result, i) => request.contracts[i].functionName === fixture.failCall ? { status: 'failure', error: Error('Failed child') } : { status: 'success', result }) : values
  } }
  fixture.wallet={writeContract:async request=>{fixture.sent.push(request);return '0x'+'aa'.repeat(32)}}
  globalThis.__rhBasket = fixture
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ data: manifest.candidates.filter(row => String(url).includes(row.poolId.toLowerCase())).map(row => metadata(row, fixture.depth ?? row.liquidityUsd)) }) })
})
after(async () => { globalThis.fetch = originalFetch; delete globalThis.__rhBasket; await rm(dir, { recursive: true, force: true }) })

test('reviewed catalogue contains only USDG routes above $50k and uses lower fees before depth', () => {
  const selected = ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates)
  assert.equal(selected.length, 52)
  assert.ok(selected.some(row => row.route.v3Fee === 500))
  for (const row of selected) {
    assert.equal(row.route.poolQuoteToken.toLowerCase(), usdg.toLowerCase())
    assert.ok(row.liquidityUsd > 50_000)
    const sameAsset = manifest.candidates.filter(a => a.address === row.address)
    const fee = a => a.route.venue === 0 ? a.route.v4Pool.fee : a.route.v3Fee
    assert.equal(fee(row), Math.min(...sameAsset.map(fee)))
  }
  assert.equal(ui.getBasketDeployment(56).creationVersion, 4)
  assert.equal(ui.getBasketDeployment(4663).contracts.hook, '0x7103AA53a7de0Af737d1dC1A257838f6f488aA88')
})
test('live recommendations batch canonical factories/pool state and pin all stages/chunks', async () => {
  const rows = await ui.loadRhBasketStockPresets()
  assert.equal(rows.length, 52)
  assert.ok(globalThis.__rhBasket.calls.length > 3)
  const calls = globalThis.__rhBasket.calls.flatMap(c => c.contracts)
  assert.ok(calls.some(c => c.functionName === 'getPool'))
  assert.ok(calls.some(c => c.functionName === 'slot0'))
  assert.ok(calls.some(c => c.functionName === 'extsload'))
  assert.ok(!calls.some(c => c.functionName === 'observe'))
})
test('insufficient depth and unavailable provider never fall back to old ETH stock presets', async () => {
  globalThis.__rhBasket.depth = 50_000
  assert.deepEqual(await ui.loadRhBasketStockPresets(), [])
  globalThis.fetch = async () => ({ ok: false })
  await assert.rejects(ui.loadRhBasketStockPresets(), /UNAVAILABLE/)
})
test('metadata currency mismatch, canonical pool mismatch and failed required child are rejected', async () => {
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ data: manifest.candidates.filter(r => String(url).includes(r.poolId.toLowerCase())).map(r => { const p = metadata(r); p.relationships.quote_token.data.id = `robinhood_${addr(97)}`; return p }) }) })
  assert.deepEqual(await ui.loadRhBasketStockPresets(), [])
  globalThis.__rhBasket.targetMismatch = true
  const row = manifest.candidates.find(r => r.route.venue === 1)
  assert.equal((await ui.validateBasketRoutes([{ asset: row.address, route: row.route, poolId: row.poolId }], 4663))[0].issue, 'unsupportedFactory')
  globalThis.__rhBasket.targetMismatch = false
  globalThis.__rhBasket.failCall = 'liquidity'
  await assert.rejects(ui.assertBasketRouteUsable(row.route, row.address, 4663), /validationFailed/)
})
test('untrusted Hook cannot become a recommendation', async () => {
  const row = manifest.candidates.find(r => r.route.venue === 0)
  await assert.rejects(ui.assertBasketRouteUsable({ ...row.route, v4Pool: { ...row.route.v4Pool, hooks: addr(7) } }, row.address, 4663), /hookNotApproved/)
})
test('USDG legs quote through one Multicall without an ETH bridge; minima preserve input order', async () => {
  const rows = ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates).slice(0, 3)
  const amounts = [1_000_000n, 2_000_000n, 3_000_000n]
  const result = await ui.quoteBasketSettlementLegs(rows.map((row, i) => ({ asset: row.address, route: row.route, amount: amounts[i] })), 4663)
  assert.deepEqual(result, amounts.map(n => n * 99n / 100n))
  assert.equal(globalThis.__rhBasket.calls.length, 1)
  for (const c of globalThis.__rhBasket.calls[0].contracts) assert.equal(c.args[0].tokenIn, usdg)
})
test('mixed USDG and WETH bridge budgets are quoted in dependent Multicall stages at one block', async () => {
  const row = ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates)[0]
  const wrapped = ui.getBasketDeployment(4663).contracts.wrappedNative
  const result = await ui.quoteBasketSettlementLegs([{ asset: row.address, route: row.route, amount: 1_000_000n }, { asset: wrapped, route: { venue: 2, poolQuoteToken: wrapped, v4Pool: { currency0: zeroAddress, currency1: zeroAddress, hooks: zeroAddress, fee: 0, tickSpacing: 0 }, v3Fee: 0 }, amount: 2_000_000n }], 4663)
  assert.deepEqual(result, [990_000n, 1_980_000n])
  assert.ok(globalThis.__rhBasket.calls.some(r => r.contracts.some(c => c.functionName === 'pricePool')))
})
test('direct USDG fees and per-leg execution-loss budgets retain the correct units', async () => {
  const row = ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates).find(r => r.route.venue === 1 && r.route.v3Fee === 500)
  assert.deepEqual(await ui.getBasketExecutionLosses([{ asset: row.address, route: row.route, amount: 0n }], 4663), [125])
  assert.equal(globalThis.__rhBasket.calls.length, 0)
})
test('draft restores full USDG PoolKey on RH and labels ETH separately from WETH', () => {
  const row = manifest.candidates.find(r => r.route.venue === 0)
  assert.deepEqual(ui.restoreBasketDraftRoute(row.route, 4663), row.route)
  assert.equal(ui.basketRouteQuoteSymbol(row.route, 4663), 'USDG')
  assert.equal(ui.basketRouteQuoteSymbol({ ...row.route, poolQuoteToken: zeroAddress }, 4663), 'ETH')
  assert.equal(ui.basketRouteQuoteSymbol({ ...row.route, poolQuoteToken: ui.getBasketDeployment(4663).contracts.wrappedNative }, 4663), 'WETH')
  assert.equal(ui.restoreBasketDraftRoute({ ...row.route, poolQuoteToken: undefined }, 4663), null)
})
test('selected recommendation depth is rechecked before approval', async () => {
  const row = manifest.candidates[0]
  globalThis.__rhBasket.depth = 49_999
  await assert.rejects(ui.assertRhRecommendedStockDepth([{ asset: { address: row.address }, route: row.route }]), /TOO_LOW/)
})

test('reopening the form reuses recent depth but approval checks it again without cache', async () => {
  let fetches=0
  const fakeFetch=globalThis.fetch
  globalThis.fetch=(...args)=>{fetches++;return fakeFetch(...args)}
  const rows=await ui.loadRhBasketStockPresets()
  const first=fetches
  await ui.loadRhBasketStockPresets()
  assert.equal(fetches,first)
  globalThis.__rhBasket.depth=1
  await assert.rejects(ui.assertRhRecommendedStockDepth([{asset:{address:rows[0].address},route:rows[0].route}]),/TOO_LOW/)
  assert.ok(fetches>first)
})

const creationInput=(chainId,rows)=>({chainId,name:'USDG Stocks',symbol:'USDSTOCK',basketFeeBps:100,creatorShareBps:3000,initialUsdg:'10',slippageBps:100,legs:rows.map((row,i)=>({asset:{address:row.address,symbol:row.symbol},route:row.route,weightBps:i===0?6000:4000}))})
function creationReceipt(chainId) {
  const f=globalThis.__rhBasket,protocol=ui.getBasketCreationProtocol(chainId)
  f.receipt={status:'success',logs:[{address:protocol.swapRouter,topics:encodeEventTopics({abi:ui.getBasketSwapRouterAbi(chainId,chainId===56?4:3),eventName:'BasketCreatedAndBought',args:{basket:addr(91),creator:f.account,recipient:f.account}}),data:encodeAbiParameters([{type:'bytes32'},{type:'uint256'},{type:'uint256'}],[toHex(1n,{size:32}),10n,9n])}]}
}
test('RH creation preserves USDG routes, six-decimal budgets, weights and protected calldata',async()=>{
  const f=globalThis.__rhBasket,rows=ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates).slice(0,2)
  creationReceipt(4663)
  const result=await ui.createBasketAndBuy(creationInput(4663,rows),f.account)
  assert.equal(result.basket.toLowerCase(),addr(91))
  assert.equal(f.sent.length,1)
  const request=f.sent[0],[,params,amount,minOut,hookData]=request.args
  assert.equal(request.address,ui.getBasketCreationProtocol(4663).swapRouter)
  assert.equal(amount,10_000_000n);assert.ok(minOut>0n);assert.notEqual(hookData,'0x')
  assert.deepEqual(params.targetWeights,[6000,4000])
  assert.deepEqual(params.constituentAssets,rows.map(r=>r.address))
  assert.ok(params.constituentRoutes.every(r=>r.poolQuoteToken===usdg))
  assert.ok(f.calls.some(p=>p.contracts.some(c=>c.functionName==='approvedRegistrars')))
})
test('BSC creation retains its own V4 router, USDT routes and eighteen-decimal budget',async()=>{
  const f=globalThis.__rhBasket;f.chainId=56;f.client.chain.id=56
  const rows=ui.getBasketDeployment(56).assetPresets.filter(a=>a.category==='stock').slice(0,2)
  creationReceipt(56)
  await ui.createBasketAndBuy(creationInput(56,rows),f.account)
  const request=f.sent[0]
  assert.equal(request.functionName,'createAndBuyExactSettlement')
  assert.equal(request.address,ui.getBasketCreationProtocol(56).swapRouter)
  assert.equal(request.args[2],10n*10n**18n)
  assert.ok(request.args[1].constituentRoutes.every(r=>r.poolQuoteToken===ui.getBasketDeployment(56).contracts.settlementToken))
})
test('missing creation permissions and chain changes during simulation prevent a wallet write',async()=>{
  const f=globalThis.__rhBasket,rows=ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates).slice(0,2)
  f.roleApproval=false
  await assert.rejects(ui.createBasketAndBuy(creationInput(4663,rows),f.account),/not active/)
  assert.equal(f.sent.length,0)
  f.roleApproval=true;f.changeChain=true
  await assert.rejects(ui.createBasketAndBuy(creationInput(4663,rows),f.account),/chain changed/)
  assert.equal(f.sent.length,0)
})
test('custom RH USDG route validation quotes one USDG rather than an eighteen-decimal native amount',async()=>{
  const row=ui.selectRhUsdStockPresets(ui.rhUsdStockCandidates).find(r=>r.route.venue===1)
  await ui.validateCustomBasketAsset({asset:row.address,route:row.route,chainId:4663})
  const calls=globalThis.__rhBasket.calls.flatMap(p=>p.contracts).filter(c=>c.functionName==='quoteExactInputSingle')
  assert.equal(calls[0].args[0].amountIn,1_000_000n)
})
