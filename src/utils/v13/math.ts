import { SwapMath, TickMath } from '@pancakeswap/v3-sdk';
import { zeroAddress } from 'viem';
import { QuoteError, type Metadata, type Pool, type PoolState, type Snapshot, type Plan } from './types';
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const max = (a: bigint, b: bigint) => a > b ? a : b;
const min = (a: bigint, b: bigint) => a < b ? a : b;
const fee = (a: bigint) => 3n * (a * 30n / 10000n); // Three independently rounded V13 fee portions.
const normalize = (a: string, m: Metadata) => eq(a, zeroAddress) ? m.wrappedNative : a;
function swap(pool: Pool, s: PoolState, input: string, amount: bigint, m: Metadata): {
    amount: bigint;
    token: string;
    gas: bigint;
} {
    if (!s.valid || amount <= 0n)
        throw new QuoteError('V13_ROUTE_UNAVAILABLE');
    const zeroForOne = eq(normalize(input, m), normalize(pool.token0, m));
    if (!zeroForOne && !eq(normalize(input, m), normalize(pool.token1, m)))
        throw new QuoteError('V13_INVALID_ROUTE');
    const output = zeroForOne ? pool.token1 : pool.token0;
    if (pool.kind === 'v2') {
        const x = zeroForOne ? s.reserve0! : s.reserve1!, y = zeroForOne ? s.reserve1! : s.reserve0!;
        let net = amount;
        if (pool.taxedToken && eq(input, pool.taxedToken))
            net -= net / 1000n;
        const weighted = net * BigInt(1000000 - pool.feePips);
        const gross = weighted * y / (x * 1000000n + weighted);
        if (x <= 0n || y <= 0n || gross <= 0n || gross >= y)
            throw new QuoteError('V13_LIQUIDITY_LIMIT');
        const balanceIn = zeroForOne ? (s.balance0 ?? x) : (s.balance1 ?? x), balanceOut = zeroForOne ? (s.balance1 ?? y) : (s.balance0 ?? y);
        if (zeroForOne) {
            s.reserve0 = balanceIn + net;
            s.reserve1 = balanceOut - gross;
        }
        else {
            s.reserve1 = balanceIn + net;
            s.reserve0 = balanceOut - gross;
        }
        s.balance0 = s.reserve0;
        s.balance1 = s.reserve1;
        return { amount: pool.taxedToken && eq(output, pool.taxedToken) ? gross - gross / 1000n : gross, token: output, gas: 65000n };
    }
    let remaining = amount, result = 0n, crossed = 0n;
    if (pool.hookFeeBps && zeroForOne)
        remaining -= fee(remaining);
    const protocol = pool.kind === 'v4' ? (zeroForOne ? (s.protocolFee! & 4095) : (s.protocolFee! >> 12)) : 0;
    const lp = s.feePips!, effective = protocol + lp - Math.floor(protocol * lp / 1000000);
    if (effective < 0 || effective >= 1000000)
        throw new QuoteError('V13_UNSUPPORTED_FEE');
    while (remaining > 0n) {
        if (s.liquidity! < 0n || s.tick! < s.lower! || s.tick! >= s.upper!)
            throw new QuoteError('V13_TICK_LIMIT');
        // Match on-chain nextInitializedTickWithinOneWord, including empty-word boundaries:
        // fee/integer rounding at those boundaries must not be skipped.
        const spacing = pool.tickSpacing!, compressed = Math.floor(s.tick! / spacing) + (zeroForOne ? 0 : 1);
        const word = Math.floor(compressed / 256);
        const boundary = (zeroForOne ? word * 256 : (word + 1) * 256 - 1) * spacing;
        const next = zeroForOne ? [...s.ticks!].reverse().find(t => t.index <= s.tick! && t.index >= boundary)
            : s.ticks!.find(t => t.index > s.tick! && t.index <= boundary);
        const index = Math.max(s.lower!, Math.min(s.upper!, next?.index ?? boundary));
        const initialized = next?.index === index;
        const target = TickMath.getSqrtRatioAtTick(index);
        const [sqrt, used, out, charged] = SwapMath.computeSwapStep(s.sqrtPrice!, target, s.liquidity!, remaining, effective);
        const spent = used + charged;
        if (spent < 0n || spent > remaining)
            throw new QuoteError('V13_INVALID_STATE');
        remaining -= spent;
        result += out;
        s.sqrtPrice = sqrt;
        if (sqrt === target) {
            if (index === s.lower || index === s.upper) {
                if (remaining > 0n)
                    throw new QuoteError('V13_TICK_LIMIT');
                break;
            }
            if (initialized)
                s.liquidity! += zeroForOne ? -next!.net : next!.net;
            s.tick = zeroForOne ? index - 1 : index;
            crossed++;
        }
        else {
            s.tick = TickMath.getTickAtSqrtRatio(sqrt);
            if (spent === 0n)
                throw new QuoteError('V13_TICK_LIMIT');
        }
        if (crossed > 512n)
            throw new QuoteError('V13_TICK_LIMIT');
    }
    if (pool.hookFeeBps && !zeroForOne)
        result -= fee(result);
    if (result <= 0n)
        throw new QuoteError('V13_LIQUIDITY_LIMIT');
    return { amount: result, token: output, gas: (pool.kind === 'v3' ? 105000n : 120000n) + (pool.hookFeeBps ? 100000n : 0n) + crossed * 18000n };
}
// Every evaluation executes complete legs in their actual order against one shared pool state.
export function simulatePlan(m: Metadata, snapshot: Snapshot, isBuy: boolean, allocations: Array<{
    index: number;
    amount: bigint;
}>): Plan {
    const states = Object.fromEntries(Object.entries(snapshot.pools).map(([k, v]) => [k, { ...v }]));
    const pools = new Map(m.pools.map(p => [p.id, p])), routes = new Map(snapshot.routes.map(r => [r.index, r]));
    let total = 0n, out = 0n, gas = 55000n;
    const legs = [];
    for (const a of allocations) {
        if (a.amount === 0n)
            continue;
        const route = routes.get(a.index);
        if (!route)
            throw new QuoteError('V13_ROUTE_UNAVAILABLE');
        let amount = a.amount, token: string = isBuy ? zeroAddress : m.token, intermediate = 0n, legGas = 12000n;
        const path = isBuy ? route.pools : [...route.pools].reverse();
        for (let i = 0; i < path.length; i++) {
            if (route.index !== 0 && isBuy && i === path.length - 1)
                intermediate = amount;
            const step = swap(pools.get(path[i])!, states[path[i]], token, amount, m);
            amount = step.amount;
            token = step.token;
            legGas += step.gas;
            if (route.index !== 0 && !isBuy && i === 0)
                intermediate = amount;
        }
        if (!eq(normalize(token, m), normalize(isBuy ? m.token : zeroAddress, m)))
            throw new QuoteError('V13_INVALID_ROUTE');
        legs.push({ index: a.index, amount: a.amount, output: amount, intermediate, gas: legGas });
        total += a.amount;
        out += amount;
        gas += legGas;
    }
    if (total === 0n)
        throw new QuoteError('V13_NO_ROUTE');
    return { amountIn: total, amountOut: out, gas, legs, isBuy };
}
export function better(a: Plan, b: Plan | undefined, gasPrice: bigint): boolean {
    if (!b)
        return true;
    // Exact integer comparison; no floating-point token amounts or native/token price oracle.
    const left = a.isBuy ? a.amountOut * (b.amountIn + b.gas * gasPrice) : a.amountOut - a.gas * gasPrice;
    const right = a.isBuy ? b.amountOut * (a.amountIn + a.gas * gasPrice) : b.amountOut - b.gas * gasPrice;
    if (left === right)
        return a.legs.length < b.legs.length;
    return left > right;
}
export function optimize(m: Metadata, s: Snapshot, isBuy: boolean, amount: bigint, previous?: Plan): Plan {
    if (amount <= 0n || s.routes.length === 0)
        throw new QuoteError('V13_NO_ROUTE');
    let best: Plan | undefined;
    const evaluate = (a: Array<{
        index: number;
        amount: bigint;
    }>) => { try {
        return simulatePlan(m, s, isBuy, a);
    }
    catch {
        return undefined;
    } };
    const accept = (p: Plan | undefined) => { if (p && p.amountIn === amount && better(p, best, s.gasPrice))
        best = p; };
    for (const r of s.routes)
        accept(evaluate([{ index: r.index, amount }]));
    if (previous && previous.isBuy === isBuy && previous.amountIn > 0n) {
        const a = previous.legs.map(l => ({ index: l.index, amount: l.amount * amount / previous.amountIn }));
        a[0].amount += amount - a.reduce((n, x) => n + x.amount, 0n);
        accept(evaluate(a));
    }
    // Multiple deterministic starting orders; bounded work, no network inside the optimizer.
    const base = s.routes.map(r => r.index);
    const orders = [base, [...base].reverse(), ...base.slice(1).map((_, i) => [...base.slice(i + 1), ...base.slice(0, i + 1)])];
    for (const order of orders) {
        const a = order.map(index => ({ index, amount: 0n }));
        let remaining = amount;
        const chunk = max(1n, amount / 32n);
        while (remaining > 0n) {
            let part = min(chunk, remaining);
            let chosen = -1, top: Plan | undefined;
            while (chosen < 0 && part > 0n) {
                for (let i = 0; i < a.length; i++) {
                    a[i].amount += part;
                    const p = evaluate(a);
                    a[i].amount -= part;
                    if (p && better(p, top, s.gasPrice)) {
                        chosen = i;
                        top = p;
                    }
                }
                if (chosen < 0)
                    part /= 2n;
            }
            if (chosen < 0)
                break;
            a[chosen].amount += part;
            remaining -= part;
        }
        if (remaining === 0n)
            accept(evaluate(a));
    }
    if (!best)
        throw new QuoteError('V13_LIQUIDITY_LIMIT');
    // Refine whole-plan allocations and leg order. Retain the best single route as a baseline.
    for (const divisor of [64n, 256n, 1024n]) {
        const step = max(1n, amount / divisor);
        for (let iteration = 0; iteration < 2; iteration++) {
            const before: Plan = best;
            const a = best.legs.map(l => ({ index: l.index, amount: l.amount }));
            for (const r of s.routes)
                if (!a.some(x => x.index === r.index))
                    a.push({ index: r.index, amount: 0n });
            for (let i = 0; i < a.length; i++)
                for (let j = 0; j < a.length; j++)
                    if (i !== j && a[i].amount >= step) {
                        const trial = a.map(x => ({ ...x }));
                        trial[i].amount -= step;
                        trial[j].amount += step;
                        accept(evaluate(trial));
                    }
            for (let i = 1; i < a.length; i++) {
                const trial = [...a];
                [trial[i - 1], trial[i]] = [trial[i], trial[i - 1]];
                accept(evaluate(trial));
            }
            if (best === before)
                break;
        }
    }
    return best;
}
