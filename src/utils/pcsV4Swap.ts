/**
 * PancakeSwap V4 Infinity Swap Utilities
 * 
 * Handles DEX trading for V7 listed tokens via Universal Router + Permit2.
 * 
 * Buy flow (BNB → Token): INFI_SWAP command with ETH value
 * Sell flow (Token → BNB): approve Permit2 → PERMIT2_PERMIT + INFI_SWAP
 */

import { PCSUniversalRouter, PCSPermit2, PCSCLPoolManager, PCSCLQuoter, WETH } from "@/config";
import { useAccountStore } from "@/stores/web3";
import { 
    encodeAbiParameters, 
    encodePacked,
    isAddress, 
    keccak256,
    maxUint256, 
    zeroAddress,
    type Hex
} from "viem";
import { writeContract, readContract } from "./contract";
import { getWalletClient, getReadOnlyClient, setup, waitForTx } from "./wallets";
import { customBsc } from "./privy";
import errCode from "@/errCode";

// --- Constants ---

// Price math
const Q192 = 2n ** 192n;

// Universal Router Commands (from Commands.sol)
const PERMIT2_PERMIT = 0x0a;
const INFI_SWAP = 0x10;
const UNWRAP_WETH = 0x0c;
const SWEEP = 0x04;

// Infinity Actions (from Actions.sol)
const CL_SWAP_EXACT_IN_SINGLE = 0x06;

// Action Constants
const MSG_SENDER = '0x0000000000000000000000000000000000000001';
const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';

// Currency for native BNB (address(0) in PCS V4)
const NATIVE_CURRENCY = zeroAddress;

// --- Types ---

/** PoolKey struct matching PCS V4 Infinity */
export type PoolKey = {
    currency0: `0x${string}`;
    currency1: `0x${string}`;
    hooks: `0x${string}`;
    poolManager: `0x${string}`;
    fee: number;
    parameters: `0x${string}`;
}

const POOL_KEY_ENCODE_TYPES = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'currency0' },
        { type: 'address', name: 'currency1' },
        { type: 'address', name: 'hooks' },
        { type: 'address', name: 'poolManager' },
        { type: 'uint24', name: 'fee' },
        { type: 'bytes32', name: 'parameters' },
    ],
}] as const

/** PCS V4 poolId = keccak256(abi.encode(PoolKey)) */
export const poolKeyToPoolId = (poolKey: PoolKey): `0x${string}` => {
    return keccak256(encodeAbiParameters(
        POOL_KEY_ENCODE_TYPES,
        [{
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            hooks: poolKey.hooks,
            poolManager: poolKey.poolManager,
            fee: poolKey.fee,
            parameters: poolKey.parameters,
        }]
    ))
}

/**
 * 解析后端 pair 字段为 V4 poolId。
 * Pump v7-v9 上架代币为 PoolKey JSON；导入币 dexVersion=4 为 bytes32 poolId。
 */
export const resolveV4PoolId = (pair: string | null | undefined): `0x${string}` | null => {
    if (!pair?.trim()) return null
    const trimmed = pair.trim()
    if (trimmed.startsWith('{')) {
        try {
            return poolKeyToPoolId(JSON.parse(trimmed) as PoolKey)
        } catch {
            return null
        }
    }
    if (trimmed.startsWith('0x') && trimmed.length === 66) {
        return trimmed as `0x${string}`
    }
    return null
}

/** 从 pair 字段解析 PoolKey（仅 JSON 格式） */
export const resolveV4PoolKey = (pair: string | null | undefined): PoolKey | null => {
    if (!pair?.trim().startsWith('{')) return null
    try {
        return JSON.parse(pair.trim()) as PoolKey
    } catch {
        return null
    }
}

const poolIdToPoolKeyAbi = [{
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'poolIdToPoolKey',
    outputs: [{
        type: 'tuple',
        components: [
            { type: 'address', name: 'currency0' },
            { type: 'address', name: 'currency1' },
            { type: 'address', name: 'hooks' },
            { type: 'address', name: 'poolManager' },
            { type: 'uint24', name: 'fee' },
            { type: 'bytes32', name: 'parameters' },
        ],
    }],
    stateMutability: 'view',
    type: 'function',
}] as const

/** 由 poolId 反查 PoolKey（导入币 dexVersion=4 仅有 poolId 时使用） */
export const getV4PoolKeyByPoolId = async (poolId: `0x${string}`): Promise<PoolKey> => {
    const publicClient = getReadOnlyClient()
    const result = await publicClient.readContract({
        address: PCSCLPoolManager as `0x${string}`,
        abi: poolIdToPoolKeyAbi,
        functionName: 'poolIdToPoolKey',
        args: [poolId],
    }) as {
        currency0: `0x${string}`
        currency1: `0x${string}`
        hooks: `0x${string}`
        poolManager: `0x${string}`
        fee: number
        parameters: `0x${string}`
    }
    return {
        currency0: result.currency0,
        currency1: result.currency1,
        hooks: result.hooks,
        poolManager: result.poolManager,
        fee: result.fee,
        parameters: result.parameters,
    }
}

/** 交易下单：pair 为 PoolKey JSON 或 poolId bytes32 均可解析 */
export const resolveV4PoolKeyForTrade = async (pair: string | null | undefined): Promise<PoolKey | null> => {
    const fromJson = resolveV4PoolKey(pair)
    if (fromJson) return fromJson
    const poolId = resolveV4PoolId(pair)
    if (!poolId || pair?.trim().startsWith('{')) return null
    if (pair!.trim().length === 66) {
        return getV4PoolKeyByPoolId(poolId)
    }
    return null
}

// --- Core Functions ---

/**
 * Encode hookData with sellsman address for TipTagSwapHook
 */
export const encodeHookData = (sellsman: `0x${string}` | undefined | null): Hex => {
    if (!sellsman || !isAddress(sellsman) || sellsman === zeroAddress) {
        return '0x' as Hex;
    }
    return encodeAbiParameters(
        [{ type: 'address' }],
        [sellsman]
    );
}

/**
 * Build the INFI_SWAP payload for a CL_SWAP_EXACT_IN_SINGLE action.
 * 
 * This encodes the Planner-style actions:
 *   - CL_SWAP_EXACT_IN_SINGLE with params
 *   - SETTLE_ALL (0x0c) for input currency  
 *   - TAKE_ALL (0x0f) for output currency
 */
const buildInfiSwapPayload = (
    poolKey: PoolKey,
    zeroForOne: boolean,
    amountIn: bigint,
    amountOutMinimum: bigint,
    hookData: Hex
): Hex => {
    // Encode CLSwapExactInputSingleParams
    const swapParams = encodeAbiParameters(
        [
            {
                type: 'tuple',
                components: [
                    {
                        type: 'tuple',
                        name: 'poolKey',
                        components: [
                            { type: 'address', name: 'currency0' },
                            { type: 'address', name: 'currency1' },
                            { type: 'address', name: 'hooks' },
                            { type: 'address', name: 'poolManager' },
                            { type: 'uint24', name: 'fee' },
                            { type: 'bytes32', name: 'parameters' },
                        ]
                    },
                    { type: 'bool', name: 'zeroForOne' },
                    { type: 'uint128', name: 'amountIn' },
                    { type: 'uint128', name: 'amountOutMinimum' },
                    { type: 'bytes', name: 'hookData' },
                ]
            }
        ],
        [{
            poolKey: {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                hooks: poolKey.hooks,
                poolManager: poolKey.poolManager,
                fee: poolKey.fee,
                parameters: poolKey.parameters,
            },
            zeroForOne,
            amountIn,
            amountOutMinimum,
            hookData,
        }]
    );

    // Build the actions plan:
    // action[0]: CL_SWAP_EXACT_IN_SINGLE + encoded swap params
    // action[1]: SETTLE_ALL (currency_in, maxAmount)
    // action[2]: TAKE_ALL (currency_out, minAmount)
    const currencyIn = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    const currencyOut = zeroForOne ? poolKey.currency1 : poolKey.currency0;

    const actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [CL_SWAP_EXACT_IN_SINGLE, 0x0c, 0x0f] as [number, number, number] // CL_SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
    );

    const params: Hex[] = [
        swapParams,
        encodeAbiParameters(
            [{ type: 'address' }, { type: 'uint128' }],
            [currencyIn, amountIn]
        ),
        encodeAbiParameters(
            [{ type: 'address' }, { type: 'uint128' }],
            [currencyOut, amountOutMinimum]
        )
    ];

    // Encode the full INFI_SWAP input: abi.encode(bytes actions, bytes[] params)
    return encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, params]
    );
}

/**
 * Buy token using BNB via PCS V4 Universal Router
 * Flow: User sends BNB → Universal Router swaps via CL pool → User receives Token
 */
export const buyTokenV4 = async (
    poolKey: PoolKey,
    ethAmount: bigint,
    minTokenOut: bigint,
    sellsman: `0x${string}` | undefined | null,
    slippage: number = 0
): Promise<string> => {
    const hookData = encodeHookData(sellsman);
    
    // Apply slippage to minTokenOut
    const minOut = slippage > 0 ? minTokenOut * BigInt(10000 - slippage) / 10000n : minTokenOut;

    // Build INFI_SWAP payload (zeroForOne depends on currency order)
    // In PCS V4, native BNB = address(0) which is always currency0
    const infiSwapData = buildInfiSwapPayload(
        poolKey,
        true, // zeroForOne: BNB(currency0) → Token(currency1)
        ethAmount,
        minOut,
        hookData
    );

    // Build Universal Router commands: [INFI_SWAP]
    const commands = encodePacked(['uint8'], [INFI_SWAP]);
    const inputs = [infiSwapData];

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Call Universal Router
    const client = getWalletClient();
    const publicClient = getReadOnlyClient();
    if (!client) throw 'no wallet client';
    
    if (useAccountStore().getWalletType !== 'privy') {
        await setup();
    }
    
    const { request } = await publicClient.simulateContract({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        address: PCSUniversalRouter as `0x${string}`,
        abi: universalRouterAbi,
        functionName: 'execute',
        args: [commands, inputs, deadline],
        chain: customBsc,
        value: ethAmount
    });

    const tx = await client.writeContract(request);
    const hash = await waitForTx(tx);
    if (!hash) throw errCode.TRANSACTION_INVALID;
    return hash;
}

/**
 * Sell token for BNB via PCS V4 Universal Router
 * Flow: approve Permit2 → sign Permit2 → PERMIT2_PERMIT + INFI_SWAP
 */
export const sellTokenV4 = async (
    poolKey: PoolKey,
    token: `0x${string}`,
    amount: bigint,
    minEthOut: bigint,
    sellsman: `0x${string}` | undefined | null,
    slippage: number = 0
): Promise<string> => {
    const account = useAccountStore().ethConnectAddress as `0x${string}`;
    
    // Step 1: Ensure token is approved to Permit2
    await ensurePermit2Approval(token, amount);

    // Step 2: Ensure Permit2 has approved Universal Router
    await ensurePermit2AllowanceForRouter(token, amount);
    
    const hookData = encodeHookData(sellsman);
    const minOut = slippage > 0 ? minEthOut * BigInt(10000 - slippage) / 10000n : minEthOut;
    
    // Build INFI_SWAP payload
    // Token is currency1, BNB(0x0) is currency0
    // Selling token means: currency1 → currency0, so zeroForOne = false
    const infiSwapData = buildInfiSwapPayload(
        poolKey,
        false, // zeroForOne: false = Token(currency1) → BNB(currency0)
        amount,
        minOut,
        hookData
    );

    // Commands: [INFI_SWAP]
    // Note: We use approve-based flow (not permit signature) for simplicity
    const commands = encodePacked(['uint8'], [INFI_SWAP]);
    const inputs = [infiSwapData];

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    const client = getWalletClient();
    const publicClient = getReadOnlyClient();
    if (!client) throw 'no wallet client';
    
    if (useAccountStore().getWalletType !== 'privy') {
        await setup();
    }

    const { request } = await publicClient.simulateContract({
        account,
        address: PCSUniversalRouter as `0x${string}`,
        abi: universalRouterAbi,
        functionName: 'execute',
        args: [commands, inputs, deadline],
        chain: customBsc,
        value: 0n
    });

    const tx = await client.writeContract(request);
    const hash = await waitForTx(tx);
    if (!hash) throw errCode.TRANSACTION_INVALID;
    return hash;
}

/**
 * Ensure token has sufficient ERC20 approval to Permit2 contract
 */
export const ensurePermit2Approval = async (token: `0x${string}`, amount: bigint) => {
    const account = useAccountStore().ethConnectAddress as `0x${string}`;
    const allowance: any = await readContract(
        'Token1', 'allowance',
        [account, PCSPermit2],
        token
    );
    if (BigInt(allowance) < amount) {
        const hash = await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [PCSPermit2, maxUint256],
            address: token
        });
        if (!hash) throw errCode.TRANSACTION_INVALID;
    }
}

/**
 * Ensure Permit2 has granted sufficient allowance to Universal Router via permit2.approve()
 */
const ensurePermit2AllowanceForRouter = async (token: `0x${string}`, amount: bigint) => {
    const account = useAccountStore().ethConnectAddress as `0x${string}`;
    
    // Check current allowance from Permit2 to Universal Router
    const result: any = await readContract(
        'Permit2', 'allowance',
        [account, token, PCSUniversalRouter],
        PCSPermit2 as `0x${string}`
    );
    
    const currentAmount = BigInt(result[0] ?? result.amount ?? 0);
    
    if (currentAmount < amount) {
        // Call permit2.approve(token, universalRouter, maxAmount, maxExpiration)
        const hash = await writeContract({
            contractName: 'Permit2',
            functionName: 'approve',
            args: [token, PCSUniversalRouter, BigInt('0xffffffffffffffffffffffffffffffffffffffff'), BigInt('0xffffffffffff')], // uint160 max, uint48 max
            address: PCSPermit2 as `0x${string}`
        });
        if (!hash) throw errCode.TRANSACTION_INVALID;
    }
}

// --- V4 Quote Functions ---

const poolKeyTupleComponents = [
    { type: 'address', name: 'currency0' },
    { type: 'address', name: 'currency1' },
    { type: 'address', name: 'hooks' },
    { type: 'address', name: 'poolManager' },
    { type: 'uint24', name: 'fee' },
    { type: 'bytes32', name: 'parameters' },
] as const

const toQuoterPoolKey = (poolKey: PoolKey) => ({
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
    hooks: poolKey.hooks,
    poolManager: poolKey.poolManager,
    fee: poolKey.fee,
    parameters: poolKey.parameters,
})

const clQuoterAbi = [
    {
        inputs: [{
            name: 'params',
            type: 'tuple',
            components: [
                {
                    name: 'poolKey',
                    type: 'tuple',
                    components: [...poolKeyTupleComponents],
                },
                { name: 'zeroForOne', type: 'bool' },
                { name: 'exactAmount', type: 'uint128' },
                { name: 'hookData', type: 'bytes' },
            ],
        }],
        name: 'quoteExactInputSingle',
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'gasEstimate', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const

const getSlot0Abi = [{
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
        { name: 'sqrtPriceX96', type: 'uint160' },
        { name: 'tick', type: 'int24' },
        { name: 'protocolFee', type: 'uint24' },
        { name: 'lpFee', type: 'uint24' }
    ],
    stateMutability: 'view',
    type: 'function'
}] as const;

/**
 * Read sqrtPriceX96 and lpFee from PCS V4 CLPoolManager by poolId
 */
const getV4PoolState = async (poolId: `0x${string}`) => {
    const publicClient = getReadOnlyClient();
    const [sqrtPriceX96, , , lpFee] = await publicClient.readContract({
        address: PCSCLPoolManager as `0x${string}`,
        abi: getSlot0Abi,
        functionName: 'getSlot0',
        args: [poolId]
    });
    return { sqrtPriceX96: BigInt(sqrtPriceX96), lpFee: Number(lpFee) };
}

/**
 * 通过 PCS CLQuoter 模拟成交，反映真实流动性（非现货线性估算）
 */
const quoteV4ExactInputSingle = async (
    poolKey: PoolKey,
    zeroForOne: boolean,
    exactAmount: bigint,
    sellsman?: `0x${string}` | null | undefined,
): Promise<bigint> => {
    if (exactAmount <= 0n) return 0n
    const publicClient = getReadOnlyClient()
    const hookData = encodeHookData(sellsman)
    const params = {
        poolKey: toQuoterPoolKey(poolKey),
        zeroForOne,
        exactAmount,
        hookData,
    } as const

    try {
        const { result } = await publicClient.simulateContract({
            address: PCSCLQuoter as `0x${string}`,
            abi: clQuoterAbi,
            functionName: 'quoteExactInputSingle',
            args: [params],
            account: '0x0000000000000000000000000000000000000001',
        })
        const amountOut = Array.isArray(result) ? result[0] : (result as { amountOut?: bigint }).amountOut
        return amountOut ?? 0n
    } catch (e) {
        console.warn('CLQuoter quoteExactInputSingle failed', e)
        return 0n
    }
}

/** @deprecated 现货线性估算，薄池严重高估；仅保留供调试对比 */
const getV4BuyQuoteSpot = (sqrtPriceX96: bigint, lpFee: number, ethAmount: bigint): bigint => {
    if (sqrtPriceX96 === 0n) return 0n
    const tokenOut = (ethAmount * sqrtPriceX96 * sqrtPriceX96) / Q192
    return tokenOut * BigInt(1000000 - lpFee) / 1000000n
}

/**
 * 买入询价：BNB → Token，走 CLQuoter 模拟
 */
export const getV4BuyQuote = async (
    poolKey: PoolKey,
    ethAmount: bigint,
    sellsman?: `0x${string}` | null | undefined,
): Promise<bigint> => {
    return quoteV4ExactInputSingle(poolKey, true, ethAmount, sellsman)
}

/**
 * 卖出询价：Token → BNB，走 CLQuoter 模拟
 */
export const getV4SellQuote = async (
    poolKey: PoolKey,
    tokenAmount: bigint,
    sellsman?: `0x${string}` | null | undefined,
): Promise<bigint> => {
    return quoteV4ExactInputSingle(poolKey, false, tokenAmount, sellsman)
}

/** poolId 入口：先反查 PoolKey 再询价 */
export const getV4BuyQuoteByPoolId = async (
    poolId: `0x${string}`,
    ethAmount: bigint,
    sellsman?: `0x${string}` | null | undefined,
) => {
    const poolKey = await getV4PoolKeyByPoolId(poolId)
    return getV4BuyQuote(poolKey, ethAmount, sellsman)
}

export const getV4SellQuoteByPoolId = async (
    poolId: `0x${string}`,
    tokenAmount: bigint,
    sellsman?: `0x${string}` | null | undefined,
) => {
    const poolKey = await getV4PoolKeyByPoolId(poolId)
    return getV4SellQuote(poolKey, tokenAmount, sellsman)
}

/** sqrtPriceX96 → BNB/Token（池子 currency0=BNB, currency1=Token） */
export const sqrtPriceX96ToBnbPerToken = (sqrtPriceX96: bigint): number => {
    if (sqrtPriceX96 === 0n) return 0
    const priceSq = sqrtPriceX96 * sqrtPriceX96
    return Number((Q192 * (10n ** 18n)) / priceSq) / 1e18
}

/** PCS V4 池当前现货价格（BNB/Token） */
export const getV4SpotPrice = async (poolId: `0x${string}`): Promise<number> => {
    const { sqrtPriceX96 } = await getV4PoolState(poolId);
    return sqrtPriceX96ToBnbPerToken(sqrtPriceX96)
}

// --- ABI ---

const universalRouterAbi = [
    {
        inputs: [
            { name: 'commands', type: 'bytes' },
            { name: 'inputs', type: 'bytes[]' },
            { name: 'deadline', type: 'uint256' }
        ],
        name: 'execute',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
    },
    {
        inputs: [
            { name: 'commands', type: 'bytes' },
            { name: 'inputs', type: 'bytes[]' }
        ],
        name: 'execute',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
    }
] as const;
