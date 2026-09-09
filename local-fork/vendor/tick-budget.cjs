// Share one snapshot's tick budget across every unique concentrated-liquidity pool.
// Small pools keep their complete list; dense pools keep a contiguous window nearest price.
function applyTickBudget(pools, currentTicks, maximum = 512) {
    const concentrated = pools.filter(p => p.kind !== 'v2' && p.ticks?.length);
    if (concentrated.reduce((sum, p) => sum + p.ticks.length, 0) <= maximum) return;
    const quotas = concentrated.map(() => 0);
    let remaining = maximum;
    while (remaining > 0) {
        let allocated = false;
        for (let i = 0; i < concentrated.length && remaining > 0; i++) {
            if (quotas[i] >= concentrated[i].ticks.length) continue;
            quotas[i]++; remaining--; allocated = true;
        }
        if (!allocated) break;
    }
    concentrated.forEach((pool, i) => {
        if (pool.ticks.length <= quotas[i]) return;
        const current = currentTicks.get(pool.id);
        if (!Number.isInteger(current) || quotas[i] < 2) throw new Error('V13_TICK_BUDGET_UNAVAILABLE');
        pool.ticks = [...pool.ticks].sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || a - b)
            .slice(0, quotas[i]).sort((a, b) => a - b);
        // Do not claim coverage beyond retained ticks: the browser must never extrapolate.
        pool.coverageLower = Math.min(current, pool.ticks[0]);
        pool.coverageUpper = Math.max(current + 1, pool.ticks[pool.ticks.length - 1]);
    });
}
module.exports = { applyTickBudget };
