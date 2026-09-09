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
}>, sharedStates?: Record<string, PoolState>): Plan {
    const states = sharedStates ?? Object.fromEntries(Object.entries(snapshot.pools).map(([k, v]) => [k, { ...v }]));
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


export type ZapPlan = {
    plan: Plan; tokenBnb: bigint; assetBnb: bigint; assetOut: bigint; lp: bigint; gas: bigint;
    tokenRefund: bigint; assetRefund: bigint; refundBnb: bigint;
    tokenRefundRateX128: bigint; assetRefundRateX128: bigint;
}
const Q128 = 1n << 128n;
const cloneStates = (states: Record<string, PoolState>) => Object.fromEntries(Object.entries(states).map(([k,v])=>[k,{...v}]));
// Fixed path: main V4 buy, registered asset buy, mint, main V4 sell of surplus T,
// registered reverse asset route. Every step shares the same simulated state.
export function simulateZap(m: Metadata, s: Snapshot, plan: Plan, component: number, assetBnb: bigint): ZapPlan {
    const main = s.routes.find(r=>r.index===0);
    if (!main || main.pools.length!==1 || m.pools.find(p=>p.id===main.pools[0])?.kind!=='v4'
        || plan.legs.length!==1 || plan.legs[0].index!==0 || !plan.isBuy) throw new QuoteError('V13_INVALID_ZAP_ROUTE');
    const states=cloneStates(s.pools);
    const executed=simulatePlan(m,s,true,[{index:0,amount:plan.amountIn}],states);
    const route=s.routes.find(r=>r.index===component+1);
    if(!route)throw new QuoteError('V13_ROUTE_UNAVAILABLE');
    const bridge=route.pools.slice(0,-1);
    const exchange=(input:string,amount:bigint,path:string[],target:Record<string,PoolState>)=>{
        let gas=0n;
        for(const id of path){const p=m.pools.find(p=>p.id===id)!;const step=swap(p,target[id],input,amount,m);input=step.token;amount=step.amount;gas+=step.gas}
        return {amount,token:input,gas};
    };
    const bought=exchange(zeroAddress,assetBnb,bridge,states);
    if(!eq(normalize(bought.token,m),normalize(route.asset,m)))throw new QuoteError('V13_INVALID_ROUTE');
    const pair=m.pools.find(p=>p.id===route.pools.at(-1))!,state=states[pair.id];
    const supply=state.totalSupply;
    if(!supply||supply<=0n||!state.valid)throw new QuoteError('V13_STATE_UNAVAILABLE');
    const t0=eq(pair.token0,m.token),rt=t0?state.reserve0!:state.reserve1!,ra=t0?state.reserve1!:state.reserve0!;
    let gross=executed.amountOut,net=gross-gross/1000n,usedAsset=net*ra/rt;
    if(usedAsset>bought.amount){usedAsset=bought.amount;net=usedAsset*rt/ra;if(net<=0n)throw new QuoteError('V13_LIQUIDITY_LIMIT');gross=net+(net-1n)/999n}
    net=gross-gross/1000n;
    const lp=min(net*supply/rt,usedAsset*supply/ra);
    if(lp<=0n)throw new QuoteError('V13_LIQUIDITY_LIMIT');
    state.reserve0=(state.balance0??state.reserve0!)+(t0?net:usedAsset);
    state.reserve1=(state.balance1??state.reserve1!)+(t0?usedAsset:net);
    state.balance0=state.reserve0;state.balance1=state.reserve1;state.totalSupply=supply+lp;
    // A full-balance reverse quote provides a conservative rate even if the quoted
    // remainder is zero but execution later leaves a nonzero remainder.
    const tokenRate=simulatePlan(m,s,false,[{index:0,amount:executed.amountOut}],cloneStates(states)).amountOut*Q128/executed.amountOut;
    const assetRate=exchange(route.asset,bought.amount,[...bridge].reverse(),cloneStates(states)).amount*Q128/bought.amount;
    if(!tokenRate||!assetRate)throw new QuoteError('V13_LIQUIDITY_LIMIT');
    const tokenRefund=executed.amountOut-gross,assetRefund=bought.amount-usedAsset;
    let refundBnb=0n,gas=executed.gas+bought.gas+150000n;
    if(tokenRefund*tokenRate/Q128>0n){const sold=simulatePlan(m,s,false,[{index:0,amount:tokenRefund}],states);refundBnb+=sold.amountOut;gas+=sold.gas+45000n}
    if(assetRefund*assetRate/Q128>0n){const sold=exchange(route.asset,assetRefund,[...bridge].reverse(),states);refundBnb+=sold.amount;gas+=sold.gas+45000n}
    return {plan:executed,tokenBnb:plan.amountIn,assetBnb,assetOut:bought.amount,lp,gas,tokenRefund,assetRefund,refundBnb,tokenRefundRateX128:tokenRate,assetRefundRateX128:assetRate};
}
export function optimizeZap(m:Metadata,s:Snapshot,amount:bigint,component:number):ZapPlan {
    let best:ZapPlan|undefined,score=-1n,bestBps=5000;
    const seen=new Set<number>();
    const evaluate=(bps:number)=>{
        if(seen.has(bps)||bps<1||bps>9999)return;
        seen.add(bps);
        try{
            const tokenBnb=amount*BigInt(bps)/10000n;
            const plan=simulatePlan(m,s,true,[{index:0,amount:tokenBnb}]);
            const q=simulateZap(m,s,plan,component,amount-tokenBnb);
            const cost=q.gas*s.gasPrice,net=cost<amount?q.lp*(amount-cost)/amount:0n;
            if(net>score||(net===score&&q.refundBnb>(best?.refundBnb??-1n))){best=q;score=net;bestBps=bps}
        }catch{/* A fixed path outside API coverage cannot be replaced with a component swap. */}
    };
    for(let b=1000;b<=9000;b+=1000)evaluate(b);
    for(const step of [100,10,1]){const center=bestBps;for(let b=center-9*step;b<=center+9*step;b+=step)evaluate(b)}
    if(!best||score<=0n)throw new QuoteError('V13_LIQUIDITY_LIMIT');
    return best;
}
