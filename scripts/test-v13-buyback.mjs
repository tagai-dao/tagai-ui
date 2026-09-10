import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { decodeAbiParameters, decodeFunctionData, encodeFunctionResult, zeroAddress } from 'viem'
const dir = await mkdtemp(join(tmpdir(), 'v13-buyback-'))
const addr = n => `0x${n.toString(16).padStart(40, '0')}`
const [token, index, hook, pump, router, nutbox, basketRouter, settlement, account] = Array.from({length: 9}, (_, i) => addr(i + 1))
await build({ entryPoints: ['src/utils/v13/buyback.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'buyback.cjs'), logLevel: 'silent', plugins: [{ name: 'fixtures', setup(b) {
  b.onResolve({ filter: /^@\// }, a => a.path.endsWith('/hook-data') ? { path: join(process.cwd(), 'src/utils/baskets/hook-data.ts') } : { path: a.path, namespace: 'fixture' })
  b.onResolve({ filter: /^\.\/pools$/ }, a => a.importer.endsWith('buyback.ts') ? { path: a.path, namespace: 'fixture' } : undefined)
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
    export const getReadOnlyClient=()=>globalThis.__buyback.client;
    export const getChainDeployment=()=>({contracts:{pump13:'${pump}'},multiConfig:{multicallAddress:'${addr(30)}'}});
    export const getBasketProtocol=()=>({nutboxRouter:'${nutbox}',swapRouter:'${basketRouter}',settlementToken:'${settlement}',registry:'${addr(31)}',hook:'${addr(32)}'});
    export const quoteNutboxExactInput=async()=>10000n;
    export const walletGuard=()=>({account:globalThis.__buyback.account,check(){}});
    export const send=async(...args)=>{globalThis.__buyback.sent.push(args);return '0xhash'};
    export const BASKET_DEFAULT_SLIPPAGE_BPS=100,BASKET_MAX_SLIPPAGE_BPS=1000,BASKET_FRONTEND_FEE_WALLET='${zeroAddress}';
  ` }))
} }] })
const { buybackAbi, readBuybackState, quoteBuyback, executeBuyback, claimIndexReward, buybackMinimum } = createRequire(import.meta.url)(join(dir, 'buyback.cjs'))
function decodePayload(encoded) {
  const [minimum, payload] = decodeAbiParameters([{type:'uint256'}, {type:'bytes'}], encoded)
  const [data] = decodeAbiParameters([{ type:'tuple', components:[{type:'address'},{type:'uint256'},{type:'uint256'},{type:'uint256[]'},{type:'uint160[]'},{type:'uint160'},{type:'bool[]'}] }], payload)
  return { minimum, data }
}
function fixture() {
  const f = { account, reserve: 100n, pending: 7n, listed: true, sent: [], simulated: [], reads: [], routerPump: pump,
    count: 2n, version: 4, engine: addr(32), initial: [10000n, 20000n], acquired: [1000n, 1800n] }
  f.client = {
    getBlock: async () => ({number: 123n, timestamp: 1000n}),
    readContract: async args => { f.reads.push(args); return ({
      listed: f.listed, indexToken: index, listingHook: hook, totalIndexRewardsNotified: 100n,
      pendingBuybackReward: f.pending, buybackBnbReserve: f.reserve, balanceOf: 90n, decimals: 18, symbol: 'INDEX',
      buybackRouter: router, pump: f.routerPump, nutboxRouter: nutbox, basketRouter, settlementToken: settlement,
      basketVersion: f.version, engine: f.engine, assetCount: f.count,
    })[args.functionName] },
    simulateContract: async args => {
      f.simulated.push(args)
      if (args.functionName === 'aggregate3') {
        if (f.aggregateError) throw f.aggregateError
        const calls = args.args[0]
        assert.equal(calls.length, 5)
        assert.ok(calls.every(c => c.allowFailure === false))
        const decoded = calls.map(c => decodeFunctionData({abi: buybackAbi, data:c.callData}))
        assert.deepEqual(decoded.map(c=>c.functionName), ['assetAt','assetAt','executeBuyback','assetAt','assetAt'])
        assert.deepEqual(calls.map(c=>c.target), [index,index,hook,index,index])
        assert.deepEqual(decoded[0].args,[0n]); assert.deepEqual(decoded[1].args,[1n])
        assert.equal(calls[0].callData,calls[3].callData); assert.equal(calls[1].callData,calls[4].callData)
        assert.equal(decoded[2].args[1],1n)
        assert.deepEqual(decodePayload(decoded[2].args[3]).data[3], [1n,1n])
        const reserve = (i, after) => ({success:true, returnData:encodeFunctionResult({abi:buybackAbi,functionName:'assetAt',result:[addr(20+i),i===0?2500:7500,f.initial[i]+(after?f.acquired[i]:0n)]})})
        const result = [reserve(0,false),reserve(1,false),{success:true,returnData:encodeFunctionResult({abi:buybackAbi,functionName:'executeBuyback',result:1000n})},reserve(0,true),reserve(1,true)]
        f.mutateResults?.(result)
        return {result}
      }
      assert.equal(args.functionName,'executeBuyback')
      if (f.finalError) throw f.finalError
      // Independent quotes would predict 2000 for leg 2; the shared pool's
      // preceding swap reduces the actual output to 1800. Enforce real bounds.
      const {data}=decodePayload(args.args[3])
      if(data[3].some((min,i)=>min>f.acquired[i]))throw Error('SlippageExceeded')
      return {result:1000n}
    },
  }
  globalThis.__buyback = f; return f
}
after(async () => { delete globalThis.__buyback; await rm(dir, {recursive: true, force: true}) })
test('atomic shared-pool quote protects both conversions and every leg without submitting a transaction', async () => {
  const f = fixture(), q = await quoteBuyback(token, account, 100)
  assert.equal(q.minOut, 990n); assert.equal(q.minSettlement, 9900n)
  assert.equal(f.simulated.length, 2); assert.equal(f.sent.length, 0)
  const {minimum, data}=decodePayload(q.data)
  assert.equal(minimum, 9900n)
  assert.equal(data[0], zeroAddress); assert.equal(data[1], 990n); assert.deepEqual(data[3], [990n,1782n])
  assert.equal(f.simulated[0].address,addr(30)); assert.equal(f.simulated[1].address,hook)
  assert.equal(f.simulated[1].args[1], 990n)
  assert.equal(f.simulated[1].args[3],q.data)
  assert.ok(f.simulated.every(call=>call.blockNumber===123n&&call.account===account))
  assert.ok(f.reads.every(call=>call.blockNumber===123n))
  assert.equal(q.state.blockNumber,123n)
})
test('first mint uses actual acquired reserves and never returns discovery bounds', async () => {
  const f=fixture();f.initial=[0n,0n]
  const q=await quoteBuyback(token,account,100)
  assert.deepEqual(decodePayload(q.data).data[3],[990n,1782n])
  assert.equal(f.sent.length,0)
})
test('failed atomic discovery or final validation never yields a sendable quote', async () => {
  for(const key of ['aggregateError','finalError']) {
    const f=fixture();f[key]=Error('RPC simulation failed')
    await assert.rejects(()=>quoteBuyback(token,account,100),/RPC simulation failed/)
    assert.equal(f.sent.length,0);assert.equal(f.simulated.length,key==='aggregateError'?1:2)
  }
})
test('incomplete, failed, malformed, or mismatched reserve results fail closed', async () => {
  const encodeAsset=result=>encodeFunctionResult({abi:buybackAbi,functionName:'assetAt',result})
  for(const mutate of [r=>r.pop(),r=>r[0].success=false,r=>r[0].returnData='0x',
    r=>r[3].returnData=encodeAsset([addr(99),2500,11000n]),
    r=>r[3].returnData=encodeAsset([addr(20),5000,11000n]),
    r=>r[3].returnData=encodeAsset([addr(20),2500,10000n]),
    r=>r[3].returnData=encodeAsset([addr(20),2500,9999n]),
    r=>r[3].returnData=encodeAsset([addr(20),2500,10001n]),
    r=>r[2].returnData=encodeFunctionResult({abi:buybackAbi,functionName:'executeBuyback',result:0n})]) {
    const f=fixture();f.mutateResults=mutate
    await assert.rejects(()=>quoteBuyback(token,account,100))
    assert.equal(f.sent.length,0);assert.equal(f.simulated.length,1)
  }
})
test('execution spends the Hook reserve and sends no wallet BNB', async () => {
  const f=fixture(), q=await quoteBuyback(token,account,100); await executeBuyback(q)
  assert.equal(f.sent[0][0],hook); assert.equal(f.sent[0][2],'executeBuyback'); assert.equal(f.sent[0][4],0n)
  assert.equal(f.sent[0][3][3],q.data);assert.equal(f.sent[0][3][1],q.minOut)
  assert.deepEqual(decodePayload(f.sent[0][3][3]).data[3],[990n,1782n])
})
test('changed reserves, account, and stale quotes cannot be sent', async () => {
  for (const change of [f=>f.reserve++,f=>f.account=addr(99),(_,q)=>q.fetchedAt-=61000]) {
    const f=fixture(),q=await quoteBuyback(token,account,100);change(f,q)
    await assert.rejects(()=>executeBuyback(q));assert.equal(f.sent.length,0)
  }
})
test('missing reserve, prelisting state, and mismatched adapter block quotes', async () => {
  for (const change of [f=>f.reserve=0n,f=>f.listed=false,f=>f.routerPump=addr(99),f=>f.version=3,f=>f.engine=addr(99),f=>f.count=0n,f=>f.count=11n]) {
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
