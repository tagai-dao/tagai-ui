import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { decodeAbiParameters, zeroAddress } from 'viem'
const dir = await mkdtemp(join(tmpdir(), 'v13-buyback-'))
const addr = n => `0x${n.toString(16).padStart(40, '0')}`
const [token, index, hook, pump, router, nutbox, basketRouter, settlement, account] = Array.from({length: 9}, (_, i) => addr(i + 1))
await build({ entryPoints: ['src/utils/v13/buyback.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'buyback.cjs'), logLevel: 'silent', plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /^@\// }, a => a.path.endsWith('/hook-data') ? { path: join(process.cwd(), 'src/utils/baskets/hook-data.ts') } : { path: a.path, namespace: 'fixture' })
  b.onResolve({ filter: /^\.\/pools$/ }, a => a.importer.endsWith('buyback.ts') ? { path: a.path, namespace: 'fixture' } : undefined)
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
    export const getReadOnlyClient=()=>globalThis.__buyback.client;
    export const getChainDeployment=()=>({contracts:{pump13:'${pump}'}});
    export const getBasketProtocol=()=>({nutboxRouter:'${nutbox}',swapRouter:'${basketRouter}',settlementToken:'${settlement}'});
    export const getBasketDetail=async()=>({version:4,basketFeeBps:300,basketLength:2,holdings:[{asset:'${addr(20)}',route:{},targetWeightPct:25},{asset:'${addr(21)}',route:{},targetWeightPct:75}]});
    export const quoteNutboxExactInput=async()=>10000n;
    export const quoteBasketBuyLegOutputs=async args=>{globalThis.__buyback.legs=args;return [1000n,2000n]};
    export const walletGuard=()=>({account:globalThis.__buyback.account,check(){}});
    export const send=async(...args)=>{globalThis.__buyback.sent.push(args);return '0xhash'};
    export const BASKET_DEFAULT_SLIPPAGE_BPS=100,BASKET_MAX_SLIPPAGE_BPS=1000,BASKET_FRONTEND_FEE_WALLET='${zeroAddress}';
  ` }))
} }] })
const { readBuybackState, quoteBuyback, executeBuyback, claimIndexReward, buybackMinimum } = createRequire(import.meta.url)(join(dir, 'buyback.cjs'))
function fixture() {
  const f = { account, reserve: 100n, pending: 7n, listed: true, sent: [], simulated: [], routerPump: pump }
  f.client = {
    getBlock: async () => ({number: 123n, timestamp: 1000n}),
    readContract: async ({address, functionName}) => ({
      listed: f.listed, indexToken: index, listingHook: hook, totalIndexRewardsNotified: 100n,
      pendingBuybackReward: f.pending, buybackBnbReserve: f.reserve, balanceOf: 90n, decimals: 18, symbol: 'INDEX',
      buybackRouter: router, pump: f.routerPump, nutboxRouter: nutbox, basketRouter, settlementToken: settlement,
    })[functionName],
    simulateContract: async args => { f.simulated.push(args); return {result: 1000n} },
  }
  globalThis.__buyback = f; return f
}
after(async () => { delete globalThis.__buyback; await rm(dir, {recursive: true, force: true}) })
test('quote protects both conversions and every first-mint leg without submitting a transaction', async () => {
  const f = fixture(), q = await quoteBuyback(token, account, 100)
  assert.equal(q.minOut, 990n); assert.equal(q.minSettlement, 9900n)
  assert.equal(f.legs.settlementIn, 9900n); assert.equal(f.simulated.length, 2); assert.equal(f.sent.length, 0)
  const [minimum, payload] = decodeAbiParameters([{type:'uint256'}, {type:'bytes'}], q.data)
  assert.equal(minimum, 9900n)
  const [data] = decodeAbiParameters([{ type:'tuple', components:[{type:'address'},{type:'uint256'},{type:'uint256'},{type:'uint256[]'},{type:'uint160[]'},{type:'uint160'},{type:'bool[]'}] }], payload)
  assert.equal(data[0], zeroAddress); assert.equal(data[1], 990n); assert.deepEqual(data[3], [990n,1980n])
  assert.equal(f.simulated[1].args[1], 990n)
})
test('execution spends the Hook reserve and sends no wallet BNB', async () => {
  const f=fixture(), q=await quoteBuyback(token,account,100); await executeBuyback(q)
  assert.equal(f.sent[0][0],hook); assert.equal(f.sent[0][2],'executeBuyback'); assert.equal(f.sent[0][4],0n)
})
test('changed reserves, account, and stale quotes cannot be sent', async () => {
  for (const change of [f=>f.reserve++,f=>f.account=addr(99),(_,q)=>q.fetchedAt-=61000]) {
    const f=fixture(),q=await quoteBuyback(token,account,100);change(f,q)
    await assert.rejects(()=>executeBuyback(q));assert.equal(f.sent.length,0)
  }
})
test('missing reserve, prelisting state, and mismatched adapter block quotes', async () => {
  for (const change of [f=>f.reserve=0n,f=>f.listed=false,f=>f.routerPump=addr(99)]) {
    const f=fixture();change(f);await assert.rejects(()=>quoteBuyback(token,account,100));assert.equal(f.simulated.length,0)
  }
})
test('claim always pays the connected account and refuses empty rewards', async () => {
  const f=fixture();await claimIndexReward(token)
  assert.equal(f.sent[0][0],token);assert.deepEqual(f.sent[0][3],[account]);assert.equal(f.sent[0][4],0n)
  f.pending=0n;await assert.rejects(()=>claimIndexReward(token));assert.equal(f.sent.length,1)
})
test('small amounts and invalid slippage cannot silently become a one-wei minimum', () => {
  assert.throws(()=>buybackMinimum(1n,100));for(const bps of [0,1001,NaN,1.5])assert.throws(()=>buybackMinimum(10000n,bps))
})
test('disconnected read loads public data without another account rewards', async () => {
  fixture();const state=await readBuybackState(token);assert.equal(state.pending,0n);assert.equal(state.walletIndex,0n);assert.equal(state.reserve,100n)
})
