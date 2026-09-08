import type { Address, Hex } from 'viem';
export type Pool = {
    id: string;
    address: Address;
    kind: 'v2' | 'v3' | 'v4';
    token0: Address;
    token1: Address;
    feePips: number;
    decimals0: number;
    decimals1: number;
    taxedToken?: Address;
    hookFeeBps?: number;
    poolId?: Hex;
    key?: {
        currency0: Address;
        currency1: Address;
        hooks: Address;
        poolManager: Address;
        fee: number;
        parameters: Hex;
    };
    coverageLower?: number;
    coverageUpper?: number;
    tickSpacing?: number;
    words?: number[];
    ticks?: number[];
};
export type RegistryPool = {
    id: Hex;
    sourceType: number;
    sourceData: Hex;
    token0: Address;
    token1: Address;
    pool: string;
};
export type Route = {
    index: number;
    asset: Address;
    pools: string[];
    registry: RegistryPool[];
};
export type Metadata = {
    schemaVersion: number;
    abiVersion: string;
    chainId: number;
    token: Address;
    version: number;
    pump: Address;
    nutboxRouter: Address;
    wrappedNative: Address;
    executor: Address | null;
    multicall: Address;
    listed: boolean;
    listingPending: boolean;
    subject: Address;
    decimals: number;
    sourceBlock: string;
    generatedAt: number;
    configHash: Hex;
    components: Array<{
        position: number;
        asset: Address;
        pair: Address;
        weight: number;
        decimals: number;
    }>;
    pools: Pool[];
    routes: Route[];
    unavailable: Array<{
        index: number;
        reason: string;
    }>;
};
export type PoolState = {
    totalSupply?: bigint;
    reserve0?: bigint;
    reserve1?: bigint;
    balance0?: bigint;
    balance1?: bigint;
    sqrtPrice?: bigint;
    tick?: number;
    liquidity?: bigint;
    feePips?: number;
    protocolFee?: number;
    ticks?: Array<{
        index: number;
        net: bigint;
    }>;
    lower?: number;
    upper?: number;
    valid: boolean;
};
export type Snapshot = {
    block: bigint;
    timestamp: number;
    fetchedAt: number;
    gasPrice: bigint;
    pools: Record<string, PoolState>;
    routes: Route[];
    hashes: Record<string, Hex>;
    executable: boolean;
};
export type Leg = {
    routeIndex: number;
    amountIn: bigint;
    minIntermediateOut: bigint;
    minAmountOut: bigint;
    routeHash: Hex;
};
export type LegQuote = {
    index: number;
    amount: bigint;
    output: bigint;
    intermediate: bigint;
    gas: bigint;
};
export type Plan = {
    amountIn: bigint;
    amountOut: bigint;
    gas: bigint;
    legs: LegQuote[];
    isBuy: boolean;
};
export class QuoteError extends Error {
    constructor(public code: string) { super(code); }
}
