const { applyTickBudget } = require('./tick-budget.cjs');
const { ethers } = require('../ethers.cjs');
const ZERO = ethers.ZeroAddress;
const coder = ethers.AbiCoder.defaultAbiCoder();
const ABI = [
    'function createdTokens(address) view returns(bool)',
    'function listed() view returns(bool)', 'function listingPending() view returns(bool)',
    'function getIPShare() view returns(address)', 'function componentCount() view returns(uint256)',
    'function componentAt(uint256) view returns(address,uint16,address)',
    'function listingInfrastructure() view returns(address,address,address,address)',
    'function listingHook() view returns(address)', 'function v4PoolId() view returns(bytes32)',
    'function vault() view returns(address)', 'function pancakeV2Factory() view returns(address)',
    'function decimals() view returns(uint8)', 'function token0() view returns(address)',
    'function token1() view returns(address)', 'function fee() view returns(uint24)',
    'function tickSpacing() view returns(int24)',
    'function routePoolCount(address,address) view returns(uint256)',
    'function routePoolAt(address,address,uint256) view returns(bytes32)',
    'function pricePool(bytes32) view returns(bool,uint32,address,address,uint8,bytes)',
    'function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint32,bool)',
    'function tickBitmap(int16) view returns(uint256)',
    'function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)',
    'function getPoolBitmapInfo(bytes32,int16) view returns(uint256)',
];
const iface = new ethers.Interface(ABI);
const keyType = 'tuple(address currency0,address currency1,address hooks,address poolManager,uint24 fee,bytes32 parameters)';
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const addr = x => ethers.getAddress(x);
const fail = (code) => { const e = new Error(code); e.code = code; throw e; };
// Discovery is API-owned. The browser receives a closed list, and never discovers ticks.
async function buildMetadata({ token, config, read, blockNumber }) {
    token = addr(token);
    if (!await read(config.pump, 'createdTokens', [token]))
        fail('V13_UNKNOWN_TOKEN');
    const [listed, pending, subject, count, infrastructure, factory, hook, vault] = await Promise.all([
        read(token, 'listed'), read(token, 'listingPending'), read(token, 'getIPShare'), read(token, 'componentCount'),
        read(token, 'listingInfrastructure'), read(token, 'pancakeV2Factory'), read(token, 'listingHook'), read(token, 'vault'),
    ]);
    if (!eq(infrastructure[0], config.nutboxRouter) || !eq(factory, config.v2Factory))
        fail('V13_INFRASTRUCTURE_MISMATCH');
    const n = Number(count);
    if (n < 1 || n > 4)
        fail('V13_INVALID_COMPONENTS');
    const result = {
        schemaVersion: 1, abiVersion: 'ipshare-subject-v1', chainId: 56, token, version: 13,
        pump: config.pump, nutboxRouter: config.nutboxRouter, wrappedNative: config.wrappedNative,
        executor: config.executor || null, multicall: config.multicall,
        listed: !!listed, listingPending: !!pending, subject, decimals: 18,
        sourceBlock: String(blockNumber), generatedAt: Date.now(),
        components: [], pools: [], routes: [], unavailable: [],
    };
    if (!listed)
        return result;
    const v4PoolId = await read(token, 'v4PoolId');
    const currentTicks = new Map();
    const pools = new Map(), registry = new Map(), decimals = new Map([[token.toLowerCase(), 18]]);
    async function assetDecimals(a) {
        if (eq(a, ZERO) || eq(a, config.wrappedNative))
            return 18;
        const key = a.toLowerCase();
        if (!decimals.has(key))
            decimals.set(key, Number(await read(a, 'decimals')));
        return decimals.get(key);
    }
    async function ticks(pool) {
        const slot = pool.kind === 'v3' ? await read(pool.address, 'slot0') : await read(pool.address, 'getSlot0', [pool.poolId]);
        currentTicks.set(pool.id, Number(slot[1]));
        const word = Math.floor(Number(slot[1]) / pool.tickSpacing / 256);
        const minWord = Math.floor(-887272 / pool.tickSpacing / 256), maxWord = Math.floor(887272 / pool.tickSpacing / 256);
        pool.words = Array.from({ length: 5 }, (_, i) => word + i - 2).filter(x => x >= minWord && x <= maxWord);
        const maps = await Promise.all(pool.words.map(w => pool.kind === 'v3'
            ? read(pool.address, 'tickBitmap', [w]) : read(pool.address, 'getPoolBitmapInfo', [pool.poolId, w])));
        pool.ticks = [];
        maps.forEach((value, i) => {
            const bits = BigInt(value);
            for (let bit = 0; bit < 256; bit++)
                if ((bits >> BigInt(bit)) & 1n) {
                    const tick = (pool.words[i] * 256 + bit) * pool.tickSpacing;
                    if (tick >= -887272 && tick <= 887272)
                        pool.ticks.push(tick);
                }
        });
        // Bound public endpoint work and the browser's single multicall size.
        if (pool.ticks.length > 128) {
            const current = Number(slot[1]);
            pool.ticks = pool.ticks.sort((a, b) => Math.abs(a - current) - Math.abs(b - current)).slice(0, 128).sort((a, b) => a - b);
            pool.coverageLower = Math.min(current, pool.ticks[0]);
            pool.coverageUpper = Math.max(current + 1, pool.ticks[pool.ticks.length - 1]);
        }
    }
    async function registeredPool(id) {
        if (registry.has(id))
            return registry.get(id);
        const [enabled, , t0, t1, kind, sourceData] = await read(config.nutboxRouter, 'pricePool', [id]);
        if (!enabled)
            fail('V13_DISABLED_POOL');
        let p;
        if (Number(kind) === 0 || Number(kind) === 1) {
            const [factory, address] = coder.decode(['address', 'address'], sourceData);
            if (Number(kind) === 0 && !eq(factory, config.v2Factory))
                fail('V13_UNSUPPORTED_V2_FEE');
            const [token0, token1] = await Promise.all([read(address, 'token0'), read(address, 'token1')]);
            p = { id: address.toLowerCase(), address, kind: Number(kind) === 0 ? 'v2' : 'v3', token0, token1, feePips: 2500 };
            if (Number(kind) === 1) {
                p.feePips = Number(await read(address, 'fee'));
                p.tickSpacing = Number(await read(address, 'tickSpacing'));
            }
        }
        else if (Number(kind) === 3) {
            const k = coder.decode([keyType], sourceData)[0];
            const key = { currency0: k.currency0, currency1: k.currency1, hooks: k.hooks, poolManager: k.poolManager, fee: Number(k.fee), parameters: k.parameters };
            const poolId = ethers.keccak256(coder.encode([keyType], [key]));
            const main = eq(poolId, v4PoolId) && eq(k.currency0, ZERO) && eq(k.currency1, token) && eq(k.hooks, hook)
                && eq(k.poolManager, infrastructure[3]);
            // Hook behavior must be explicitly modeled. Unknown hooks are never quoted as ordinary CL pools.
            if (!main && !eq(k.hooks, ZERO))
                fail('V13_UNSUPPORTED_HOOK');
            p = { id: `${k.poolManager.toLowerCase()}:${poolId}`, address: k.poolManager, kind: 'v4', poolId, key,
                token0: k.currency0, token1: k.currency1, feePips: Number(k.fee),
                tickSpacing: Number((BigInt(k.parameters) >> 16n) & 0xffffffn), hookFeeBps: main ? 90 : 0 };
            if (main) {
                result.mainPoolId = poolId;
                result.vault = vault;
            }
        }
        else
            fail('V13_UNSUPPORTED_POOL');
        if (p.kind !== 'v2') {
            if (!Number.isInteger(p.tickSpacing) || p.tickSpacing <= 0)
                fail('V13_INVALID_TICK_SPACING');
            await ticks(p);
        }
        p.decimals0 = await assetDecimals(p.token0);
        p.decimals1 = await assetDecimals(p.token1);
        pools.set(p.id, p);
        const entry = { id, sourceType: Number(kind), sourceData, token0: t0, token1: t1, pool: p.id };
        registry.set(id, entry);
        return entry;
    }
    async function externalRoute(asset) {
        const count = Number(await read(config.nutboxRouter, 'routePoolCount', [ZERO, asset]));
        if (count < 1 || count > 5)
            fail('V13_INVALID_ROUTE');
        const path = [];
        for (let i = 0; i < count; i++)
            path.push(await registeredPool(await read(config.nutboxRouter, 'routePoolAt', [ZERO, asset, i])));
        return path;
    }
    for (let i = 0; i <= n; i++) {
        try {
            let asset = token, pair;
            if (i) {
                const c = await read(token, 'componentAt', [i - 1]);
                asset = c[0];
                pair = c[2];
                const d = await assetDecimals(asset);
                result.components.push({ position: i - 1, asset, pair, weight: Number(c[1]), decimals: d });
            }
            const path = await externalRoute(asset);
            if (!i && (path.length !== 1 || !eq(pools.get(path[0].pool).poolId, v4PoolId)))
                fail('V13_INVALID_MAIN_ROUTE');
            const poolIds = path.map(x => x.pool);
            if (i) {
                if (eq(pair, ZERO))
                    fail('V13_COMPONENT_NOT_LISTED');
                const [token0, token1] = await Promise.all([read(pair, 'token0'), read(pair, 'token1')]);
                if (!([token0, token1].some(x => eq(x, token)) && [token0, token1].some(x => eq(x, asset))))
                    fail('V13_INVALID_PAIR');
                const p = { id: pair.toLowerCase(), address: pair, kind: 'v2', token0, token1, feePips: 2500, taxedToken: token,
                    decimals0: await assetDecimals(token0), decimals1: await assetDecimals(token1) };
                pools.set(p.id, p);
                poolIds.push(p.id);
            }
            result.routes.push({ index: i, asset, pools: poolIds, registry: path });
        }
        catch (e) {
            result.unavailable.push({ index: i, reason: e.code || 'V13_METADATA_UNAVAILABLE' });
        }
    }
    const used = new Set(result.routes.flatMap(x => x.pools));
    result.pools = [...pools.values()].filter(p => used.has(p.id));
    applyTickBudget(result.pools, currentTicks);
    // Never rely on frontend HTTP/runtime limits to bound metadata work.
    if (result.pools.length > 25 || result.pools.reduce((n, p) => n + (p.ticks?.length || 0), 0) > 512)
        fail('V13_METADATA_TOO_LARGE');
    result.configHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ routes: result.routes, pools: result.pools, executor: result.executor })));
    return result;
}
function createMetadataService({ config, provider, loadToken, ttlMs = 60000 }) {
    const cache = new Map(), pending = new Map();
    return async function getMetadata(token) {
        if (!ethers.isAddress(token) || eq(token, ZERO))
            fail('V13_INVALID_ADDRESS');
        token = addr(token);
        const key = token.toLowerCase();
        if (cache.get(key)?.expires > Date.now())
            return cache.get(key).value;
        if (pending.has(key))
            return pending.get(key);
        if (pending.size >= 8)
            fail('V13_BUSY');
        const job = (async () => {
            const row = await loadToken(token);
            if (!row || Number(row.version) !== 13)
                fail('V13_UNKNOWN_TOKEN');
            const blockNumber = await provider.getBlockNumber();
            const read = async (address, fn, args = []) => {
                const data = await provider.call({ to: address, data: iface.encodeFunctionData(fn, args), blockTag: blockNumber });
                const r = iface.decodeFunctionResult(fn, data);
                return r.length === 1 ? r[0] : r;
            };
            const value = await buildMetadata({ token, config, read, blockNumber });
            if (cache.size >= 200)
                cache.delete(cache.keys().next().value);
            cache.set(key, { value, expires: Date.now() + (value.listed ? ttlMs : Math.min(ttlMs, 3000)) });
            return value;
        })();
        pending.set(key, job);
        try {
            return await job;
        }
        finally {
            pending.delete(key);
        }
    };
}
module.exports = { buildMetadata, createMetadataService, ABI };
