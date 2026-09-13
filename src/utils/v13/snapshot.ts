import { parseAbi, encodeFunctionData, decodeFunctionResult, encodeAbiParameters, keccak256, zeroAddress, type PublicClient, type Address, type Hex } from 'viem';
import { QuoteError, type Metadata, type Snapshot, type PoolState, type Route, type Pool } from './types';
const MULTI = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)']);
const ABI = parseAbi([
    'function getBlockNumber() view returns(uint256)', 'function getCurrentBlockTimestamp() view returns(uint256)',
    'function listed() view returns(bool)', 'function listingPending() view returns(bool)',
    'function pump() view returns(address)', 'function nutboxRouter() view returns(address)',
    'function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)',
    'function getReserves() view returns(uint112,uint112,uint32)',
    'function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint32,bool)',
    'function liquidity() view returns(uint128)',
    'function ticks(int24) view returns(uint128,int128,uint256,uint256,int56,uint160,uint32,bool)',
    'function tickBitmap(int16) view returns(uint256)',
    'function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)',
    'function getLiquidity(bytes32) view returns(uint128)',
    'function getPoolTickInfo(bytes32,int24) view returns((uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128))',
    'function getPoolBitmapInfo(bytes32,int16) view returns(uint256)',
    'function routePoolCount(address,address) view returns(uint256)',
    'function routePoolAt(address,address,uint256) view returns(bytes32)',
    'function pricePool(bytes32) view returns(bool,uint32,address,address,uint8,bytes)',
]);
const eq = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase();
export function routeHash(m: Metadata, r: Route, buy: boolean): Hex {
    const input = buy ? zeroAddress : r.asset, output = buy ? r.asset : zeroAddress;
    const pools = buy ? r.registry : [...r.registry].reverse();
    let hash = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }], [56n, m.nutboxRouter, input, output, BigInt(pools.length)]));
    for (const p of pools)
        hash = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'address' }, { type: 'uint8' }, { type: 'bytes' }], [hash, p.id, p.token0, p.token1, p.sourceType, p.sourceData]));
    return hash;
}
const tickCache = new Map<string, { at: number; words: number[]; ticks: number[]; coverageLower?: number; coverageUpper?: number }>();
const tickKey = (m: Metadata, p: Pool) => JSON.stringify([m.chainId, p.address.toLowerCase(), p.poolId, p.tickSpacing, p.key]);
async function discoverTicks(client: PublicClient, m: Metadata, pools: Pool[]): Promise<bigint> {
    const readBatch = async (requests: Array<{ target: Address; fn: string; args: unknown[] }>, blockNumber?: bigint) => {
        const raw = await client.readContract({ address: m.multicall, abi: MULTI, functionName: 'aggregate3',
            ...(blockNumber === undefined ? {} : { blockNumber }),
            args: [requests.map(r => ({ target: r.target, allowFailure: true,
                callData: encodeFunctionData({ abi: ABI, functionName: r.fn, args: r.args } as any) }))] } as any) as unknown as Array<{ success: boolean; returnData: Hex }>;
        return requests.map((r, i) => {
            if (!raw[i]?.success) throw new QuoteError('V13_STATE_UNAVAILABLE');
            return decodeFunctionResult({ abi: ABI, functionName: r.fn, data: raw[i].returnData } as any) as any;
        });
    };
    // Round 1: get the block and all current ticks. No separate eth_blockNumber request.
    const slots = await readBatch([{ target: m.multicall, fn: 'getBlockNumber', args: [] }, ...pools.map(p => ({
        target: p.address, fn: p.kind === 'v4' ? 'getSlot0' : 'slot0', args: p.kind === 'v4' ? [p.poolId] : [] }))]);
    const block = slots[0] as bigint;
    const requests: Array<{ target: Address; fn: string; args: unknown[] }> = [];
    const windows = pools.map((p, i) => {
        const spacing = p.tickSpacing!;
        if (!Number.isInteger(spacing) || spacing <= 0) throw new QuoteError('V13_INVALID_METADATA');
        const current = Number(slots[i + 1][1]), word = Math.floor(current / spacing / 256);
        const words = Array.from({ length: 5 }, (_, n) => word + n - 2).filter(w =>
            w >= Math.floor(-887272 / spacing / 256) && w <= Math.floor(887272 / spacing / 256));
        for (const w of words) requests.push({ target: p.address, fn: p.kind === 'v4' ? 'getPoolBitmapInfo' : 'tickBitmap', args: p.kind === 'v4' ? [p.poolId, w] : [w] });
        return { current, words };
    });
    // Round 2: discover bounded initialized tick lists at the same block.
    const maps = await readBatch(requests, block);
    let offset = 0, total = m.pools.filter(p => p.kind !== 'v2' && !pools.includes(p)).reduce((n, p) => n + (p.ticks?.length || 0), 0);
    const updates = pools.map((p, i) => {
        const { current, words } = windows[i];
        let ticks: number[] = [];
        for (const w of words) {
            const bits = BigInt(maps[offset++]);
            for (let bit = 0; bit < 256; bit++) if ((bits >> BigInt(bit)) & 1n) {
                const tick = (w * 256 + bit) * p.tickSpacing!;
                if (tick >= -887272 && tick <= 887272) ticks.push(tick);
            }
        }
        let coverageLower: number | undefined, coverageUpper: number | undefined;
        if (ticks.length > 128) {
            ticks = ticks.sort((a, b) => Math.abs(a - current) - Math.abs(b - current)).slice(0, 128).sort((a, b) => a - b);
            coverageLower = Math.min(current, ticks[0]); coverageUpper = Math.max(current + 1, ticks[ticks.length - 1]);
        }
        total += ticks.length;
        return { at: Date.now(), words, ticks, coverageLower, coverageUpper };
    });
    if (total > 512) throw new QuoteError('V13_METADATA_TOO_LARGE');
    pools.forEach((p, i) => {
        const entry = updates[i]; Object.assign(p, entry);
        tickCache.set(tickKey(m, p), entry);
    });
    while (tickCache.size > 256) tickCache.delete(tickCache.keys().next().value!);
    return block;
}
export async function loadSnapshot(client: PublicClient, m: Metadata, gasPrice: bigint): Promise<Snapshot> {
    if (m.schemaVersion !== 1 || m.abiVersion !== 'ipshare-subject-v1' || m.chainId !== 56 || m.version !== 13
        || m.pools.length > 25 || m.routes.length > 5) throw new QuoteError('V13_INVALID_METADATA');
    // Legacy/fork metadata with closed tick lists keeps its original single-call behavior.
    if (m.tickDiscovery !== 'client') return snapshotOnce(client, m, gasPrice);
    const cl = m.pools.filter(p => p.kind !== 'v2');
    const missing = cl.filter(p => {
        const cached = tickCache.get(tickKey(m, p));
        if (cached && Date.now() - cached.at < 300000) { Object.assign(p, cached); return false; }
        return true;
    });
    const block = missing.length ? await discoverTicks(client, m, missing) : undefined;
    let snapshot = await snapshotOnce(client, m, gasPrice, block);
    // A cached bitmap/window may no longer cover the live pool. One bounded rebuild only.
    const invalid = block === undefined ? cl.filter(p => !snapshot.pools[p.id]?.valid) : [];
    if (invalid.length) {
        invalid.forEach(p => tickCache.delete(tickKey(m, p)));
        const freshBlock = await discoverTicks(client, m, invalid);
        snapshot = await snapshotOnce(client, m, gasPrice, freshBlock);
    }
    return snapshot;
}
async function snapshotOnce(client: PublicClient, m: Metadata, gasPrice: bigint, blockNumber?: bigint): Promise<Snapshot> {
    if (m.schemaVersion !== 1 || m.abiVersion !== 'ipshare-subject-v1' || m.chainId !== 56 || m.version !== 13
        || m.pools.length > 25 || m.routes.length > 5 || m.pools.reduce((n, p) => n + (p.ticks?.length || 0), 0) > 512)
        throw new QuoteError('V13_INVALID_METADATA');
    const calls: Array<{
        target: Address;
        allowFailure: boolean;
        callData: Hex;
    }> = [], names: Array<{
        key: string;
        fn: string;
    }> = [];
    const add = (key: string, target: Address, fn: string, args: unknown[] = []) => {
        names.push({ key, fn });
        calls.push({ target, allowFailure: true, callData: encodeFunctionData({ abi: ABI, functionName: fn, args } as any) });
    };
    add('block', m.multicall, 'getBlockNumber');
    add('time', m.multicall, 'getCurrentBlockTimestamp');
    add('listed', m.token, 'listed');
    add('pending', m.token, 'listingPending');
    if (m.executor) {
        add('pump', m.executor, 'pump');
        add('router', m.executor, 'nutboxRouter');
    }
    for (const p of m.pools) {
        if (p.kind === 'v2') {
            add(p.id, p.address, 'getReserves');
            add(p.id + ':supply', p.address, 'totalSupply');
            add(p.id + ':b0', p.token0, 'balanceOf', [p.address]);
            add(p.id + ':b1', p.token1, 'balanceOf', [p.address]);
        }
        else {
            const prefix = p.kind === 'v4' ? [p.poolId] : [];
            add(p.id, p.address, p.kind === 'v4' ? 'getSlot0' : 'slot0', prefix);
            add(p.id + ':liquidity', p.address, p.kind === 'v4' ? 'getLiquidity' : 'liquidity', prefix);
            for (const t of p.ticks!)
                add(p.id + ':t:' + t, p.address, p.kind === 'v4' ? 'getPoolTickInfo' : 'ticks', [...prefix, t]);
            for (const w of p.words!)
                add(p.id + ':w:' + w, p.address, p.kind === 'v4' ? 'getPoolBitmapInfo' : 'tickBitmap', [...prefix, w]);
        }
    }
    const registry = new Map(m.routes.flatMap(r => r.registry.map(p => [p.id, p] as const)));
    for (const [id] of registry)
        add(id, m.nutboxRouter, 'pricePool', [id]);
    for (const r of m.routes)
        for (const buy of [true, false]) {
            const a = buy ? zeroAddress : r.asset, b = buy ? r.asset : zeroAddress, key = `r:${r.index}:${buy}`;
            add(key, m.nutboxRouter, 'routePoolCount', [a, b]);
            r.registry.forEach((_, i) => add(key + ':' + i, m.nutboxRouter, 'routePoolAt', [a, b, i]));
        }
    // Final round: all quote state and cache/route validation share one block.
    const raw = await client.readContract({ address: m.multicall, abi: MULTI, functionName: 'aggregate3', args: [calls],
        ...(blockNumber === undefined ? {} : { blockNumber }) } as any) as unknown as Array<{
        success: boolean;
        returnData: Hex;
    }>;
    const values: Record<string, any> = {};
    raw.forEach((r, i) => { if (r.success) {
        try {
            values[names[i].key] = decodeFunctionResult({ abi: ABI, functionName: names[i].fn, data: r.returnData } as any);
        }
        catch { /* invalidate only dependent routes */ }
    } });
    if (values.block === undefined || values.time === undefined)
        throw new QuoteError('V13_STATE_UNAVAILABLE');
    if (values.listed !== true || values.pending !== false)
        throw new QuoteError(values.pending ? 'V13_LISTING_PENDING' : 'V13_NOT_LISTED');
    const pools: Record<string, PoolState> = {};
    for (const p of m.pools) {
        const v = values[p.id];
        let state: PoolState = { valid: false };
        if (v) {
            if (p.kind === 'v2')
                state = { totalSupply: values[p.id + ':supply'], reserve0: v[0], reserve1: v[1], balance0: values[p.id + ':b0'], balance1: values[p.id + ':b1'], valid: v[0] > 0n && v[1] > 0n && values[p.id + ':b0'] >= v[0] && values[p.id + ':b1'] >= v[1] };
            else {
                const spacing = p.tickSpacing!, ticks: Array<{
                    index: number;
                    net: bigint;
                }> = [];
                let valid = values[p.id + ':liquidity'] !== undefined;
                const expected = new Map<number, bigint>(p.words!.map(w => [w, 0n]));
                for (const t of p.ticks!) {
                    const info = values[p.id + ':t:' + t];
                    if (!info) {
                        valid = false;
                        continue;
                    }
                    const gross = p.kind === 'v4' ? info.liquidityGross : info[0], net = p.kind === 'v4' ? info.liquidityNet : info[1];
                    if (gross > 0n) {
                        ticks.push({ index: t, net });
                        const compressed = Math.floor(t / spacing), word = Math.floor(compressed / 256), bit = compressed - word * 256;
                        expected.set(word, (expected.get(word) || 0n) | (1n << BigInt(bit)));
                    }
                }
                const lower = p.coverageLower ?? Math.max(-887271, Math.min(...p.words!) * 256 * spacing);
                const upper = p.coverageUpper ?? Math.min(887271, (Math.max(...p.words!) + 1) * 256 * spacing);
                // Unknown ticks inside the bounded window invalidate it. Never extrapolate.
                for (const w of p.words!) {
                    const low = Math.max(0, Math.ceil(lower / spacing) - w * 256), high = Math.min(255, Math.floor(upper / spacing) - w * 256);
                    if (low > high)
                        continue;
                    const mask = ((1n << BigInt(high - low + 1)) - 1n) << BigInt(low);
                    const current = values[p.id + ':w:' + w];
                    if (current === undefined || (current & mask) !== (expected.get(w)! & mask))
                        valid = false;
                }
                state = { sqrtPrice: v[0], tick: Number(v[1]), liquidity: values[p.id + ':liquidity'],
                    feePips: p.kind === 'v4' ? Number(v[3]) : p.feePips, protocolFee: p.kind === 'v4' ? Number(v[2]) : 0,
                    ticks: ticks.sort((a, b) => a.index - b.index), lower, upper, valid: valid && Number(v[1]) >= lower && Number(v[1]) < upper };
            }
        }
        pools[p.id] = state;
    }
    const hashes: Record<string, Hex> = {};
    const routes = m.routes.filter(r => {
        if (r.pools.some(id => !pools[id]?.valid))
            return false;
        for (const p of r.registry) {
            const v = values[p.id];
            if (!v || v[0] !== true || !eq(v[2], p.token0) || !eq(v[3], p.token1) || Number(v[4]) !== p.sourceType || !eq(v[5], p.sourceData))
                return false;
        }
        for (const buy of [true, false]) {
            const key = `r:${r.index}:${buy}`, expected = buy ? r.registry : [...r.registry].reverse();
            if (values[key] !== BigInt(expected.length) || expected.some((p, i) => !eq(values[key + ':' + i], p.id)))
                return false;
            hashes[`${r.index}:${buy}`] = routeHash(m, r, buy);
        }
        return true;
    });
    return { block: values.block, timestamp: Number(values.time), fetchedAt: Date.now(), gasPrice, pools, routes, hashes,
        executable: !!m.executor && eq(values.pump, m.pump) && eq(values.router, m.nutboxRouter) };
}
