import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { parseAbi, decodeFunctionData, encodeFunctionResult, zeroAddress, encodeAbiParameters, keccak256 } from 'viem';
const dir = await mkdtemp(join(tmpdir(), 'v13-routing-'));
await build({ stdin: { contents: "export * from './src/utils/v13/math.ts'; export * from './src/utils/v13/snapshot.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'core.cjs'), logLevel: 'silent' });
const { optimize, simulatePlan, optimizeZap, simulateZap, loadSnapshot, routeHash } = createRequire(import.meta.url)(join(dir, 'core.cjs'));
await rm(dir, { recursive: true, force: true });
const address = n => '0x' + n.toString(16).padStart(40, '0'), hash = n => '0x' + n.toString(16).padStart(64, '0');
const token = address(1), wrapped = address(2), asset = address(3), E = 10n ** 18n;
const pool = (id, a = wrapped, b = token) => ({ id, address: address(10 + id), kind: 'v2', token0: a, token1: b, decimals0: 18, decimals1: 18, feePips: 2500 });
function fixture() {
    const pools = [pool(0), pool(1)];
    const routes = pools.map((p, i) => ({ index: i, asset: token, pools: [p.id], registry: [] }));
    const m = { schemaVersion: 1, abiVersion: 'ipshare-subject-v1', chainId: 56, version: 13, token, wrappedNative: wrapped, pump: address(4), nutboxRouter: address(5), multicall: address(6), executor: null, pools, routes };
    const s = { block: 1n, timestamp: 1, fetchedAt: Date.now(), gasPrice: 0n, pools: Object.fromEntries(pools.map(p => [p.id, { valid: true, reserve0: 10n * E, reserve1: 1000n * E }])), routes, hashes: {}, executable: false };
    return { m, s };
}
test('V2 output uses exact fee and input/output tax rounding', () => {
    const { m, s } = fixture();
    m.pools[0].taxedToken = token;
    const gross = E * 9975n * 1000n * E / (10n * E * 10000n + E * 9975n);
    assert.equal(simulatePlan(m, s, true, [{ index: 0, amount: E }]).amountOut, gross - gross / 1000n);
    const sell = 100n * E, net = sell - sell / 1000n;
    assert.equal(simulatePlan(m, s, false, [{ index: 0, amount: sell }]).amountOut, net * 9975n * 10n * E / (1000n * E * 10000n + net * 9975n));
});
test('split improves net output; high gas chooses a single route', () => {
    const { m, s } = fixture();
    const split = optimize(m, s, true, 8n * E);
    assert.equal(split.legs.length, 2);
    assert.ok(split.amountOut > simulatePlan(m, s, true, [{ index: 0, amount: 8n * E }]).amountOut);
    assert.equal(split.legs.reduce((n, x) => n + x.amount, 0n), 8n * E);
    s.gasPrice = 10n ** 14n;
    assert.equal(optimize(m, s, true, E / 100n).legs.length, 1);
});
test('shared intermediary reserve changes are applied in full-leg order', () => {
    const { m, s } = fixture();
    m.pools = [pool(0, wrapped, asset), pool(1, asset, token), pool(2, asset, token)];
    m.routes = [{ index: 1, pools: [0, 1], registry: [] }, { index: 2, pools: [0, 2], registry: [] }];
    s.routes = m.routes;
    s.pools = { 0: { valid: true, reserve0: 10n * E, reserve1: 1000n * E }, 1: { valid: true, reserve0: 1000n * E, reserve1: 1000n * E }, 2: { valid: true, reserve0: 1000n * E, reserve1: 1000n * E } };
    const combined = simulatePlan(m, s, true, [{ index: 1, amount: E }, { index: 2, amount: E }]);
    const separate = simulatePlan(m, s, true, [{ index: 1, amount: E }]).amountOut + simulatePlan(m, s, true, [{ index: 2, amount: E }]).amountOut;
    assert.ok(combined.amountOut < separate);
    assert.equal(s.pools[0].reserve0, 10n * E, 'optimizer must not mutate the input snapshot');
});
test('concentrated pool cannot extrapolate beyond API tick window; another route remains usable', () => {
    const { m, s } = fixture();
    m.pools[0] = { ...pool(0, zeroAddress, token), kind: 'v4', hookFeeBps: 90, tickSpacing: 60 };
    s.pools[0] = { valid: true, sqrtPrice: 2n ** 96n, tick: 0, liquidity: 100n * E, feePips: 0, protocolFee: 0, ticks: [], lower: -60, upper: 60 };
    assert.throws(() => simulatePlan(m, s, true, [{ index: 0, amount: E }]), /V13_TICK_LIMIT/);
    const q = optimize(m, s, true, E);
    assert.ok(q.amountOut > 0n);
    assert.ok(q.legs.find(x => x.index === 1));
    if (q.legs.find(x => x.index === 0))
        assert.ok(q.legs.find(x => x.index === 0).amount < E);
});
test('V13 main fee is three separately rounded portions, on BNB side both directions', () => {
    const { m, s } = fixture();
    m.pools[0] = { ...pool(0, zeroAddress, token), kind: 'v4', hookFeeBps: 90, tickSpacing: 60 };
    s.pools[0] = { valid: true, sqrtPrice: 2n ** 96n, tick: 0, liquidity: 10000n * E, feePips: 0, protocolFee: 0, ticks: [], lower: -600, upper: 600 };
    const withFee = simulatePlan(m, s, true, [{ index: 0, amount: E }]);
    m.pools[0].hookFeeBps = 0;
    const without = simulatePlan(m, s, true, [{ index: 0, amount: E - 3n * (E * 30n / 10000n) }]);
    assert.equal(withFee.amountOut, without.amountOut);
    const gross = simulatePlan(m, s, false, [{ index: 0, amount: E }]).amountOut;
    m.pools[0].hookFeeBps = 90;
    assert.equal(simulatePlan(m, s, false, [{ index: 0, amount: E }]).amountOut, gross - 3n * (gross * 30n / 10000n));
});
const reads = parseAbi([
    'function getBlockNumber() view returns(uint256)', 'function getCurrentBlockTimestamp() view returns(uint256)',
    'function listed() view returns(bool)', 'function listingPending() view returns(bool)',
    'function getReserves() view returns(uint112,uint112,uint32)',
    'function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)',
    'function getLiquidity(bytes32) view returns(uint128)',
    'function getPoolTickInfo(bytes32,int24) view returns((uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128))',
    'function getPoolBitmapInfo(bytes32,int16) view returns(uint256)',
    'function routePoolCount(address,address) view returns(uint256)', 'function routePoolAt(address,address,uint256) view returns(bytes32)',
    'function pricePool(bytes32) view returns(bool,uint32,address,address,uint8,bytes)',
]);
function snapshotFixture({ unknown = false, failed = false, changed = false, pending = false } = {}) {
    const { m } = fixture();
    m.pools = [{ ...pool(0, zeroAddress, token), id: 'main', kind: 'v4', tickSpacing: 60, poolId: hash(44), words: [-1, 0], ticks: [-60, 60] }];
    m.routes = [{ index: 0, asset: token, pools: ['main'], registry: [{ id: hash(42), sourceType: 3, sourceData: '0x1234', token0: wrapped, token1: token, pool: 'main' }] }];
    let calls = 0;
    const client = { readContract: async (req) => {
            calls++;
            assert.equal(req.functionName, 'aggregate3');
            return req.args[0].map(call => {
                const { functionName: f, args: a = [] } = decodeFunctionData({ abi: reads, data: call.callData });
                if (failed && f === 'getLiquidity')
                    return { success: false, returnData: '0x' };
                let result;
                switch (f) {
                    case 'getBlockNumber':
                        result = 42n;
                        break;
                    case 'getCurrentBlockTimestamp':
                        result = 1000n;
                        break;
                    case 'listed':
                        result = true;
                        break;
                    case 'listingPending':
                        result = pending;
                        break;
                    case 'getSlot0':
                        result = [2n ** 96n, 0, 0, 0];
                        break;
                    case 'getLiquidity':
                        result = 10000n * E;
                        break;
                    case 'getPoolTickInfo':
                        assert.ok([-60, 60].includes(Number(a[1])));
                        result = { liquidityGross: E, liquidityNet: Number(a[1]) < 0 ? E : -E, feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n };
                        break;
                    case 'getPoolBitmapInfo':
                        result = Number(a[1]) === -1 ? 1n << 255n : 2n | (unknown ? 4n : 0n);
                        break;
                    case 'pricePool':
                        result = [true, 1, wrapped, token, 3, changed ? '0x1235' : '0x1234'];
                        break;
                    case 'routePoolCount':
                        result = 1n;
                        break;
                    case 'routePoolAt':
                        result = hash(42);
                        break;
                    default: throw Error(f);
                }
                return { success: true, returnData: encodeFunctionResult({ abi: reads, functionName: f, result }) };
            });
        } };
    return { m, client, count: () => calls };
}
test('snapshot is exactly one multicall and only reads API-listed ticks', async () => {
    const { m, client, count } = snapshotFixture();
    const s = await loadSnapshot(client, m, 1n);
    assert.equal(count(), 1);
    assert.equal(s.block, 42n);
    assert.equal(s.routes.length, 1);
    assert.equal(s.executable, false);
    assert.equal(s.hashes['0:true'], routeHash(m, m.routes[0], true));
});
test('unknown on-chain tick excludes route with no discovery or second multicall', async () => {
    const { m, client, count } = snapshotFixture({ unknown: true });
    const s = await loadSnapshot(client, m, 1n);
    assert.equal(count(), 1);
    assert.equal(s.routes.length, 0);
});
test('route configuration changes and failed pool reads invalidate affected route', async () => {
    for (const args of [{ changed: true }, { failed: true }]) {
        const { m, client, count } = snapshotFixture(args);
        assert.equal((await loadSnapshot(client, m, 1n)).routes.length, 0);
        assert.equal(count(), 1);
    }
});
test('pending token cannot quote', async () => {
    const { m, client } = snapshotFixture({ pending: true });
    await assert.rejects(loadSnapshot(client, m, 1n), /V13_LISTING_PENDING/);
});
test('five routes compute locally; report measured Node timing', () => {
    const { m, s } = fixture();
    m.pools = Array.from({ length: 5 }, (_, i) => pool(i));
    m.routes = m.pools.map((p, i) => ({ index: i, pools: [p.id], registry: [] }));
    s.routes = m.routes;
    s.pools = Object.fromEntries(m.pools.map(p => [p.id, { valid: true, reserve0: 10n * E, reserve1: 1000n * E }]));
    const start = performance.now();
    const q = optimize(m, s, true, 10n * E);
    console.log(`V13 five-V2-route local optimization: ${(performance.now() - start).toFixed(2)} ms (Node, not browser/RPC latency)`);
    assert.equal(q.legs.length, 5);
    assert.equal(q.amountIn, 10n * E);
});
test('multi-tick V3 quotes match the official SDK in both directions', async () => {
    const { Pool: SdkPool, TickMath } = await import('@pancakeswap/v3-sdk');
    const { Token, CurrencyAmount } = await import('@pancakeswap/sdk');
    const a = new Token(56, token, 18), b = new Token(56, wrapped, 18), L = 1000n * E;
    const ticks = [{ index: -500, liquidityGross: L, liquidityNet: L }, { index: -50, liquidityGross: L, liquidityNet: L }, { index: 50, liquidityGross: L, liquidityNet: -L }, { index: 500, liquidityGross: L, liquidityNet: -L }];
    for (const buy of [true, false])
        for (const amount of [E / 10n, 2n * E, 5n * E]) {
            const { m, s } = fixture();
            m.pools = [{ ...pool(0, token, wrapped), kind: 'v3', feePips: 2500, tickSpacing: 50 }];
            m.routes = [{ index: 0, pools: [0], registry: [] }];
            s.routes = m.routes;
            // Pancake V3 medium fee is 2500, with tick spacing 50.
            m.pools[0].feePips = 2500;
            m.pools[0].tickSpacing = 50;
            s.pools = { 0: { valid: true, sqrtPrice: TickMath.getSqrtRatioAtTick(0), tick: 0, liquidity: 2n * L, feePips: 2500, protocolFee: 0, ticks: ticks.map(t => ({ index: t.index, net: t.liquidityNet })), lower: -600, upper: 600 } };
            const sdk = new SdkPool(a, b, 2500, TickMath.getSqrtRatioAtTick(0), 2n * L, 0, ticks);
            const [expected] = await sdk.getOutputAmount(CurrencyAmount.fromRawAmount(buy ? b : a, amount));
            assert.equal(simulatePlan(m, s, buy, [{ index: 0, amount }]).amountOut, expected.quotient);
        }
});
test('main and two component paths using CL/V2 pools return a bounded local plan', () => {
    const { m, s } = fixture();
    m.pools = [{ ...pool(0, zeroAddress, token), kind: 'v4', hookFeeBps: 90, tickSpacing: 60 }, pool(1, wrapped, asset), pool(2, asset, token), pool(3, asset, token)];
    m.routes = [{ index: 0, pools: [0], registry: [] }, { index: 1, pools: [1, 2], registry: [] }, { index: 2, pools: [1, 3], registry: [] }];
    s.routes = m.routes;
    s.pools = { 0: { valid: true, sqrtPrice: 2n ** 96n, tick: 0, liquidity: 10000n * E, feePips: 0, protocolFee: 0, ticks: [], lower: -600, upper: 600 },
        1: { valid: true, reserve0: 100n * E, reserve1: 100n * E }, 2: { valid: true, reserve0: 100n * E, reserve1: 100n * E }, 3: { valid: true, reserve0: 100n * E, reserve1: 100n * E } };
    const start = performance.now();
    const q = optimize(m, s, true, E);
    assert.equal(q.amountIn, E);
    assert.ok(q.amountOut > 0n);
    console.log(`V13 mixed CL/V2 local optimization: ${(performance.now() - start).toFixed(2)} ms (Node)`);
});
const clientDir = await mkdtemp(join(tmpdir(), 'v13-client-'));
await build({ entryPoints: ['src/utils/v13/client.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(clientDir, 'client.cjs'),
    define: { 'import.meta.url': JSON.stringify(new URL('../src/utils/v13/client.ts', import.meta.url).href) }, logLevel: 'silent',
    plugins: [{ name: 'test-io', setup(b) {
                b.onResolve({ filter: /^@\// }, args => ({ path: args.path, namespace: 'test-io' }));
                b.onLoad({ filter: /.*/, namespace: 'test-io' }, args => ({ contents: ({
                        '@/apis/axios': 'export const get=(...a)=>globalThis.__v13Deps.get(...a)',
                        '@/config/api': "export const API_BASE_URL='http://test'",
                        '@/utils/wallets': 'export const getReadOnlyClient=()=>globalThis.__v13Deps.client; export const getWalletClient=()=>globalThis.__v13Deps.wallet; export const setup=async()=>{}',
                        '@/stores/chain': 'export const useChainStore=()=>globalThis.__v13Deps.chain',
                        '@/stores/web3': 'export const useAccountStore=()=>globalThis.__v13Deps.account',
                    })[args.path], loader: 'js' }));
            } }] });
const { createQuoteSession, buildTrade, executeQuote } = createRequire(import.meta.url)(join(clientDir, 'client.cjs'));
await rm(clientDir, { recursive: true, force: true });
class FakeWorker {
    postMessage(r) { this.timer = setTimeout(() => { try {
        this.onmessage?.({ data: { id: r.id, plan: optimize(r.metadata, r.snapshot, r.isBuy, r.amount, r.previous) } });
    }
    catch (e) {
        this.onmessage?.({ data: { id: r.id, error: e.message } });
    } }, 1); }
    terminate() { clearTimeout(this.timer); }
}
globalThis.Worker = FakeWorker;
test('continuous input coalesces metadata/current state and cancels the stale quote', async () => {
    const f = snapshotFixture();
    f.m.generatedAt = Date.now();
    f.m.configHash = hash(33);
    let resolve, getCount = 0;
    const response = new Promise(r => resolve = r);
    globalThis.__v13Deps = { get: () => { getCount++; return response; }, client: { ...f.client, getGasPrice: async () => 1n } };
    const session = createQuoteSession();
    const first = session.quote(token, true, E);
    const rejected = assert.rejects(first, /V13_QUOTE_CANCELLED/);
    const second = session.quote(token, true, 2n * E);
    resolve({ c: 0, d: f.m });
    await rejected;
    const q = await second;
    assert.equal(q.plan.amountIn, 2n * E);
    assert.equal(getCount, 1);
    assert.equal(f.count(), 1);
    const third = await session.quote(token, true, 3n * E);
    assert.equal(third.plan.amountIn, 3n * E);
    assert.equal(getCount, 1);
    assert.equal(f.count(), 1);
    session.reset();
});
test('trade calldata carries subject, exact split sum, per-leg and global minimums', () => {
    const { m, s } = fixture();
    m.executor = address(90);
    s.hashes = { '0:true': hash(9), '0:false': hash(10) };
    for (const buy of [true, false]) {
        const plan = simulatePlan(m, s, buy, [{ index: 0, amount: E }]), q = { metadata: m, snapshot: s, plan };
        const tx = buildTrade(q, address(70), address(71), 100);
        assert.equal(tx.args.at(-1), address(70));
        assert.equal(tx.args.at(-2), address(71));
        assert.equal(tx.value, buy ? E : 0n);
        const legs = tx.args[buy ? 1 : 2];
        assert.equal(legs[0].amountIn, E);
        assert.equal(legs[0].minIntermediateOut, 0n);
        assert.equal(legs[0].minAmountOut, plan.amountOut * 99n / 100n);
        assert.equal(legs[0].routeHash, s.hashes[`0:${buy}`]);
    }
    assert.throws(() => buildTrade({ metadata: m, snapshot: s, plan: simulatePlan(m, s, true, [{ index: 0, amount: E }]) }, address(70), address(71), 10000), /V13_INVALID_SLIPPAGE/);
});
test('transaction preflight prevents changed account/chain from reaching wallet', async () => {
    const { m, s } = fixture();
    m.executor = address(90);
    s.executable = true;
    s.hashes = { '0:true': hash(9) };
    const q = { metadata: m, snapshot: s, plan: simulatePlan(m, s, true, [{ index: 0, amount: E }]) };
    let writes = 0;
    const deps = { chain: { activeChainId: 56 }, account: { ethConnectAddress: address(71), getWalletType: 'privy' },
        wallet: { writeContract: async () => { writes++; return hash(99); } },
        client: { simulateContract: async (tx) => ({ request: tx }), estimateContractGas: async () => { deps.chain.activeChainId = 4663; return 100000n; }, waitForTransactionReceipt: async () => ({ status: 'success' }) } };
    globalThis.__v13Deps = deps;
    await assert.rejects(executeQuote(q, address(70), 100), /V13_ACCOUNT_CHANGED/);
    assert.equal(writes, 0);
});
test('sell approves only required amount, simulates complete trade and preserves subject', async () => {
    const { m, s } = fixture();
    m.executor = address(90);
    s.executable = true;
    s.hashes = { '0:false': hash(10) };
    const q = { metadata: m, snapshot: s, plan: simulatePlan(m, s, false, [{ index: 0, amount: E }]) }, writes = [], simulations = [];
    globalThis.__v13Deps = { chain: { activeChainId: 56 }, account: { ethConnectAddress: address(71), getWalletType: 'privy' },
        wallet: { writeContract: async (tx) => { writes.push(tx); return hash(writes.length); } },
        client: { chain: { id: 56 }, readContract: async () => 0n, simulateContract: async (tx) => { simulations.push(tx); return { request: tx }; }, estimateContractGas: async () => 100000n, waitForTransactionReceipt: async () => ({ status: 'success' }) } };
    await executeQuote(q, address(70), 100);
    assert.deepEqual(writes.map(x => x.functionName), ['approve', 'sell']);
    assert.deepEqual(writes[0].args, [m.executor, E]);
    assert.equal(writes[1].args.at(-1), address(70));
    assert.equal(simulations.length, 2);
});
test('ticks beyond API coverage are ignored without fetching them', async () => {
    const { m, client, count } = snapshotFixture({ unknown: true });
    m.pools[0].coverageLower = -60;
    m.pools[0].coverageUpper = 60;
    const s = await loadSnapshot(client, m, 1n);
    assert.equal(s.routes.length, 1);
    assert.equal(count(), 1);
    assert.equal(s.pools.main.lower, -60);
    assert.equal(s.pools.main.upper, 60);
});

function zapFixture() {
 const {m,s}=fixture()
 m.pools=[{...pool(0,zeroAddress,token),kind:'v4',hookFeeBps:90,tickSpacing:60},pool(1,wrapped,asset),{...pool(2,token,asset),taxedToken:token}]
 m.routes=[{index:0,asset:token,pools:[0],registry:[]},{index:1,asset,pools:[1,2],registry:[]}]
 s.routes=m.routes;s.pools={0:{valid:true,sqrtPrice:2n**96n,tick:0,liquidity:10000n*E,feePips:0,protocolFee:0,ticks:[],lower:-600,upper:600},1:{valid:true,reserve0:100n*E,reserve1:100n*E},2:{valid:true,reserve0:10000n*E,reserve1:10000n*E,totalSupply:1000n*E}}
 return {m,s}
}
test('BNB zap optimizes LP output while preserving the shared snapshot',()=>{
 const {m,s}=zapFixture(),copy=structuredClone(s)
 const q=optimizeZap(m,s,2n*E,0)
 assert.equal(q.tokenBnb+q.assetBnb,2n*E);assert.ok(q.lp>0n);assert.ok(q.assetOut>0n)
 const baseline=simulateZap(m,s,simulatePlan(m,s,true,[{index:0,amount:E}]),0,E)
 assert.ok(q.lp>=baseline.lp);assert.deepEqual(s,copy)
 assert.deepEqual(q.plan.legs.map(l=>l.index),[0]);assert.ok(q.tokenRefundRateX128>0n);assert.ok(q.assetRefundRateX128>0n)
})
test('zap cannot use a component outside API metadata or missing LP state',()=>{
 const {m,s}=zapFixture()
 assert.throws(()=>optimizeZap(m,s,E,3),/V13_LIQUIDITY_LIMIT/)
 delete s.pools[2].totalSupply
 assert.throws(()=>optimizeZap(m,s,E,0),/V13_LIQUIDITY_LIMIT/)
})

test('zap will not fall back to component swaps when the main V4 pool is unavailable',()=>{
 const {m,s}=zapFixture();s.pools[0].valid=false;
 assert.throws(()=>optimizeZap(m,s,E,0),/V13_LIQUIDITY_LIMIT/);
});
test('zap rejects a component purchase plan even when it quotes more T',()=>{
 const {m,s}=zapFixture();const plan=simulatePlan(m,s,true,[{index:1,amount:E}]);
 assert.throws(()=>simulateZap(m,s,plan,0,E),/V13_INVALID_ZAP_ROUTE/);
});
test('zap quotes sellback of either surplus using state after the buys',()=>{
 const {m,s}=zapFixture();
 for(const tokenBnb of [E/5n,E*4n/5n]){
  const plan=simulatePlan(m,s,true,[{index:0,amount:tokenBnb}]);
  const q=simulateZap(m,s,plan,0,E-tokenBnb);
  assert.ok(q.refundBnb>0n);assert.ok(q.refundBnb<E);
  assert.ok(q.tokenRefund>0n||q.assetRefund>0n);
 }
});
test('zap LP estimate accounts for exact tax inversion when asset limited',()=>{
 const {m,s}=zapFixture();const amount=E;
 const q=simulateZap(m,s,simulatePlan(m,s,true,[{index:0,amount}]),0,E/10n);
 const net=q.assetOut*10000n*E/(10000n*E),gross=net+(net-1n)/999n;
 assert.equal(q.tokenRefund,q.plan.amountOut-gross);assert.equal(q.assetRefund,0n);
 assert.equal(q.lp,net*1000n*E/(10000n*E));
});
