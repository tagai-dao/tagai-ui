import { parseAbi, encodeFunctionData, decodeFunctionResult, encodeAbiParameters, keccak256, zeroAddress, type PublicClient, type Address, type Hex } from 'viem';
import { QuoteError, type Metadata, type Snapshot, type PoolState, type Route } from './types';
const MULTI = parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)']);
const ABI = parseAbi([
    'function getBlockNumber() view returns(uint256)', 'function getCurrentBlockTimestamp() view returns(uint256)',
    'function listed() view returns(bool)', 'function listingPending() view returns(bool)',
    'function pump() view returns(address)', 'function nutboxRouter() view returns(address)',
    'function balanceOf(address) view returns(uint256)',
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
export async function loadSnapshot(client: PublicClient, m: Metadata, gasPrice: bigint): Promise<Snapshot> {
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
    // Deliberately one aggregate3 eth_call, no automatic batching/chunking/discovery fallbacks.
    const raw = await client.readContract({ address: m.multicall, abi: MULTI, functionName: 'aggregate3', args: [calls] } as any) as unknown as Array<{
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
                state = { reserve0: v[0], reserve1: v[1], balance0: values[p.id + ':b0'], balance1: values[p.id + ':b1'], valid: v[0] > 0n && v[1] > 0n && values[p.id + ':b0'] >= v[0] && values[p.id + ':b1'] >= v[1] };
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
                // Ignore everything outside the API's closed coverage. Unknown ticks inside
                // it invalidate this pool; never discover, fetch or extrapolate them.
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
