import type { Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply, IPShareContract1, IPShareContract2, IPShareContract3, wrappedUniswapV2ForTagAI, PumpContract5, AIDeployer, wrappedUniswapV2ForTagAI2, PCSCLPoolManager, NutboxCommittee, usesThirdPartyMarketCap } from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, PumpContract6, PumpContract7, PumpContract8, PumpContract9, Ether, ClaimFee, USD_CONTRACTS, OracleDistributor, OracleDistributorV2, ImportHelper as ImportHelperAddress, HourlyTickCalculator, LinearCalculator as LinearCalculatorAddress, LinearTimeCalculator as LinearTimeCalculatorAddress } from "@/config";
import { abis } from './abis'
import { getEthPrice } from "@/apis/api";
import { aggregateWithRpcFallback } from './multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useStateStore } from "@/stores/common";
import { getTradeSignature, isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, encodeAbiParameters, keccak256, parseEther, type Hex, type Log } from "viem";
import { writeContract, readContract, resolveContractAddress } from "./contract";
import { useChainStore } from '@/stores/chain';
import { getReadOnlyClient } from "./wallets";
import { buyTokenV4, sellTokenV4, poolKeyToPoolId, resolveV4PoolId, resolveV4PoolKeyForTrade, sqrtPriceX96ToBnbPerToken } from "./pcsV4Swap";
import { buildRhV4SqrtPriceMulticall, getRhV4SpotPrice, resolveRhV4PoolKeyForTrade } from "./rhV4Swap";
import { findPumpDeploySalt, getCreatePumpDeployment, verifyPumpSaltVanity } from "./pumpSalt";
import { isPcsV4Version, usesNutboxSocialPool, hasPumpTotalClaimedSocialRewards } from "./pumpVersion";

const pumpContract = [
    PumpContract1,
    PumpContract2,
    PumpContract3,
    PumpContract4,
    PumpContract5,
    PumpContract6,
    PumpContract7,
    PumpContract8,
    PumpContract9
]

/** 旧版本仅部署在 BSC；v9/v11 从当前链部署配置读取。 */
const getActivePumpAddress = (version: number): string | undefined => {
    const deployment = useChainStore().deployment
    if (version === 9) return deployment.contracts.pump9
    if (version === 11) return deployment.contracts.pump11
    if (deployment.key !== 'bsc') return undefined
    return pumpContract[version - 1]
}

const Q192 = 2n ** 192n;
const SPOT_PRICE_SCALE = 10n ** 36n;
const USD_QUOTE_ADDRESSES = new Set(Object.keys(USD_CONTRACTS).map(address => address.toLowerCase()))

type PoolCurrencies = { token0: string; token1: string }
type QuoteKind = 'native' | 'usd'
const isValidNativeUsdPrice = (value: number) => Number.isFinite(value) && value > 0

const sameToken = (a: string | undefined, b: string | undefined) =>
    Boolean(a && b && a.toLowerCase() === b.toLowerCase())

const normalizeTokenDecimals = (value: unknown): number | undefined => {
    const decimals = Number(value)
    return Number.isInteger(decimals) && decimals >= 0 && decimals <= 255 ? decimals : undefined
}

const getPoolQuoteToken = (
    token: string,
    token0: string,
    token1: string,
): string | undefined => {
    if (sameToken(token, token0)) return token1
    if (sameToken(token, token1)) return token0
    return undefined
}

const getQuoteKind = (quote: string, wrappedNative: string, chainId: number): QuoteKind | undefined => {
    if (sameToken(quote, zeroAddress) || sameToken(quote, wrappedNative)) return 'native'
    // USD_CONTRACTS is the BSC deployment table (USDT/USD1). Do not classify
    // the same numeric addresses as stablecoins on another product chain.
    if (chainId === 56 && USD_QUOTE_ADDRESSES.has(quote.toLowerCase())) return 'usd'
    return undefined
}

const scaledRatioToNumber = (numerator: bigint, denominator: bigint): number | undefined => {
    if (numerator <= 0n || denominator <= 0n) return undefined
    const value = Number(numerator * SPOT_PRICE_SCALE / denominator) / Number(SPOT_PRICE_SCALE)
    return Number.isFinite(value) && value > 0 ? value : undefined
}

type QuoteAwareRawSpotParams = PoolCurrencies & {
    token: string
    tokenDecimals: number
    quoteDecimals: number
    rawToken1PerToken0Numerator: bigint
    rawToken1PerToken0Denominator: bigint
    chainId: number
    wrappedNative: string
    nativeUsdPrice: number
}

/**
 * Convert a pool's raw token1/token0 ratio to native/token display units.
 * Stablecoin quotes are normalized through nativeUsdPrice; unsupported quote
 * assets deliberately fail closed instead of being mislabeled as native.
 */
const getQuoteAwareRawSpotPrice = ({
    token,
    token0,
    token1,
    tokenDecimals,
    quoteDecimals,
    rawToken1PerToken0Numerator,
    rawToken1PerToken0Denominator,
    chainId,
    wrappedNative,
    nativeUsdPrice,
}: QuoteAwareRawSpotParams): number | undefined => {
    const normalizedTokenDecimals = normalizeTokenDecimals(tokenDecimals)
    const normalizedQuoteDecimals = normalizeTokenDecimals(quoteDecimals)
    if (normalizedTokenDecimals === undefined || normalizedQuoteDecimals === undefined) return undefined

    const tokenIs0 = sameToken(token, token0)
    const tokenIs1 = sameToken(token, token1)
    if (tokenIs0 === tokenIs1) return undefined

    const quote = tokenIs0 ? token1 : token0
    const quoteKind = getQuoteKind(quote, wrappedNative, chainId)
    if (!quoteKind) return undefined

    const tokenScale = 10n ** BigInt(normalizedTokenDecimals)
    const quoteScale = 10n ** BigInt(normalizedQuoteDecimals)
    const quotePerToken = tokenIs0
        ? scaledRatioToNumber(
            rawToken1PerToken0Numerator * tokenScale,
            rawToken1PerToken0Denominator * quoteScale,
        )
        : scaledRatioToNumber(
            rawToken1PerToken0Denominator * tokenScale,
            rawToken1PerToken0Numerator * quoteScale,
        )
    if (quotePerToken === undefined) return undefined
    if (quoteKind === 'native') return quotePerToken
    return isValidNativeUsdPrice(nativeUsdPrice) ? quotePerToken / nativeUsdPrice : undefined
}

export type QuoteAwareV3SpotParams = PoolCurrencies & {
    sqrtPriceX96: bigint
    token: string
    tokenDecimals: number
    quoteDecimals: number
    chainId: number
    wrappedNative: string
    nativeUsdPrice: number
}

/** Decode a V3/V4 sqrtPriceX96 using the actual pool direction and token decimals. */
export const getQuoteAwareV3SpotPrice = ({
    sqrtPriceX96,
    ...params
}: QuoteAwareV3SpotParams): number | undefined => {
    if (sqrtPriceX96 <= 0n) return undefined
    return getQuoteAwareRawSpotPrice({
        ...params,
        rawToken1PerToken0Numerator: sqrtPriceX96 * sqrtPriceX96,
        rawToken1PerToken0Denominator: Q192,
    })
}

const getQuoteAwareV2SpotPrice = (
    params: Omit<QuoteAwareRawSpotParams, 'rawToken1PerToken0Numerator' | 'rawToken1PerToken0Denominator'> & {
        reserve0: bigint
        reserve1: bigint
    },
): number | undefined => getQuoteAwareRawSpotPrice({
    ...params,
    rawToken1PerToken0Numerator: params.reserve1,
    rawToken1PerToken0Denominator: params.reserve0,
})

const currencyDecimalsCache = new Map<string, number>()
const currencyDecimalsCacheKey = (chainId: number, currency: string) => `${chainId}:${currency.toLowerCase()}`

const cacheCurrencyDecimals = (chainId: number, currency: string, value: unknown): number | undefined => {
    const decimals = normalizeTokenDecimals(value)
    if (decimals !== undefined) currencyDecimalsCache.set(currencyDecimalsCacheKey(chainId, currency), decimals)
    return decimals
}

const getCachedCurrencyDecimals = (chainId: number, currency: string): number | undefined =>
    currencyDecimalsCache.get(currencyDecimalsCacheKey(chainId, currency))

type CurrencyDecimalsRead = { address: string; returnKey: string }

const getSupportedErc20QuoteAddresses = (): string[] => {
    const deployment = useChainStore().deployment
    const addresses: string[] = [deployment.wrappedNative]
    if (deployment.chainId === 56) addresses.push(...Object.keys(USD_CONTRACTS))
    return Array.from(new Map(addresses
        .filter(address => isAddress(address) && !sameToken(address, zeroAddress))
        .map(address => [address.toLowerCase(), address])).values())
}

const appendMissingQuoteDecimalsCalls = (
    calls: any[],
    prefix: string,
    alreadyRead: Set<string> = new Set(),
    candidates: string[] = getSupportedErc20QuoteAddresses(),
): CurrencyDecimalsRead[] => {
    const deployment = useChainStore().deployment
    const supported = new Set(getSupportedErc20QuoteAddresses().map(address => address.toLowerCase()))
    const reads: CurrencyDecimalsRead[] = []
    for (const address of candidates) {
        const key = address.toLowerCase()
        if (!supported.has(key)) continue
        if (alreadyRead.has(key) || getCachedCurrencyDecimals(deployment.chainId, address) !== undefined) continue
        const returnKey = `${prefix}-quote-${reads.length}-decimals`
        calls.push({
            target: address,
            call: ['decimals()(uint8)'],
            returns: [[returnKey]],
        })
        reads.push({ address, returnKey })
    }
    return reads
}

const cacheQuoteDecimalsReads = (reads: CurrencyDecimalsRead[], data: Record<string, any>) => {
    const chainId = useChainStore().deployment.chainId
    for (const read of reads) cacheCurrencyDecimals(chainId, read.address, data[read.returnKey])
}

type ImportV4Pool = PoolCurrencies & { poolId: `0x${string}` }
const importV4PoolCache = new Map<string, Promise<ImportV4Pool | undefined>>()
const importV4PoolFailureUntil = new Map<string, number>()
const IMPORT_V4_POOL_FAILURE_BACKOFF_MS = 5 * 60 * 1000

const RH_V4_POOL_KEY_ENCODE_TYPES = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'currency0' },
        { type: 'address', name: 'currency1' },
        { type: 'uint24', name: 'fee' },
        { type: 'int24', name: 'tickSpacing' },
        { type: 'address', name: 'hooks' },
    ],
}] as const

const resolveImportV4PoolUncached = async (pair: string): Promise<ImportV4Pool | undefined> => {
    const deployment = useChainStore().deployment
    if (deployment.dex.kind === 'uniswap') {
        const key = await resolveRhV4PoolKeyForTrade(pair)
        if (!key) return undefined
        const storedPoolId = pair.trim().startsWith('0x') && pair.trim().length === 66
            ? pair.trim() as `0x${string}`
            : undefined
        const computedPoolId = keccak256(encodeAbiParameters(RH_V4_POOL_KEY_ENCODE_TYPES, [key]))
        if (storedPoolId && storedPoolId.toLowerCase() !== computedPoolId.toLowerCase()) return undefined
        return { poolId: computedPoolId, token0: key.currency0, token1: key.currency1 }
    }

    const key = await resolveV4PoolKeyForTrade(pair)
    const storedPoolId = resolveV4PoolId(pair)
    if (!key || !storedPoolId) return undefined
    const computedPoolId = poolKeyToPoolId(key)
    if (storedPoolId.toLowerCase() !== computedPoolId.toLowerCase()) return undefined
    return { poolId: computedPoolId, token0: key.currency0, token1: key.currency1 }
}

const resolveImportV4Pool = async (pair: string): Promise<ImportV4Pool | undefined> => {
    const deployment = useChainStore().deployment
    const cacheKey = `${deployment.chainId}:${pair.trim().toLowerCase()}`
    if ((importV4PoolFailureUntil.get(cacheKey) ?? 0) > Date.now()) return undefined
    const cached = importV4PoolCache.get(cacheKey)
    if (cached) return cached
    const loading = resolveImportV4PoolUncached(pair)
    importV4PoolCache.set(cacheKey, loading)
    try {
        const pool = await loading
        if (pool) importV4PoolFailureUntil.delete(cacheKey)
        else {
            importV4PoolCache.delete(cacheKey)
            importV4PoolFailureUntil.set(cacheKey, Date.now() + IMPORT_V4_POOL_FAILURE_BACKOFF_MS)
        }
        return pool
    } catch (error) {
        importV4PoolCache.delete(cacheKey)
        importV4PoolFailureUntil.set(cacheKey, Date.now() + IMPORT_V4_POOL_FAILURE_BACKOFF_MS)
        throw error
    }
}

export const checkTickUsed = async (tick: string) => {
    const created = await isTokenExist(tick);
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    const userAddress = useAccountStore().ethConnectAddress as `0x${string}`;
    const createPump = getCreatePumpDeployment();
    const salt = await findPumpDeploySalt(userAddress);
    // 部署前链上二次校验，防止本地缓存 salt 或 predict 偏差导致非靓号地址
    await verifyPumpSaltVanity(userAddress, salt);
    const createFee = await getCreatePumpFee(userAddress);

    let hash = await writeContract({
        contractName: createPump.contractName,
        functionName: 'createToken',
        args: [createParms.tick, salt],
        value: (createParms.initEth ?? 0n) + createFee
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    let tx = await getTransactionReceipt(hash as `0x${string}`)
    const event: any = getCreateTokenEventByHash(tx, createPump.version);
    if (event?.tick == createParms.tick) {
        return {token: event.token, createHash: tx.transactionHash, version: createPump.version}
    }
    return {createHash: hash, version: createPump.version}
}

/** 当前链最新 Pump 创建固定费用：Pump + Nutbox Committee + 可选 IPShare 创建费。 */
export const getCreatePumpFee = async (userAddress: `0x${string}`): Promise<bigint> => {
    const { contractName } = getCreatePumpDeployment();
    const [pumpFee, commFee, settingsFee, ipshareCreated] = await Promise.all([
        readContract(contractName, 'createFee', []) as Promise<bigint>,
        readContract('NutboxCommittee', 'getCreateCommunityFee', []) as Promise<bigint>,
        readContract('NutboxCommittee', 'getCommunitySettingsFee', []) as Promise<bigint>,
        readContract('IPShare3', 'ipshareCreated', [userAddress]) as Promise<boolean>,
    ]);
    let ipshareFee = 0n;
    if (!ipshareCreated) {
        ipshareFee = await readContract('IPShare3', 'createFee', []) as bigint;
    }
    return pumpFee + commFee + settingsFee + ipshareFee;
}

// ==================== ImportHelper (V10 导入代币) ====================

export type ImportCommunityFee = { createFee: bigint; settingsFee: bigint; ipshareCreateFee: bigint; total: bigint; createsIPShare: boolean }

/** 与 ImportHelper 的链上费用算法保持一致；tick 仍由 API/DB 保证全局唯一。 */
export const getImportCommunityFee = async (importer: `0x${string}`): Promise<ImportCommunityFee> => {
    const { features } = useChainStore().deployment;
    const [createFee, settingsFee] = await Promise.all([
        readContract('NutboxCommittee', 'getCreateCommunityFee', []) as Promise<bigint>,
        readContract('NutboxCommittee', 'getCommunitySettingsFee', []) as Promise<bigint>,
    ]);

    // BSC ImportHelper 只收取 Nutbox 社区创建和设置费用；它不会在
    // 导入过程中创建 IPShare。
    if (!features.enhancedImportHelper) {
        return { createFee, settingsFee, ipshareCreateFee: 0n, total: createFee + settingsFee, createsIPShare: false };
    }

    const hasIPShare = await readContract('IPShare3', 'ipshareCreated', [importer]) as boolean;
    const ipshareCreateFee = hasIPShare ? 0n : await readContract('IPShare3', 'createFee', []) as bigint;
    return {
        createFee,
        settingsFee,
        ipshareCreateFee,
        total: createFee + (settingsFee * 2n) + ipshareCreateFee,
        createsIPShare: !hasIPShare,
    };
}

/** 创建 Nutbox Community，并使用固定 HourlyTickCalculator 建立 Social Curation 分发池。 */
export const deployNutboxCommunity = async (
    token: `0x${string}`
): Promise<{ community: string; pool: string; txHash: string }> => {
    const importer = useAccountStore().ethConnectAddress as `0x${string}`;
    const fee = await getImportCommunityFee(importer);
    const hash = await writeContract({
        contractName: 'ImportHelper',
        functionName: 'createCommunityAndPool',
        // 用户导入始终创建新 Community；已有 Community 复用入口仅供线下操作。
        args: [token, zeroAddress],
        value: fee.total
    });
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    const tx = await getTransactionReceipt(hash as `0x${string}`);
    const event = getCommunityCreatedEvent(tx);
    if (!event || (event as any).creator?.toLowerCase() !== importer.toLowerCase()) {
        throw new Error('ImportHelper receipt did not contain the expected CommunityCreated event');
    }

    // 仅在支持 importerOf / IPShare 的链上部署执行增强校验。
    // BSC 以交易回执中的 CommunityCreated.creator 作为成功依据。
    if (useChainStore().deployment.features.enhancedImportHelper) {
        const [recordedImporter, hasIPShare] = await Promise.all([
            readContract('ImportHelper', 'importerOf', [token]) as Promise<string>,
            readContract('IPShare3', 'ipshareCreated', [importer]) as Promise<boolean>,
        ]);
        if (recordedImporter.toLowerCase() !== importer.toLowerCase() || !hasIPShare) {
            throw new Error('Imported community ownership or IPShare creation verification failed');
        }
    }
    return {
        community: (event as any)?.community ?? zeroAddress,
        pool: (event as any)?.pool ?? zeroAddress,
        txHash: hash
    };
}

type ImportedSwapSource = {
    sourceType: 0 | 1 | 2 | 3
    sourceData: Hex
}

const V2_SOURCE_PARAMETERS = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'router' },
        { type: 'address', name: 'pair' },
    ],
}] as const

const V3_SOURCE_PARAMETERS = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'router' },
        { type: 'address', name: 'quoter' },
        { type: 'address', name: 'pool' },
    ],
}] as const

const PANCAKE_V4_SOURCE_PARAMETERS = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'quoter' },
        {
            type: 'tuple',
            name: 'pool',
            components: [
                { type: 'address', name: 'currency0' },
                { type: 'address', name: 'currency1' },
                { type: 'address', name: 'hooks' },
                { type: 'address', name: 'poolManager' },
                { type: 'uint24', name: 'fee' },
                { type: 'bytes32', name: 'parameters' },
            ],
        },
    ],
}] as const

const RH_V4_SOURCE_PARAMETERS = [{
    type: 'tuple',
    components: [
        { type: 'address', name: 'poolManager' },
        { type: 'address', name: 'currency0' },
        { type: 'address', name: 'currency1' },
        { type: 'uint24', name: 'fee' },
        { type: 'int24', name: 'tickSpacing' },
        { type: 'address', name: 'hooks' },
    ],
}] as const

/** Encode the backend-selected imported-token pool for one Wrapper quote/trade. */
export const buildImportedTokenSwapSource = async (
    dexVersion: number,
    pair: string | null | undefined,
): Promise<ImportedSwapSource> => {
    const deployment = useChainStore().deployment
    if (dexVersion === 2) {
        if (!pair || !isAddress(pair)) throw new Error('Imported V2 pair is unavailable')
        return {
            sourceType: 0,
            sourceData: encodeAbiParameters(V2_SOURCE_PARAMETERS, [{
                router: deployment.dex.v2Router,
                pair: pair as `0x${string}`,
            }]),
        }
    }

    if (dexVersion === 3) {
        if (!pair || !isAddress(pair)) throw new Error('Imported V3 pool is unavailable')
        if (deployment.dex.v3SmartRouter === zeroAddress || deployment.dex.v3Quoter === zeroAddress) {
            throw new Error('Imported V3 router or quoter is unavailable')
        }
        return {
            sourceType: 1,
            sourceData: encodeAbiParameters(V3_SOURCE_PARAMETERS, [{
                router: deployment.dex.v3SmartRouter,
                quoter: deployment.dex.v3Quoter,
                pool: pair as `0x${string}`,
            }]),
        }
    }

    if (dexVersion === 4) {
        if (deployment.key === 'rh') {
            const pool = await resolveRhV4PoolKeyForTrade(pair)
            if (!pool) throw new Error('Imported V4 PoolKey is unavailable')
            return {
                sourceType: 2,
                sourceData: encodeAbiParameters(RH_V4_SOURCE_PARAMETERS, [{
                    poolManager: deployment.dex.v4PoolManager,
                    ...pool,
                }]),
            }
        }
        const pool = await resolveV4PoolKeyForTrade(pair)
        if (!pool) throw new Error('Imported V4 PoolKey is unavailable')
        if (deployment.dex.v4Quoter === zeroAddress) throw new Error('Imported V4 quoter is unavailable')
        return {
            sourceType: 3,
            sourceData: encodeAbiParameters(PANCAKE_V4_SOURCE_PARAMETERS, [{
                quoter: deployment.dex.v4Quoter,
                pool,
            }]),
        }
    }

    throw new Error(`Unsupported imported-token DEX version: ${dexVersion}`)
}

const readImportedTokenQuote = async (
    functionName: 'quoteBuy' | 'quoteSell',
    token: string,
    pair: string | null | undefined,
    dexVersion: number,
    amountIn: bigint,
): Promise<bigint> => {
    if (!isAddress(token) || amountIn <= 0n) throw errCode.PARAMS_ERROR
    const wrapper = resolveContractAddress('ImportedTokenSwapWrapper')
    if (!wrapper) throw new Error('ImportedTokenSwapWrapper is not configured')
    const { sourceType, sourceData } = await buildImportedTokenSwapSource(Number(dexVersion), pair)
    // quoteBuy / quoteSell are caller-independent view functions. Reading them
    // directly avoids making a quote depend on the connected wallet's `from`
    // address (some wallet/account combinations reject the simulated write and
    // the trade panel previously turned that failure into a misleading zero).
    return await getReadOnlyClient().readContract({
        address: wrapper,
        abi: abis.ImportedTokenSwapWrapper,
        functionName,
        args: [token, sourceType, sourceData, amountIn],
    } as any) as bigint
}

export const quoteImportedTokenBuy = (
    token: string,
    pair: string | null | undefined,
    dexVersion: number,
    nativeAmountIn: bigint,
) => readImportedTokenQuote('quoteBuy', token, pair, dexVersion, nativeAmountIn)

/**
 * Simulate the complete imported-token buy and return the amount that reaches
 * the recipient. The wrapper's quoteBuy result is theoretical for V2/V3
 * transfer-tax tokens, so using it as the slippage baseline can make a valid
 * swap revert after the token deducts its own fee.
 */
export const simulateImportedTokenBuy = async (
    token: string,
    pair: string | null | undefined,
    dexVersion: number,
    nativeAmountIn: bigint,
    recipient?: string | null,
    sellsman?: string | null,
): Promise<bigint> => {
    if (!isAddress(token) || nativeAmountIn <= 0n) throw errCode.PARAMS_ERROR
    const account = recipient ?? useAccountStore().ethConnectAddress
    if (!isAddress(account ?? '')) throw new Error('Connect a wallet to simulate trading')

    const wrapper = resolveContractAddress('ImportedTokenSwapWrapper')
    if (!wrapper) throw new Error('ImportedTokenSwapWrapper is not configured')
    const { sourceType, sourceData } = await buildImportedTokenSwapSource(Number(dexVersion), pair)
    const resolvedSellsman = isAddress(sellsman ?? '') ? sellsman as `0x${string}` : zeroAddress
    const { result } = await getReadOnlyClient().simulateContract({
        address: wrapper,
        abi: abis.ImportedTokenSwapWrapper,
        functionName: 'buyToken',
        args: [
            token as `0x${string}`,
            sourceType,
            sourceData,
            1n,
            account as `0x${string}`,
            BigInt(Math.floor(Date.now() / 1000) + 300),
            resolvedSellsman,
        ],
        account: account as `0x${string}`,
        value: nativeAmountIn,
    } as any)
    const amountOut = BigInt(result as bigint)
    if (amountOut <= 0n) throw new Error('Imported-token simulation returned zero output')
    return amountOut
}

export const quoteImportedTokenSell = (
    token: string,
    pair: string | null | undefined,
    dexVersion: number,
    tokenAmountIn: bigint,
) => readImportedTokenQuote('quoteSell', token, pair, dexVersion, tokenAmountIn)

export type ImportedPoolValidation = {
    supported: boolean
    buyAmountOut: bigint
    sellAmountOut: bigint
    error?: string
}

const formatImportedPoolValidationError = (error: any): string => {
    const message = error?.shortMessage
        ?? error?.cause?.shortMessage
        ?? error?.message
        ?? String(error)
    return String(message).split('\n')[0].slice(0, 160)
}

/**
 * Read-only validation for a candidate imported-token pool. It verifies both
 * final-output quotes, then simulates the actual buy entrypoint so no wallet
 * transaction is submitted while checking the DEX executor and bridge route.
 */
export const validateImportedTokenPool = async (
    token: string,
    pair: string,
    dexVersion: number,
): Promise<ImportedPoolValidation> => {
    try {
        const account = useAccountStore().ethConnectAddress
        if (!isAddress(account ?? '')) throw new Error('Connect a wallet to validate trading')
        const validationNativeIn = 1_000_000_000_000n // 0.000001 BNB; eth_call only.
        const buyAmountOut = await quoteImportedTokenBuy(token, pair, dexVersion, validationNativeIn)
        if (buyAmountOut <= 0n) throw new Error('Buy quote returned zero output')
        const sellAmountOut = await quoteImportedTokenSell(token, pair, dexVersion, buyAmountOut)
        if (sellAmountOut <= 0n) throw new Error('Sell quote returned zero output')

        const wrapper = resolveContractAddress('ImportedTokenSwapWrapper')
        if (!wrapper) throw new Error('ImportedTokenSwapWrapper is not configured')
        const { sourceType, sourceData } = await buildImportedTokenSwapSource(Number(dexVersion), pair)
        await getReadOnlyClient().simulateContract({
            address: wrapper,
            abi: abis.ImportedTokenSwapWrapper,
            functionName: 'buyToken',
            args: [
                token as `0x${string}`,
                sourceType,
                sourceData,
                1n,
                account as `0x${string}`,
                BigInt(Math.floor(Date.now() / 1000) + 300),
                zeroAddress,
            ],
            account: account as `0x${string}`,
            value: validationNativeIn,
        } as any)
        return { supported: true, buyAmountOut, sellAmountOut }
    } catch (error) {
        return {
            supported: false,
            buyAmountOut: 0n,
            sellAmountOut: 0n,
            error: formatImportedPoolValidationError(error),
        }
    }
}

/** 注入代币到 HourlyTickCalculator（开启社交分发） */
export const injectTokens = async (
    community: `0x${string}`,
    token: `0x${string}`,
    amount: bigint
): Promise<string> => {
    const userAddress = useAccountStore().ethConnectAddress as `0x${string}`;
    const hourlyTickCalculator = useChainStore().deployment.contracts.hourlyTickCalculator;
    // 检查 allowance
    const allowance = await readContract('Token1', 'allowance', [userAddress, hourlyTickCalculator], token) as bigint;
    if (allowance < amount) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [hourlyTickCalculator, amount],
            address: token
        });
    }
    const hash = await writeContract({
        contractName: 'HourlyTickCalculator',
        functionName: 'inject',
        args: [community, amount]
    });
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash;
}

/** 从 receipt 解析 CommunityCreated event */
const getCommunityCreatedEvent = (tx: { logs: Log[] }) => {
    try {
        const events = parseEventLogs({
            abi: abis.ImportHelper,
            logs: tx.logs,
        });
        for (const event of events) {
            if ((event as any).eventName === 'CommunityCreated') {
                return (event as any).args;
            }
        }
    } catch (err) {
        console.error('Parse CommunityCreated event failed:', err);
    }
    return null;
}

/** Nutbox 比例基数（Community.sol CONSTANTS_10000） */
const NUTBOX_RATIO_BASE = 10000n
/** (10000 - feeRatio) * poolRatio 的分母 */
const NUTBOX_SOCIAL_SCALE_DIVISOR = 100000000n
/** Community.sol private mapping poolRatios 的 storage slot */
const NUTBOX_POOL_RATIOS_STORAGE_SLOT = 10n

/** 读取社交矿池在 Nutbox 社区中的 poolRatio（mapping 为 private，优先 storage） */
export async function readNutboxPoolRatio(community: `0x${string}`, pool: `0x${string}`): Promise<bigint> {
    const slot = keccak256(encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [pool, NUTBOX_POOL_RATIOS_STORAGE_SLOT]
    ))
    const raw = await getReadOnlyClient().getStorageAt({ address: community, slot })
    const ratio = raw != null ? BigInt(raw) : 0n
    if (ratio > 0n) return ratio

    // Pump9 默认单社交矿池占 100%
    return NUTBOX_RATIO_BASE
}

/** Return the net reward share allocated to any Nutbox pool. */
export async function getNutboxPoolScale(community: `0x${string}`, pool: `0x${string}`) {
    const [feeRatio, poolRatio] = await Promise.all([
        readContract('NutboxCommunity', 'feeRatio', [], community).then(v => BigInt(v as number | bigint)),
        readNutboxPoolRatio(community, pool),
    ])
    return {
        feeRatio,
        poolRatio,
        scaleNumerator: (NUTBOX_RATIO_BASE - feeRatio) * poolRatio,
        scaleDenominator: NUTBOX_SOCIAL_SCALE_DIVISOR,
    }
}

/** Nutbox 社区奖励中实际进入社交矿池的比例：(10000 - feeRatio) * poolRatio / 100000000 */
async function getNutboxSocialPoolScale(community: `0x${string}`, socialPool: `0x${string}`) {
    return getNutboxPoolScale(community, socialPool)
}

function applyNutboxSocialPoolScale(amount: bigint, scaleNumerator: bigint, scaleDenominator: bigint) {
    return amount * scaleNumerator / scaleDenominator
}

/** v9 代币：按天聚合 HourlyTickCalculator 分发量（过去 7 天含今天 + 明日） */
export const getV9DailyRewards = async (token: `0x${string}`) => {
    const SECONDS_PER_DAY = 86400
    const PAST_DAYS = 6 // 索引 0~6 为过去 7 天（含今天）
    const TOTAL_DAYS = 8 // 含明日

    const getLocalDayStartSec = (dayOffset: number) => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + dayOffset)
        return Math.floor(d.getTime() / 1000)
    }

    const community = await readContract('Token9', 'nutboxCommunity', [], token) as `0x${string}`;
    const socialPool = await readContract('Token9', 'nutboxSocialPool', [], token) as `0x${string}`;
    const { feeRatio, poolRatio, scaleNumerator, scaleDenominator } =
        await getNutboxSocialPoolScale(community, socialPool)

    const rangeStart = getLocalDayStartSec(-PAST_DAYS)
    const communityHourlyRewards = await readContract(
        'HourlyTickCalculator',
        'getHourlyRewards',
        [community, BigInt(rangeStart), BigInt(TOTAL_DAYS * 24)]
    ) as bigint[];
    // HourlyTickCalculator returns rewards for the whole Nutbox community.
    // The reward dialog only represents this token's social distribution pool.
    const hourlyRewards = communityHourlyRewards.map(amount =>
        applyNutboxSocialPoolScale(amount, scaleNumerator, scaleDenominator)
    )

    const dailyRewards = Array.from({ length: TOTAL_DAYS }, () => 0n)
    for (let i = 0; i < hourlyRewards.length; i++) {
        const dayIdx = Math.floor(i / 24)
        if (dayIdx < TOTAL_DAYS) {
            dailyRewards[dayIdx] += hourlyRewards[i]
        }
    }

    const dayStarts = Array.from(
        { length: TOTAL_DAYS },
        (_, d) => rangeStart + d * SECONDS_PER_DAY
    )
    return { dailyRewards, dayStarts, todayIndex: PAST_DAYS, community, socialPool, feeRatio, poolRatio, hourlyRewards }
}

/** @deprecated 使用 getV9DailyRewards */
export const getV9HourlyRewards = async (token: `0x${string}`) => {
    const community = await readContract('Token9', 'nutboxCommunity', [], token) as `0x${string}`;
    const startTimestamp = BigInt(Math.floor(Date.now() / 1000 / 3600) * 3600);
    const rewards = await readContract(
        'HourlyTickCalculator',
        'getHourlyRewards',
        [community, startTimestamp, 24n]
    ) as bigint[];
    return { rewards, startTimestamp, community };
}

export type V10DistributionInfo = {
    calculator: string
    calculatorType: 'hourly' | 'timestamp' | 'block'
    hourly?: {
        dailyRewards: bigint[]
        dayStarts: number[]
        todayIndex: number
        community: string
        socialPool: string
        feeRatio: bigint
        poolRatio: bigint
        hourlyRewards: bigint[]
    }
    phases?: {
        amount: bigint    // per second (timestamp) or per block (block)
        startCursor: bigint
        stopCursor: bigint
    }[]
    community: string
    socialPool: string
}

/** v10 导入代币：根据社区使用的分发策略获取分发信息 */
export const getV10DistributionInfo = async (communityAddress: string, socialPoolAddress: string): Promise<V10DistributionInfo | null> => {
    if (!isAddress(communityAddress)) return null
    const community = communityAddress as `0x${string}`
    const socialPool = socialPoolAddress as `0x${string}`

    try {
        const calculator = await readContract('NutboxCommunity', 'rewardCalculator', [], community) as string
        const calculatorLower = calculator.toLowerCase()

        if (calculatorLower === useChainStore().deployment.contracts.hourlyTickCalculator.toLowerCase()) {
            const { dailyRewards, dayStarts, todayIndex, feeRatio, poolRatio, hourlyRewards } =
                await getV9DailyRewardsByCommunity(community, socialPool)
            return {
                calculator,
                calculatorType: 'hourly',
                hourly: { dailyRewards, dayStarts, todayIndex, community, socialPool, feeRatio, poolRatio, hourlyRewards },
                community,
                socialPool
            }
        }

        if (calculatorLower === LinearTimeCalculatorAddress.toLowerCase()) {
            const phases = await readDistributionEras('LinearTimeCalculator', community)
            return { calculator, calculatorType: 'timestamp', phases, community, socialPool }
        }

        if (calculatorLower === LinearCalculatorAddress.toLowerCase()) {
            const phases = await readDistributionEras('LinearCalculator', community)
            return { calculator, calculatorType: 'block', phases, community, socialPool }
        }

        console.warn('Unknown calculator:', calculator)
        return null
    } catch (e) {
        console.error('getV10DistributionInfo failed', e)
        return null
    }
}

/** 从 LinearCalculator / LinearTimeCalculator 读取分发阶段列表 */
async function readDistributionEras(contractName: string, community: `0x${string}`) {
    const count = await readContract(contractName, 'distributionCountMap', [], community) as bigint
    const phases: { amount: bigint; startCursor: bigint; stopCursor: bigint }[] = []
    for (let i = 0n; i < count; i++) {
        const era = await readContract(contractName, 'distributionErasMap', [community, i]) as [bigint, bigint, bigint]
        phases.push({ amount: era[0], startCursor: era[1], stopCursor: era[2] })
    }
    return phases
}

/** 按社区地址获取 HourlyTickCalculator 每日分发量（与 getV9DailyRewards 逻辑相同，但直接传入 community/socialPool） */
async function getV9DailyRewardsByCommunity(community: `0x${string}`, socialPool: `0x${string}`) {
    const SECONDS_PER_DAY = 86400
    const PAST_DAYS = 6
    const TOTAL_DAYS = 8

    const getLocalDayStartSec = (dayOffset: number) => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + dayOffset)
        return Math.floor(d.getTime() / 1000)
    }

    const { feeRatio, poolRatio, scaleNumerator, scaleDenominator } =
        await getNutboxSocialPoolScale(community, socialPool)

    const rangeStart = getLocalDayStartSec(-PAST_DAYS)
    const communityHourlyRewards = await readContract(
        'HourlyTickCalculator',
        'getHourlyRewards',
        [community, BigInt(rangeStart), BigInt(TOTAL_DAYS * 24)]
    ) as bigint[];
    const hourlyRewards = communityHourlyRewards.map(amount =>
        applyNutboxSocialPoolScale(amount, scaleNumerator, scaleDenominator)
    )

    const dailyRewards = Array.from({ length: TOTAL_DAYS }, () => 0n)
    for (let i = 0; i < hourlyRewards.length; i++) {
        const dayIdx = Math.floor(i / 24)
        if (dayIdx < TOTAL_DAYS) {
            dailyRewards[dayIdx] += hourlyRewards[i]
        }
    }

    const dayStarts = Array.from(
        { length: TOTAL_DAYS },
        (_, d) => rangeStart + d * SECONDS_PER_DAY
    )
    return { dailyRewards, dayStarts, todayIndex: PAST_DAYS, community, socialPool, feeRatio, poolRatio, hourlyRewards }
}

export const buyToken = async (token: string, version: number, amount: bigint, ethAmount: bigint, sellsman: `0x${string}` | undefined | null, listed: boolean, isImport: boolean, slippage = 0, dexVersion = 2, pair?: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!sellsman || !isAddress(sellsman)) {
        sellsman = zeroAddress;
    }
    const activeDeployment = useChainStore().deployment
    if (isImport && Number(version) === 10) {
        const wrapper = resolveContractAddress('ImportedTokenSwapWrapper')
        if (!wrapper) throw new Error('ImportedTokenSwapWrapper is not configured')
        const { sourceType, sourceData } = await buildImportedTokenSwapSource(Number(dexVersion), pair)
        const minimumTokenOut = amount * BigInt(10000 - slippage) / 10000n
        return writeContract({
            contractName: 'ImportedTokenSwapWrapper',
            functionName: 'buyToken',
            args: [
                token,
                sourceType,
                sourceData,
                minimumTokenOut,
                useAccountStore().ethConnectAddress,
                Math.floor(Date.now() / 1000) + 300,
                sellsman,
            ],
            value: ethAmount,
        })
    }
    if (listed) {
        // v7/v8/v9/v11 上架后代币走 PCS V4（BuyAndSellView 使用 buyTokenV4）
        if (isPcsV4Version(version)) {
            throw new Error('V7/V8/V9/V11 listed buy should use buyTokenV4 directly');
        }

        if (isImport) {
            const deployment = useChainStore().deployment
            dexVersion = Number(dexVersion)
            if (dexVersion === 2) await resolveV2NativePair(token)
            if (deployment.dex.kind === 'uniswap' || dexVersion === 3) {
                const router = dexVersion === 3 ? deployment.dex.v3Router : deployment.dex.v2Router
                const wrapper = resolveContractAddress(deployment.key === 'rh' ? 'LegacyTagAISwapWrapper' : 'TagAISwapWrapper')
                if (router === zeroAddress) throw new Error(`Uniswap V${dexVersion} router is not configured on ${deployment.name}`)
                if (!wrapper) throw new Error(`Legacy imported-token wrapper is not configured on ${deployment.name}`)
                if (dexVersion !== 2 && dexVersion !== 3) throw new Error(`Unsupported imported-token DEX version: ${dexVersion}`)
                const poolFee = dexVersion === 3
                    ? (await resolveV3NativePool(token, pair)).fee
                    : 0
                const functionName = dexVersion === 3 ? 'buyTokenV3' : 'buyToken'
                const args = dexVersion === 3
                    ? [sellsman, amount * BigInt(10000 - slippage) / 10000n, token, useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, router, poolFee]
                    : [sellsman, amount * BigInt(10000 - slippage) / 10000n, [deployment.wrappedNative, token], useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, router]
                return writeContract({ contractName: 'TagAISwapWrapper', functionName, args, value: ethAmount, address: wrapper })
            }
            // BSC V2 legacy path.
            const amountOut = await getImportedV2BuyAmountUseNative(token, ethAmount * 9800n / 10000n);
            const hash = await writeContract({
                contractName: 'WrapSwaper2',
                functionName: 'buyToken',
                args: [sellsman, 
                    amountOut * BigInt(10000 - slippage) / 10000n, 
                    [WETH, token], 
                    useAccountStore().ethConnectAddress, 
                    Math.floor(Date.now() / 1000) + 300, 
                    uniswapV2Router02],
                value: ethAmount
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else {
            const amountOut = await getBuyAmountUseEth(token, ethAmount * 9800n / 10000n);
            const hash = await writeContract({
                contractName: 'WrapSwaper',
                functionName: 'buyToken',
                args: [sellsman, 
                    amountOut * BigInt(10000 - slippage) / 10000n, 
                    [WETH, token], 
                    useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, 
                    IPShareContract3],
                value: ethAmount
            })
            if (!hash) {    
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
    }else {
        if (version == 1) {
            const hash = await writeContract({
                contractName: 'Token1',
                functionName: 'buyToken',
                args: [amount, sellsman, slippage, zeroAddress],
                value: ethAmount,
                address: token
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else if (version == 5) {
            // get trade signature
            const result: any = await getTradeSignature(useAccountStore().ethConnectAddress);
            const hash = await writeContract({
                contractName: 'Token5',
                functionName: 'buyToken',
                args: [amount, sellsman, slippage, result.signature],
                value: ethAmount,
                address: token
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else {
            const hash = await writeContract({
                contractName: 'Token' + version,
                functionName: 'buyToken',
                args: [amount, sellsman, slippage],
                value: ethAmount,
                address: token
            })
            if (!hash) {    
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
    }
}

export const sellToken = async (token: string, version: number, amount: bigint, receiveEth: bigint, sellsman: `0x${string}` | undefined | null, listed: boolean, isImport: boolean, slippage = 0, dexVersion = 2, pair?: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!sellsman || !isAddress(sellsman)) {
        sellsman = zeroAddress;
    }
    const activeDeployment = useChainStore().deployment
    if (isImport && Number(version) === 10) {
        const wrapper = resolveContractAddress('ImportedTokenSwapWrapper')
        if (!wrapper) throw new Error('ImportedTokenSwapWrapper is not configured')
        const { sourceType, sourceData } = await buildImportedTokenSwapSource(Number(dexVersion), pair)
        const user = useAccountStore().ethConnectAddress as `0x${string}`
        const allowance = await readContract('Token1', 'allowance', [user, wrapper], token as `0x${string}`) as bigint
        if (allowance < amount) {
            const approvalHash = await writeContract({
                contractName: 'Token1',
                functionName: 'approve',
                args: [wrapper, amount],
                address: token as `0x${string}`,
            })
            if (!approvalHash) throw errCode.TRANSACTION_INVALID
        }
        const minimumNativeOut = receiveEth * BigInt(10000 - slippage) / 10000n
        return writeContract({
            contractName: 'ImportedTokenSwapWrapper',
            functionName: 'sellToken',
            args: [
                token,
                sourceType,
                sourceData,
                amount,
                minimumNativeOut,
                user,
                Math.floor(Date.now() / 1000) + 300,
                sellsman,
            ],
        })
    }
    if (listed) {
        if (isPcsV4Version(version)) {
            throw new Error('V7/V8/V9/V11 listed sell should use sellTokenV4 directly');
        }

        if (isImport) {
            const deployment = useChainStore().deployment
            dexVersion = Number(dexVersion)
            if (dexVersion === 2) await resolveV2NativePair(token)
            if (deployment.dex.kind === 'uniswap' || dexVersion === 3) {
                const router = dexVersion === 3 ? deployment.dex.v3Router : deployment.dex.v2Router
                const wrapper = resolveContractAddress(deployment.key === 'rh' ? 'LegacyTagAISwapWrapper' : 'TagAISwapWrapper')
                if (!wrapper || router === zeroAddress) throw new Error(`Uniswap V${dexVersion} trading is not configured on ${deployment.name}`)
                if (dexVersion !== 2 && dexVersion !== 3) throw new Error(`Unsupported imported-token DEX version: ${dexVersion}`)
                const poolFee = dexVersion === 3
                    ? (await resolveV3NativePool(token, pair)).fee
                    : 0
                const allowance = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, wrapper], token) as bigint
                if (allowance < amount) {
                    await writeContract({ contractName: 'Token1', functionName: 'approve', args: [wrapper, amount], address: token })
                }
                const minOut = receiveEth * BigInt(10000 - slippage) / 10000n
                const functionName = dexVersion === 3 ? 'sellTokenV3' : 'sellToken'
                const args = dexVersion === 3
                    ? [amount, minOut, token, useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, sellsman, router, poolFee]
                    : [amount, minOut, [token, deployment.wrappedNative], useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, sellsman, router]
                return writeContract({ contractName: 'TagAISwapWrapper', functionName, args, address: wrapper })
            }
            // BSC V2 legacy path.
            const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, wrappedUniswapV2ForTagAI2], token)
            if (allowance < amount) {
                // 安全: 只授权所需金额，避免无限授权风险
                const approvalAmount = amount * 2n; // 授权2倍所需金额，减少频繁授权
                const hash = await writeContract({
                    contractName: 'Token1',
                    functionName: 'approve',
                    args: [wrappedUniswapV2ForTagAI2, approvalAmount],
                    address: token
                })
                if (!hash) {
                    throw errCode.TRANSACTION_INVALID;
                }
            }

            const expectedReceive = await getImportedV2SellAmountUseToken(token, amount);

            const hash = await writeContract({
                contractName: 'WrapSwaper2',
                functionName: 'sellToken',
                args: [amount, 
                    expectedReceive * BigInt(10000 - slippage) / 10000n, [token, WETH], 
                    useAccountStore().ethConnectAddress, 
                    Math.floor(Date.now() / 1000) + 300, 
                    sellsman, 
                    uniswapV2Router02]
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
        const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, wrappedUniswapV2ForTagAI], token)
        if (allowance < amount) {
            // 安全: 只授权所需金额，避免无限授权风险
            const approvalAmount = amount * 2n; // 授权2倍所需金额，减少频繁授权
            const hash = await writeContract({
                contractName: 'Token1',
                functionName: 'approve',
                args: [wrappedUniswapV2ForTagAI, approvalAmount],
                address: token
            })
            console.log('approve hash', hash)
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
        }
        const expectedReceive = await getSellAmountUseToken(token, amount);
        const hash = await writeContract({
            contractName: 'WrapSwaper',
            functionName: 'sellToken',
            args: [amount, 
                expectedReceive * BigInt(10000 - slippage) / 10000n, 
                [token, WETH], 
                useAccountStore().ethConnectAddress, 
                Math.floor(Date.now() / 1000) + 300, 
                sellsman, 
                IPShareContract3]
        })
        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash
    }else {
        const hash = await writeContract({
            contractName: 'Token1',
            functionName: 'sellToken',
            args: [amount, receiveEth, sellsman, slippage],
            address: token
        })
        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash
    }
}

export const claimReward = async (token: string, version: number, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    
    const hash = await writeContract({
        contractName: 'Pump' + version,
        functionName: 'userClaim',
        args: [token, orderId, amount, signature],
        value: (version === 1 || version === 2 || version === 3) ? '1000000000000000' : ClaimFee
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash
}

export const claimRewardV8 = async (
    token: string,
    orderId: BigInt,
    amount: BigInt,
    deadline: BigInt,
    signature: string,
    version = 8,
    socialPoolAddress?: string,
) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    const v = Number(version)
    let pool: string
    if (socialPoolAddress && isAddress(socialPoolAddress)) {
        pool = socialPoolAddress
    } else if (v === 10) {
        throw errCode.PARAMS_ERROR
    } else {
        const tokenAbi = v >= 9 ? 'Token9' : 'Token8';
        pool = await readContract(tokenAbi, 'nutboxSocialPool', [], token as `0x${string}`) as string
    }
    const hash = await writeContract({
        contractName: 'NutboxSocialCurationPool',
        functionName: 'claim',
        args: [orderId, amount, deadline, signature],
        address: pool as `0x${string}`,
        value: ClaimFee
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash
}

export const claimAIChannelReward = async (
    poolAddress: string,
    orderId: bigint,
    amount: bigint,
    deadline: bigint,
    signature: `0x${string}`,
) => {
    if (!isAddress(poolAddress)) throw errCode.PARAMS_ERROR;
    const hash = await writeContract({
        contractName: 'AIChannelPool',
        functionName: 'claim',
        args: [orderId, amount, deadline, signature],
        address: poolAddress as `0x${string}`,
        value: ClaimFee,
    });
    if (!hash) throw errCode.TRANSACTION_INVALID;
    return hash;
}

// 领取预测奖励，使用 OracleDistributorV2 合约
// V1 领取通道已作废，投票奖励统一从 V2 合约领取（V2/V3 市场奖励池注资在 OracleDistributorV2）
export const claimPredictReward = async (token: string, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    // 使用 Pump4 的 ABI（userClaim 函数签名相同），指定 OracleDistributorV2 地址
    const hash = await writeContract({
        contractName: 'Pump4',
        functionName: 'userClaim',
        args: [token, orderId, amount, signature],
        address: OracleDistributorV2 as `0x${string}`,
        value: ClaimFee
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash
}

export const transferToken = async (token: string, to: string, amount: bigint, isMax: boolean) => {
    if (isMax) {
        amount = await getTokenBalance(token as `0x${string}`);
    }
    
    const hash = await writeContract({
        contractName: 'Token1',
        functionName: 'transfer',
        args: [to, amount],
        address: token as `0x${string}`
    })
    return hash;
}

export const calculateInitEth = async (amount: bigint) => {
    const { contractName } = getCreatePumpDeployment()
    return await readContract(contractName, 'getBuyPriceAfterFee', [0n, amount]) as bigint
}

export const getUserTokenInfo = async (token: string, ethAddr: string) => {
    let calls = [
        {
            target: token,
            call: [
                'balanceOf(address)(uint256)',
                ethAddr
            ],
            returns: [
                ['balance']
            ]
        },
        {
            call: [
              'getEthBalance(address)(uint256)', 
              ethAddr
            ],
            returns: [['ethBalance', (val: any) => val / 10 ** 18]]
          }
    ]
    const res = await aggregateWithRpcFallback(calls);
    return res.results.transformed;
}

function checkDistributionEnd(config: any) {
    let lastTime = 0;
    config.forEach((v: any) => {
        if (v.end >= lastTime) lastTime = v.end;
    })
    return Date.now() / 1000 > lastTime;
}

/** PCS V4 poolId（bytes32）来自后端 pair 字段，v7/v8/v9/v10/v11 上架代币定价共用 */
const buildPairMap = (items: Array<{ token?: string; pair?: string | null | undefined; version?: number | null | undefined; dexVersion?: number | null | undefined }>) => {
    const pairMap: Record<string, string> = {};
    for (const item of items) {
        if (!item.token || !item.pair) continue;
        const v = item.version ?? 2;
        // Pump 创建的 V7/V8/V9/V11 代币，或导入代币 dexVersion=4
        if (isPcsV4Version(v) || (v === 10 && item.dexVersion === 4)) {
            pairMap[item.token] = item.pair;
            pairMap[item.token.toLowerCase()] = item.pair;
        }
    }
    return pairMap;
}

/** GeckoTerminal token 接口缓存，避免频繁请求触发 429 */
const GECKO_TOKEN_CACHE_TTL_MS = 10 * 60 * 1000
const GECKO_RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000

type GeckoTokenCacheEntry = {
    attributes: Record<string, any> | null
    fetchedAt: number
}

const geckoTokenCache = new Map<string, GeckoTokenCacheEntry>()
const geckoTokenInflight = new Map<string, Promise<GeckoTokenCacheEntry | null>>()
let geckoRateLimitedUntil = 0

const getGeckoNetwork = () => useChainStore().activeChainId === 56 ? 'bsc'
    : useChainStore().activeChainId === 4663 ? 'robinhood' : null

const fetchGeckoTokenAttributes = async (token: string): Promise<Record<string, any> | null> => {
    const network = getGeckoNetwork()
    if (!network) return null
    const tokenLower = token.toLowerCase()
    const key = `${network}:${tokenLower}`
    const now = Date.now()
    const cached = geckoTokenCache.get(key)

    if (cached && now - cached.fetchedAt < GECKO_TOKEN_CACHE_TTL_MS) {
        return cached.attributes
    }
    if (now < geckoRateLimitedUntil && cached) {
        return cached.attributes
    }

    const pending = geckoTokenInflight.get(key)
    if (pending) {
        const entry = await pending
        return entry?.attributes ?? cached?.attributes ?? null
    }

    const task = (async (): Promise<GeckoTokenCacheEntry | null> => {
        try {
            if (Date.now() < geckoRateLimitedUntil) {
                return cached ?? null
            }
            const resp = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenLower}`)
            if (resp.status === 429) {
                geckoRateLimitedUntil = Date.now() + GECKO_RATE_LIMIT_BACKOFF_MS
                console.warn('GeckoTerminal rate limited, using cached token data')
                return cached ?? null
            }
            if (!resp.ok) return cached ?? null
            const json = await resp.json()
            const entry: GeckoTokenCacheEntry = {
                attributes: json?.data?.attributes ?? null,
                fetchedAt: Date.now(),
            }
            geckoTokenCache.set(key, entry)
            return entry
        } catch (e) {
            console.warn('GeckoTerminal token fetch failed', key, e)
            return cached ?? null
        } finally {
            geckoTokenInflight.delete(key)
        }
    })()

    geckoTokenInflight.set(key, task)
    const entry = await task
    return entry?.attributes ?? cached?.attributes ?? null
}

type ImportedTokenMetadata = {
    logo?: string
    priceUsd?: number
    fdvUsd?: number
}

/**
 * Imported communities do not always carry community.logo in curation/feed
 * responses. Resolve their public metadata in one GeckoTerminal batch request
 * and seed the existing token cache so opening a sheet does not request it
 * again.
 */
const fetchImportedTokenMetadataMap = async (
    items: Array<{ token?: string; isImport?: boolean | number }>
): Promise<Record<string, ImportedTokenMetadata>> => {
    const network = getGeckoNetwork()
    if (!network) return {}
    const tokens = _.union(items.filter(item => item.isImport && item.token).map(item => item.token!.toLowerCase()))
    if (!tokens.length) return {}

    const result: Record<string, ImportedTokenMetadata> = {}
    const missing: string[] = []
    const now = Date.now()
    for (const token of tokens) {
        const cached = geckoTokenCache.get(`${network}:${token}`)
        if (cached && now - cached.fetchedAt < GECKO_TOKEN_CACHE_TTL_MS && cached.attributes) {
            const attrs = cached.attributes
            result[token] = {
                logo: attrs.image_url || undefined,
                priceUsd: Number(attrs.price_usd) || undefined,
                fdvUsd: Number(attrs.fdv_usd) || undefined,
            }
        } else {
            missing.push(token)
        }
    }

    // Honor the shared GeckoTerminal backoff while still returning fresh cache
    // entries collected above. Without this guard, each feed page retries the
    // batch endpoint immediately after a 429 response.
    if (Date.now() < geckoRateLimitedUntil) return result

    for (let offset = 0; offset < missing.length; offset += 30) {
        const chunk = missing.slice(offset, offset + 30)
        try {
            const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${chunk.join(',')}`)
            if (response.status === 429) {
                geckoRateLimitedUntil = Date.now() + GECKO_RATE_LIMIT_BACKOFF_MS
                break
            }
            if (!response.ok) continue
            const json = await response.json()
            for (const row of json?.data ?? []) {
                const token = String(row?.id ?? '').replace(/^.+_/, '').toLowerCase()
                const attrs = row?.attributes ?? null
                if (!token || !attrs) continue
                geckoTokenCache.set(`${network}:${token}`, { attributes: attrs, fetchedAt: Date.now() })
                result[token] = {
                    logo: attrs.image_url || undefined,
                    priceUsd: Number(attrs.price_usd) || undefined,
                    fdvUsd: Number(attrs.fdv_usd) || undefined,
                }
            }
        } catch (error) {
            console.warn('GeckoTerminal imported-token metadata fetch failed', error)
        }
    }
    return result
}

const applyImportedTokenMetadata = (
    item: { token?: string; isImport?: boolean | number; logo?: string; price?: number; marketCap?: number },
    metadataMap: Record<string, ImportedTokenMetadata>,
    nativeUsdPrice: number,
    onchainPriceSucceeded: boolean,
) => {
    if (!item.isImport || !item.token) return
    const metadata = metadataMap[item.token.toLowerCase()]
    if (!metadata) return
    if (!item.logo && metadata.logo) item.logo = metadata.logo
    const validNativeUsdPrice = isValidNativeUsdPrice(nativeUsdPrice)
    // When the selected on-chain pool cannot be normalized, Gecko is the
    // fallback even if the API item still carries an older, wrongly-scaled
    // value. If Gecko is unavailable, leave that API value untouched.
    if (!onchainPriceSucceeded && validNativeUsdPrice && metadata.priceUsd) {
        item.price = metadata.priceUsd / nativeUsdPrice
    }
    if (!onchainPriceSucceeded && validNativeUsdPrice && metadata.fdvUsd) {
        item.marketCap = metadata.fdvUsd / nativeUsdPrice
    }
}

/** GeckoTerminal 聚合 FDV（USD） */
const getThirdPartyFdvUsd = async (token: string): Promise<number | undefined> => {
    const attrs = await fetchGeckoTokenAttributes(token)
    if (!attrs) return undefined
    const fdv = parseFloat(attrs.fdv_usd ?? '0')
    return fdv > 0 ? fdv : undefined
}

/** 批量拉取第三方市值（BNB 计价，供 marketCap * ethPrice 展示） */
const fetchThirdPartyMarketCapMap = async (items: Array<{ token?: string; tick?: string }>) => {
    const tokens = _.union(items.filter(i => usesThirdPartyMarketCap(i.tick) && i.token).map(i => i.token!))
    if (tokens.length === 0) return {} as Record<string, number>

    const stateStore = useStateStore()
    if (!isValidNativeUsdPrice(stateStore.ethPrice)) {
        const price: any = await getEthPrice()
        const parsed = parseFloat(price)
        stateStore.ethPrice = isValidNativeUsdPrice(parsed) ? parsed : 0
    }
    if (!isValidNativeUsdPrice(stateStore.ethPrice)) return {}

    const entries = await Promise.all(tokens.map(async (token) => {
        const fdv = await getThirdPartyFdvUsd(token)
        if (fdv === undefined) return null
        return [token, fdv / stateStore.ethPrice] as const
    }))
    return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, number]>)
}

/** 用第三方 FDV 覆盖展示用 marketCap / price，不影响链上交易逻辑 */
const applyThirdPartyMarketCap = (
    item: { token?: string; tick?: string; marketCap?: number; price?: number; totalSupply?: number },
    map: Record<string, number>
) => {
    if (!usesThirdPartyMarketCap(item.tick) || !item.token) return
    const mc = map[item.token]
    if (mc === undefined) return
    item.marketCap = mc
    const supply = item.totalSupply && item.totalSupply > 0 ? item.totalSupply : TotalSupply
    item.price = mc / supply
}

export const getTokenInfo = async (communities: Community[]) => {
    if (communities.length === 0) return communities;
    // 只处理当前产品链上的社区，避免 BSC 地址打到 RH RPC
    const { filterByActiveChain } = await import('@/utils/chainFilter')
    communities = filterByActiveChain(communities)
    if (communities.length === 0) return communities;
    // marketCap 在这里以原生币计价；详情页展示 USD 时会乘该价格。
    // 不能只在第三方市值币种时加载，否则普通币首次打开详情会显示 $0.00。
    const stateStore = useStateStore()
    if (!isValidNativeUsdPrice(stateStore.ethPrice)) {
        const price: any = await getEthPrice()
        const parsed = parseFloat(price)
        stateStore.ethPrice = isValidNativeUsdPrice(parsed) ? parsed : 0
    }
    let tokens = communities.filter(com => !com.isImport).map(com => com.token)
    let versions: Record<string, number> = {}
    for (let com of communities) {
        versions[com.token!] = com.version ?? 2;
    }
    const pairMap = buildPairMap(communities)
    const socialPoolMap: Record<string, string> = {}
    for (const com of communities) {
        if (com.version === 10 && com.token && com.socialPoolAddress) {
            socialPoolMap[com.token] = com.socialPoolAddress
        }
    }
    // 链上补价 / 导入币 / 第三方市值并行，缩短墙钟时间
    const [thirdPartyMarketCapMap, importedMetadataMap, result, importResult] = await Promise.all([
        fetchThirdPartyMarketCapMap(communities),
        fetchImportedTokenMetadataMap(communities),
        getTokenOnchainInfo(tokens, versions, pairMap, socialPoolMap),
        getImportTokenOnchainInfo(communities.filter(com => com.isImport), pairMap),
    ])

    for (let community of communities) {
        // 导入币后端已确认上架，不依赖链上询价成功与否
        if (community.isImport) {
            community.listed = true
        }
        const tokenInfo = result[community.token]
        const importInfo = community.isImport && community.token
            ? importResult[community.token.toLowerCase()]
            : undefined
        if (tokenInfo) {
            community.listed = tokenInfo.listed;
            community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
            community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
            community.price = tokenInfo.price;
            community.marketCap = ((community.price ?? 0) * TotalSupply);
            if (!isPcsV4Version(community.version ?? 2)) {
                community.pair = tokenInfo.pair;
            }
            community.totalSupply = TotalSupply;
        } else if (community.isImport) {
            community.bondingCurveSupply = 0;
            community.totalClaimedSocialRewards = 0;
            if (importInfo) {
                community.price = importInfo.price;
                community.marketCap = (community.price ?? 0) * importInfo.totalSupply;
                community.totalSupply = importInfo.totalSupply;
            }
        }
        applyImportedTokenMetadata(community, importedMetadataMap, stateStore.ethPrice, Boolean(importInfo))
        applyThirdPartyMarketCap(community, thirdPartyMarketCapMap)
        // const distribution = JSON.parse(community.distribution);
        // community.distributionEnded = (community.listedDayNumber ?? 0) + 100 < getDayNumber();
        // community.distributionEnded = checkDistributionEnd(distribution);
    }

    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    if (tweets.length === 0) return tweets;
    try {
        const { filterByActiveChain } = await import('@/utils/chainFilter')
        tweets = filterByActiveChain(tweets)
        if (tweets.length === 0) return tweets;
        let tokens = tweets.filter(t => !t.isImport).map(t => t.token ?? '')
        let versions: Record<string, number> = {}
        for (let tweet of tweets) {
            versions[tweet.token!] = tweet.version ?? 2;
        }
        const pairMap = buildPairMap(tweets)
        const socialPoolMap: Record<string, string> = {}
        for (const tweet of tweets) {
            const pool = (tweet as { socialPoolAddress?: string }).socialPoolAddress
            if (tweet.token && tweet.version === 10 && pool) {
                socialPoolMap[tweet.token] = pool
            }
        }
        const stateStore = useStateStore()
        // 链上补价 / 导入币 / 第三方市值 / ETH 价并行
        const [thirdPartyMarketCapMap, importedMetadataMap, result, importResult] = await Promise.all([
            fetchThirdPartyMarketCapMap(tweets),
            fetchImportedTokenMetadataMap(tweets),
            getTokenOnchainInfo(tokens, versions, pairMap, socialPoolMap),
            getImportTokenOnchainInfo(tweets.filter(t => t.isImport), pairMap),
            !isValidNativeUsdPrice(stateStore.ethPrice)
                ? getEthPrice().then((price: any) => {
                    const parsed = parseFloat(price)
                    stateStore.ethPrice = isValidNativeUsdPrice(parsed) ? parsed : 0
                })
                : Promise.resolve(),
        ])
        
        for( let tweet of tweets) {
            if (!tweet.token) continue
            const tokenInfo = result[tweet.token]
            const importInfo = tweet.isImport ? importResult[tweet.token.toLowerCase()] : undefined
            if (tweet.isImport) {
                tweet.listed = true;
                tweet.bondingCurveSupply = 0;
                tweet.totalClaimedSocialRewards = 0;
                if (importInfo) {
                    tweet.price = importInfo.price;
                    tweet.marketCap = importInfo.price * importInfo.totalSupply;
                    tweet.totalSupply = importInfo.totalSupply;
                }
            }else {
                tweet.listed = tokenInfo.listed;
                tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
                tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
                tweet.price = tokenInfo.byUSD ? tokenInfo.price / stateStore.ethPrice : tokenInfo.price;
                tweet.marketCap = ((tweet.price ?? 0) * TotalSupply);
                if (!isPcsV4Version(tweet.version ?? 2)) {
                    tweet.pair = tokenInfo.pair;
                }
            }
            applyImportedTokenMetadata(tweet, importedMetadataMap, stateStore.ethPrice, Boolean(importInfo))
            applyThirdPartyMarketCap(tweet, thirdPartyMarketCapMap)
        }
        return tweets;
    } catch (e) {
        console.log(321, e)
        return tweets;
    }
}

export const getTokenOnchainInfo = async (
    tokens: string[],
    versions: Record<string, number>,
    pairMap: Record<string, string> = {},
    socialPoolMap: Record<string, string> = {},
) => {
    if (tokens.length === 0) return []
    tokens = _.union(tokens)
    let calls: any[] = []
    const loadBaseInfosByFallback = async () => {
        const entries = await Promise.all(tokens.map(async token => {
            if (!isAddress(token)) return null;
            const version = versions[token] ?? 4;
            if (version === 10) {
                const pool = socialPoolMap[token]
                let totalClaimedSocialRewards = 0n
                if (pool && isAddress(pool)) {
                    try {
                        totalClaimedSocialRewards = BigInt(await readContract(
                            'NutboxSocialCurationPool', 'totalClaimed', [], pool as `0x${string}`
                        ) as bigint)
                    } catch { /* ignore */ }
                }
                return [token, {
                    bondingCurveSupply: 0n,
                    listed: true,
                    totalClaimedSocialRewards,
                    nutboxSocialPool: pool,
                }] as const;
            }
            const pumpAddress = getActivePumpAddress(version);
            if (!pumpAddress) return null;
            try {
                const loadTotalClaimed = async (): Promise<bigint> => {
                    if (usesNutboxSocialPool(version)) {
                        let socialPool: string | undefined
                        if (version === 10) {
                            socialPool = socialPoolMap[token]
                        } else {
                            const tokenAbi = version >= 9 && version !== 10 ? 'Token9' : 'Token8';
                            socialPool = await readContract(tokenAbi, 'nutboxSocialPool', [], token as `0x${string}`) as string
                        }
                        if (!socialPool || socialPool === zeroAddress || !isAddress(socialPool)) return 0n;
                        return readContract('NutboxSocialCurationPool', 'totalClaimed', [], socialPool as `0x${string}`) as Promise<bigint>;
                    }
                    if (hasPumpTotalClaimedSocialRewards(version)) {
                        return readContract('Pump7', 'totalClaimedSocialRewards', [token]) as Promise<bigint>;
                    }
                    // v1-v6 无 totalClaimedSocialRewards 接口
                    return 0n;
                };
                const [bondingCurveSupply, listed, totalClaimedSocialRewards, pair] = await Promise.all([
                    readContract('Token1', 'bondingCurveSupply', [], token),
                    readContract('Token1', 'listed', [], token),
                    loadTotalClaimed(),
                    version < 7
                        ? readContract('UniswapFactory', 'getPair', [token, useChainStore().deployment.wrappedNative])
                        : Promise.resolve(undefined)
                ]);
                return [token, {
                    bondingCurveSupply: BigInt(bondingCurveSupply as bigint),
                    listed,
                    totalClaimedSocialRewards: BigInt(totalClaimedSocialRewards as bigint),
                    pair
                }] as const;
            } catch (error) {
                console.warn('load token base info failed', token, version, error);
                return [token, {
                    bondingCurveSupply: 0n,
                    listed: false,
                    totalClaimedSocialRewards: 0n
                }] as const;
            }
        }));
        return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, any]>);
    }
    for (let token of tokens) {
        if (!isAddress(token)) continue;
        const version = versions[token] ?? 4;
        // v10 导入代币无 Pump / bonding curve 接口，单独在后面查矿池 totalClaimed
        if (version === 10) continue;
        const pumpAddress = getActivePumpAddress(version);
        if (!pumpAddress) continue;
        calls = calls.concat([
            {
                target: token,
                call: [
                    'bondingCurveSupply()(uint256)'
                ],
                returns: [
                    [token + '-bondingCurveSupply', (val: any) => BigInt(val)]
                ]
            },{
                target: token,
                call: [
                    'listed()(bool)'
                ],
                returns: [
                    [token + '-listed']
                ]
            },
            ...(usesNutboxSocialPool(version) && version !== 10
                ? [{
                    target: token,
                    call: [
                        'nutboxSocialPool()(address)'
                    ],
                    returns: [
                        [token + '-nutboxSocialPool', (val: any) => val as `0x${string}`]
                    ]
                }]
                : hasPumpTotalClaimedSocialRewards(version)
                ? [{
                    target: pumpAddress,
                    call: [
                        'totalClaimedSocialRewards(address)(uint256)',
                        token
                    ],
                    returns: [
                        [token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]
                    ]
                }]
                : [])
        ])
        // v7/v8 走 PCS V4，无 Uniswap V2 pair
        if (!isPcsV4Version(version)) {
            calls.push({
                target: useChainStore().deployment.dex.v2Factory,
                call: [
                    'getPair(address,address)(address)',
                    token,
                    useChainStore().deployment.wrappedNative
                ],
                returns: [
                    [token + '-pair']
                ]
            })
        }
    }
    let infos: any = {}
    try {
        const res = await aggregateWithRpcFallback(calls)
        infos = res.results.transformed
    } catch (error) {
        console.warn('getTokenOnchainInfo base multicall failed, fallback to single calls', error);
        infos = await loadBaseInfosByFallback();
    }
    let result: any = {}
    
    for (let [key, value] of Object.entries(infos)) {
        if (key.startsWith('0x') && typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[key] = value;
            continue;
        }
        const [token, type] = key.split('-')
        if (!result[token]) {
            result[token] = {}
        }
        result[token][type] = value;
    }

    // v1-v6 无 totalClaimedSocialRewards，默认 0
    for (const token of tokens) {
        if (!isAddress(token)) continue
        const info = result[token]
        if (!info) continue
        if (info.totalClaimedSocialRewards === undefined) {
            info.totalClaimedSocialRewards = 0n
        }
    }

    // Pump8：nutboxSocialPool 上 totalClaimed() 无参（首轮 multicall 只拿到了 pool 地址）
    const v8TotalClaimedCalls: any[] = []
    for (const token of tokens) {
        if (!isAddress(token)) continue
        if (!usesNutboxSocialPool(versions[token] ?? 4)) continue
        const info = result[token]
        if (!info) continue
        // fallback 已写入 totalClaimed，且不会带 nutboxSocialPool
        if (info.nutboxSocialPool === undefined && info.totalClaimedSocialRewards !== undefined) continue
        const version = versions[token] ?? 4
        const pool = (version === 10
            ? socialPoolMap[token]
            : info.nutboxSocialPool) as `0x${string}` | undefined
        if (!pool || pool === zeroAddress || !isAddress(pool)) {
            info.totalClaimedSocialRewards = 0n
            continue
        }
        v8TotalClaimedCalls.push({
            target: pool,
            call: ['totalClaimed()(uint256)'],
            returns: [[token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]]
        })
    }
    if (v8TotalClaimedCalls.length > 0) {
        try {
            const v8Res = await aggregateWithRpcFallback(v8TotalClaimedCalls)
            const transformed = v8Res.results.transformed as Record<string, bigint>
            for (const key of Object.keys(transformed)) {
                const suffix = '-totalClaimedSocialRewards'
                if (!key.endsWith(suffix)) continue
                const tok = key.slice(0, -suffix.length)
                if (result[tok]) result[tok].totalClaimedSocialRewards = transformed[key]
            }
        } catch (e) {
            console.error('getTokenOnchainInfo Pump8 totalClaimed multicall failed', e)
            for (const token of tokens) {
                if (!usesNutboxSocialPool(versions[token] ?? 4)) continue
                const info = result[token]
                const version = versions[token] ?? 4
                const pool = (version === 10
                    ? socialPoolMap[token]
                    : info?.nutboxSocialPool) as `0x${string}` | undefined
                if (!pool || pool === zeroAddress || !isAddress(pool)) {
                    if (info) info.totalClaimedSocialRewards = 0n
                    continue
                }
                try {
                    const v = await readContract(
                        'NutboxSocialCurationPool',
                        'totalClaimed',
                        [],
                        pool
                    )
                    if (!info) result[token] = { listed: version === 10, bondingCurveSupply: 0n }
                    result[token].totalClaimedSocialRewards = BigInt(v as bigint)
                } catch {
                    if (info) info.totalClaimedSocialRewards = 0n
                }
            }
        }
    }

    // v10 导入代币：仅有 socialPoolMap，无首轮 multicall 数据
    for (const token of tokens) {
        if (!isAddress(token) || (versions[token] ?? 4) !== 10) continue
        if (result[token]?.totalClaimedSocialRewards !== undefined) continue
        const pool = socialPoolMap[token]
        if (!pool || !isAddress(pool)) {
            result[token] = { listed: true, bondingCurveSupply: 0n, totalClaimedSocialRewards: 0n }
            continue
        }
        try {
            const v = await readContract('NutboxSocialCurationPool', 'totalClaimed', [], pool as `0x${string}`)
            result[token] = {
                listed: true,
                bondingCurveSupply: 0n,
                totalClaimedSocialRewards: BigInt(v as bigint),
                nutboxSocialPool: pool,
            }
        } catch {
            result[token] = { listed: true, bondingCurveSupply: 0n, totalClaimedSocialRewards: 0n }
        }
    }

    calls = []
    for (let p of Object.entries(result)) {
        const token = p[0]
        let info: any = p[1]
        const version = versions[token] ?? 4;
        const pumpAddress = getActivePumpAddress(version);
        if (!pumpAddress) continue;
        // v7/v8/v9/v11 上架后走 PCS V4 定价（pairMap），与 Uniswap V2 无关
        const isPcsV4Listed = isPcsV4Version(version) && info.listed;
        if (!info.listed) {
            calls.push({
                target: pumpAddress,
                call: [
                    'getPrice(uint256,uint256)(uint256)',
                    info.bondingCurveSupply.toString(),
                    '1000000000000000000'
                ],
                returns: [
                    [token + '-price', (val: any) => (val).toString() / 1e18]
                ]
            })
            continue;
        }
        if (isPcsV4Listed) {
            const poolId = resolveV4PoolId(pairMap[token]);
            const v4PoolManager = useChainStore().deployment.dex.v4PoolManager
            if (poolId && v4PoolManager) {
                // RH Uniswap V4：extsload；BSC PCS Infinity：getSlot0
                if (useChainStore().deployment.dex.kind === 'uniswap') {
                    calls.push(buildRhV4SqrtPriceMulticall(
                        v4PoolManager,
                        poolId,
                        token + '-sqrtPriceX96',
                    ))
                } else {
                    calls.push({
                        target: v4PoolManager,
                        call: [
                            'getSlot0(bytes32)(uint160,int24,uint24,uint24)',
                            poolId
                        ],
                        returns: [
                            [token + '-sqrtPriceX96', (val: any) => BigInt(val)],
                            [token + '-tick'],
                            [token + '-protocolFee'],
                            [token + '-lpFee']
                        ]
                    })
                }
            }
            continue;
        }
        if (!isPcsV4Listed) {
            calls.push({
                target: info.pair,
                call: [
                    'getReserves()(uint256, uint256)'
                ],
                returns: [
                    [token + '-1', (val: any) => (val).toString() / 1e18],
                    [token + '-2', (val: any) => (val).toString() / 1e18]
                ]
            })
            calls.push({
                target: info.pair,
                call: [
                    'token0()(address)',
                ],
                returns: [
                    [token + '-token0']
                ]
            })
            calls.push({
                target: info.pair,
                call: [
                    'token1()(address)',
                ],
                returns: [
                    [token + '-token1']
                ]
            })
        }
    }
    if (calls.length > 0) {
        let res: Record<string, any> = {}
        try {
            res = (await aggregateWithRpcFallback(calls)).results.transformed
        } catch (e) {
            // 单笔坏 call 会导致整批 empty response；降级逐 token，避免列表全军覆没
            console.warn('getTokenOnchainInfo price multicall failed, fallback per-token', e)
            for (const [token, info] of Object.entries(result) as Array<[string, any]>) {
                const version = versions[token] ?? 4
                try {
                    if (!info.listed) {
                        const pumpAddress = getActivePumpAddress(version)
                        if (!pumpAddress) continue
                        const price = await readContract(
                            ('Pump' + version) as any,
                            'getPrice',
                            [info.bondingCurveSupply, parseEther('1')],
                        ) as bigint
                        info.price = Number(price) / 1e18
                        continue
                    }
                    if (isPcsV4Version(version)) {
                        const poolId = resolveV4PoolId(pairMap[token])
                        if (!poolId) continue
                        info.price = useChainStore().deployment.dex.kind === 'uniswap'
                            ? await getRhV4SpotPrice(poolId)
                            : sqrtPriceX96ToBnbPerToken(
                                BigInt((await readContract('PCSCLPoolManager', 'getSlot0', [poolId]) as any)[0]),
                              )
                        continue
                    }
                    if (!info.pair) continue
                    const [reserves, token0] = await Promise.all([
                        readContract('UniswapV2Pair', 'getReserves', [], info.pair as `0x${string}`),
                        readContract('UniswapV2Pair', 'token0', [], info.pair as `0x${string}`),
                    ])
                    const r0 = Number((reserves as any)[0]) / 1e18
                    const r1 = Number((reserves as any)[1]) / 1e18
                    info.price = (token0 as string).toLowerCase() === token.toLowerCase() ? r1 / r0 : r0 / r1
                } catch (err) {
                    console.warn('getTokenOnchainInfo price fallback failed', token, err)
                }
            }
            return result
        }
        for (let [key, value] of Object.entries(result)) {
            const version = versions[key] ?? 4;
            const info: any = value;
            if (!info.listed) {
                result[key].price = res[key + '-price']
                continue;
            }
            if (isPcsV4Version(version)) {
                const rawSqrtPriceX96 = res[key + '-sqrtPriceX96'];
                if (rawSqrtPriceX96 === undefined) {
                    result[key].price = undefined;
                    continue;
                }
                const sqrtPriceX96 = BigInt(rawSqrtPriceX96);
                if (sqrtPriceX96 === 0n) {
                    result[key].price = undefined;
                    continue;
                }
                // currency0=原生币, currency1=Token → 取倒数得 原生币/Token
                result[key].price = sqrtPriceX96ToBnbPerToken(sqrtPriceX96);
                continue;
            }
            if (res[key + '-token0'] === key) {
                result[key].price = res[key + '-2'] / res[key + '-1']
            }else {
                result[key].price = res[key + '-1'] / res[key + '-2']
            }
        }
    }

    return result
}

/** 根据 dexVersion 获取导入代币价格 */
export const getImportTokenPrice = async (token: string, pair: string, dexVersion: number, pairMap: Record<string, string>, ethPrice: number): Promise<number | undefined> => {
    try {
        if (!isAddress(token)) return undefined
        const deployment = useChainStore().deployment
        const normalizedDexVersion = Number(dexVersion)
        const cachedTokenDecimals = getCachedCurrencyDecimals(deployment.chainId, token)

        if (normalizedDexVersion === 4) {
            const source = pairMap[token] || pairMap[token.toLowerCase()] || pair
            const pool = await resolveImportV4Pool(source)
            if (!pool || deployment.dex.v4PoolManager === zeroAddress) return undefined
            const quote = getPoolQuoteToken(token, pool.token0, pool.token1)
            if (!quote || !getQuoteKind(quote, deployment.wrappedNative, deployment.chainId)) return undefined

            const calls: any[] = deployment.dex.kind === 'uniswap'
                ? [buildRhV4SqrtPriceMulticall(deployment.dex.v4PoolManager, pool.poolId, 'import-price-sqrt')]
                : [{
                    target: deployment.dex.v4PoolManager,
                    call: ['getSlot0(bytes32)(uint160,int24,uint24,uint24)', pool.poolId],
                    returns: [['import-price-sqrt', (value: any) => BigInt(value)]],
                }]
            if (cachedTokenDecimals === undefined) {
                calls.push({
                    target: token,
                    call: ['decimals()(uint8)'],
                    returns: [['import-price-token-decimals']],
                })
            }
            const quoteDecimalsReads = appendMissingQuoteDecimalsCalls(
                calls,
                'import-price',
                cachedTokenDecimals === undefined ? new Set([token.toLowerCase()]) : new Set(),
                sameToken(quote, zeroAddress) ? [] : [quote],
            )
            const data = (await aggregateWithRpcFallback(calls)).results.transformed
            const tokenDecimals = cachedTokenDecimals
                ?? cacheCurrencyDecimals(deployment.chainId, token, data['import-price-token-decimals'])
            cacheQuoteDecimalsReads(quoteDecimalsReads, data)
            const quoteDecimals = sameToken(quote, zeroAddress)
                ? deployment.decimals
                : getCachedCurrencyDecimals(deployment.chainId, quote)
            if (tokenDecimals === undefined || quoteDecimals === undefined) return undefined
            return getQuoteAwareV3SpotPrice({
                sqrtPriceX96: BigInt(data['import-price-sqrt']),
                token,
                token0: pool.token0,
                token1: pool.token1,
                tokenDecimals,
                quoteDecimals,
                chainId: deployment.chainId,
                wrappedNative: deployment.wrappedNative,
                nativeUsdPrice: ethPrice,
            })
        }

        if ((normalizedDexVersion !== 2 && normalizedDexVersion !== 3) || !isAddress(pair)) return undefined
        const calls: any[] = normalizedDexVersion === 3
            ? [{
                target: pair,
                call: ['slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)'],
                returns: [['import-price-sqrt', (value: any) => BigInt(value)]],
            }]
            : [{
                target: pair,
                call: ['getReserves()(uint256,uint256)'],
                returns: [
                    ['import-price-r0', (value: any) => BigInt(value)],
                    ['import-price-r1', (value: any) => BigInt(value)],
                ],
            }]
        calls.push(
            {
                target: pair,
                call: ['token0()(address)'],
                returns: [['import-price-token0']],
            },
            {
                target: pair,
                call: ['token1()(address)'],
                returns: [['import-price-token1']],
            },
        )
        if (cachedTokenDecimals === undefined) {
            calls.push({
                target: token,
                call: ['decimals()(uint8)'],
                returns: [['import-price-token-decimals']],
            })
        }
        const quoteDecimalsReads = appendMissingQuoteDecimalsCalls(
            calls,
            'import-price',
            cachedTokenDecimals === undefined ? new Set([token.toLowerCase()]) : new Set(),
        )
        const data = (await aggregateWithRpcFallback(calls)).results.transformed
        const token0 = data['import-price-token0'] as string | undefined
        const token1 = data['import-price-token1'] as string | undefined
        const tokenDecimals = cachedTokenDecimals
            ?? cacheCurrencyDecimals(deployment.chainId, token, data['import-price-token-decimals'])
        cacheQuoteDecimalsReads(quoteDecimalsReads, data)
        if (!token0 || !token1 || tokenDecimals === undefined) return undefined
        const quote = getPoolQuoteToken(token, token0, token1)
        if (!quote || !getQuoteKind(quote, deployment.wrappedNative, deployment.chainId)) return undefined
        const quoteDecimals = sameToken(quote, zeroAddress)
            ? deployment.decimals
            : getCachedCurrencyDecimals(deployment.chainId, quote)
        if (quoteDecimals === undefined) return undefined

        if (normalizedDexVersion === 3) {
            return getQuoteAwareV3SpotPrice({
                sqrtPriceX96: BigInt(data['import-price-sqrt']),
                token,
                token0,
                token1,
                tokenDecimals,
                quoteDecimals,
                chainId: deployment.chainId,
                wrappedNative: deployment.wrappedNative,
                nativeUsdPrice: ethPrice,
            })
        }

        return getQuoteAwareV2SpotPrice({
            reserve0: BigInt(data['import-price-r0']),
            reserve1: BigInt(data['import-price-r1']),
            token,
            token0,
            token1,
            tokenDecimals,
            quoteDecimals,
            chainId: deployment.chainId,
            wrappedNative: deployment.wrappedNative,
            nativeUsdPrice: ethPrice,
        })
    } catch (e) {
        console.error('getImportTokenPrice failed', token, dexVersion, e)
        return undefined
    }
}

/**
 * 批量读导入币价格 + totalSupply。
 * 按 token 去重后一次 multicall，避免首页「29 条推文同一 token」串行打 RPC。
 */
export const getImportTokenOnchainInfo = async (
    communities: OnchainTokenInfo[],
    pairMap: Record<string, string> = {},
) => {
    if (communities.length === 0) return {} as Record<string, { price: number; totalSupply: number }>

    const stateStore = useStateStore()
    if (!isValidNativeUsdPrice(stateStore.ethPrice)) {
        const price: any = await getEthPrice()
        const parsed = parseFloat(price)
        stateStore.ethPrice = isValidNativeUsdPrice(parsed) ? parsed : 0
    }
    const ethPrice = stateStore.ethPrice

    // 同一 token 只保留一条（pair / dexVersion 取首个）
    type ImportMeta = { token: string; pair: string; dexVersion: number }
    const byToken = new Map<string, ImportMeta>()
    for (const c of communities) {
        if (!c.token || !isAddress(c.token) || !c.pair) continue
        const dexVersion = Number(c.dexVersion ?? 2)
        if (![2, 3, 4].includes(dexVersion)) continue
        if (dexVersion !== 4 && !isAddress(c.pair)) continue
        const key = c.token.toLowerCase()
        if (byToken.has(key)) continue
        byToken.set(key, {
            token: c.token,
            pair: c.pair,
            dexVersion,
        })
    }
    if (byToken.size === 0) return {}

    const metas = Array.from(byToken.values())
    const deployment = useChainStore().deployment
    const v4PoolManager = deployment.dex.v4PoolManager
    const v4Pools = new Map<string, ImportV4Pool>()
    await Promise.all(metas.filter(meta => meta.dexVersion === 4).map(async meta => {
        try {
            const pool = await resolveImportV4Pool(pairMap[meta.token] || pairMap[meta.token.toLowerCase()] || meta.pair)
            if (pool) v4Pools.set(meta.token.toLowerCase(), pool)
        } catch (error) {
            console.warn('[getImportTokenOnchainInfo] V4 PoolKey lookup failed', meta.token, error)
        }
    }))
    const calls: any[] = []
    const targetDecimalsReadTokens = new Set<string>()

    for (const m of metas) {
        const { token, pair, dexVersion } = m
        // ERC20：只要 totalSupply + decimals（symbol 展示不依赖这里）。
        // decimals immutable，热路径直接复用 module cache。
        calls.push({
            target: token,
            call: ['totalSupply()(uint256)'],
            returns: [[`${token}-totalSupply`]],
        })
        if (getCachedCurrencyDecimals(deployment.chainId, token) === undefined) {
            calls.push({
                target: token,
                call: ['decimals()(uint8)'],
                returns: [[`${token}-decimals`]],
            })
            targetDecimalsReadTokens.add(token.toLowerCase())
        }

        if (dexVersion === 4) {
            const pool = v4Pools.get(token.toLowerCase())
            if (pool && v4PoolManager !== zeroAddress) {
                if (deployment.dex.kind === 'uniswap') {
                    calls.push(buildRhV4SqrtPriceMulticall(
                        v4PoolManager,
                        pool.poolId,
                        `${token}-sqrtPriceX96`,
                    ))
                } else {
                    calls.push({
                        target: v4PoolManager,
                        call: ['getSlot0(bytes32)(uint160,int24,uint24,uint24)', pool.poolId],
                        returns: [
                            [`${token}-sqrtPriceX96`, (val: any) => BigInt(val)],
                            [`${token}-tick`],
                            [`${token}-protocolFee`],
                            [`${token}-lpFee`],
                        ],
                    })
                }
            }
        } else if (dexVersion === 3) {
            calls.push(
                {
                    target: pair,
                    call: ['slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)'],
                    returns: [
                        [`${token}-sqrtPriceX96`, (val: any) => BigInt(val)],
                        [`${token}-v3tick`],
                        [`${token}-oi`],
                        [`${token}-oc`],
                        [`${token}-ocn`],
                        [`${token}-fp`],
                        [`${token}-ul`],
                    ],
                },
                {
                    target: pair,
                    call: ['token0()(address)'],
                    returns: [[`${token}-token0`]],
                },
                {
                    target: pair,
                    call: ['token1()(address)'],
                    returns: [[`${token}-token1`]],
                },
            )
        } else if (dexVersion === 2) {
            // Uniswap V2 / Pancake V2
            calls.push(
                {
                    target: pair,
                    call: ['getReserves()(uint256,uint256)'],
                    returns: [
                        [`${token}-r0`, (val: any) => BigInt(val)],
                        [`${token}-r1`, (val: any) => BigInt(val)],
                    ],
                },
                {
                    target: pair,
                    call: ['token0()(address)'],
                    returns: [[`${token}-token0`]],
                },
                {
                    target: pair,
                    call: ['token1()(address)'],
                    returns: [[`${token}-token1`]],
                },
            )
        }
    }

    // Include missing immutable quote decimals in the same pool snapshot.
    const quoteDecimalsReads = appendMissingQuoteDecimalsCalls(
        calls,
        'import-batch',
        targetDecimalsReadTokens,
    )

    let data: Record<string, any> = {}
    try {
        const res = await aggregateWithRpcFallback(calls)
        data = res.results.transformed
    } catch (e) {
        // aggregateWithRpcFallback already tried each configured RPC. Avoid an
        // N-token request storm; callers retain their API/Gecko fallback data.
        console.warn('[getImportTokenOnchainInfo] multicall failed; chain quote unavailable', e)
        return {}
    }

    const getCurrenciesForMeta = (meta: ImportMeta): PoolCurrencies | undefined => {
        if (meta.dexVersion === 4) return v4Pools.get(meta.token.toLowerCase())
        const token0 = data[`${meta.token}-token0`] as string | undefined
        const token1 = data[`${meta.token}-token1`] as string | undefined
        return token0 && token1 ? { token0, token1 } : undefined
    }

    for (const meta of metas) {
        cacheCurrencyDecimals(deployment.chainId, meta.token, data[`${meta.token}-decimals`])
    }
    cacheQuoteDecimalsReads(quoteDecimalsReads, data)

    const result: Record<string, { price: number; totalSupply: number }> = {}
    for (const m of metas) {
        const { token, dexVersion } = m
        const decimals = normalizeTokenDecimals(data[`${token}-decimals`])
            ?? getCachedCurrencyDecimals(deployment.chainId, token)
        const supplyRaw = data[`${token}-totalSupply`]
        if (decimals === undefined || supplyRaw == null) continue
        const totalSupply = Number(supplyRaw.toString()) / 10 ** decimals

        let price: number | undefined
        try {
            const currencies = getCurrenciesForMeta(m)
            if (!currencies) continue
            const quote = getPoolQuoteToken(token, currencies.token0, currencies.token1)
            if (!quote || !getQuoteKind(quote, deployment.wrappedNative, deployment.chainId)) continue
            const quoteTokenDecimals = sameToken(quote, zeroAddress)
                ? deployment.decimals
                : getCachedCurrencyDecimals(deployment.chainId, quote)
            if (quoteTokenDecimals === undefined) continue

            if (dexVersion === 4 || dexVersion === 3) {
                const sqrt = data[`${token}-sqrtPriceX96`]
                if (sqrt !== undefined) {
                    price = getQuoteAwareV3SpotPrice({
                        sqrtPriceX96: BigInt(sqrt),
                        token,
                        token0: currencies.token0,
                        token1: currencies.token1,
                        tokenDecimals: decimals,
                        quoteDecimals: quoteTokenDecimals,
                        chainId: deployment.chainId,
                        wrappedNative: deployment.wrappedNative,
                        nativeUsdPrice: ethPrice,
                    })
                }
            } else if (dexVersion === 2) {
                const reserve0 = data[`${token}-r0`]
                const reserve1 = data[`${token}-r1`]
                if (reserve0 != null && reserve1 != null) {
                    price = getQuoteAwareV2SpotPrice({
                        reserve0: BigInt(reserve0),
                        reserve1: BigInt(reserve1),
                        token,
                        token0: currencies.token0,
                        token1: currencies.token1,
                        tokenDecimals: decimals,
                        quoteDecimals: quoteTokenDecimals,
                        chainId: deployment.chainId,
                        wrappedNative: deployment.wrappedNative,
                        nativeUsdPrice: ethPrice,
                    })
                }
            }
        } catch (e) {
            console.warn('[getImportTokenOnchainInfo] decode failed', token, e)
        }

        if (price !== undefined && Number.isFinite(price) && price > 0 && Number.isFinite(totalSupply) && totalSupply > 0) {
            result[token.toLowerCase()] = { price, totalSupply }
        }
    }

    return result
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token || !isAddress(token)) return {supply: 0n, receive: 0n}
    const supply: any = await  readContract('Token1', 'bondingCurveSupply', [], token)
    const receive: any = await readContract('Pump' + version, 'getBuyAmountByValue', [supply, amount * 9800n / 10000n])
    return {supply, receive}
}

/** 内盘曲线在当前 supply 处的边际 BNB/Token 价格（与询价同一时刻口径） */
export const getBondingCurveSpotPrice = async (version: number, supply: bigint): Promise<number> => {
    const price = await readContract('Pump' + version, 'getPrice', [supply, parseEther('1')]) as bigint
    return Number(price) / 1e18
}

/** 上市后 Uniswap V2 池现货价格（BNB/Token）；pair 须为 20 字节合约地址 */
export const getUniswapV2SpotPrice = async (token: string, pair: string): Promise<number> => {
    const trimmed = pair?.trim() ?? ''
    if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
        throw new Error('invalid Uniswap V2 pair address')
    }
    const reserves = await readContract('UniswapV2Pair', 'getReserves', [], pair as `0x${string}`) as [bigint, bigint, number]
    const token0 = await readContract('UniswapV2Pair', 'token0', [], pair as `0x${string}`) as string
    const r0 = Number(reserves[0]) / 1e18
    const r1 = Number(reserves[1]) / 1e18
    return token0.toLowerCase() === token.toLowerCase() ? r1 / r0 : r0 / r1
}

export const getBuyPriceAfterFee = async (supply: bigint, amount: bigint) => {
    return await readContract('Pump4', 'getBuyPriceAfterFee', [supply, amount]) as bigint
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token || !isAddress(token)) return 0n
    const supply: any = await readContract('Token1', 'bondingCurveSupply', [], token)
    const receive: any = await readContract('Pump' + version, 'getSellPriceAfterFee', [supply, amount])
    return receive
}

const getCreateTokenEventByHash = (tx: { logs: Log[] }, version: number) => {
    const logs = tx.logs;
  
    try {
      const events = parseEventLogs({
        abi: abis.Pump1,
        logs,
        // 如果你确定只关心某个合约地址：
        // strict: true,
        // args: [可选],
      });
  
      for (const event of events) {
        if ('eventName' in event && event.eventName === 'NewToken') {
            if ('args' in event) {
                return event.args; // Viem 会自动返回 args 为 typed object
            }
        }
      }
    } catch (err) {
      console.error('解析事件失败:', err);
    }
  
    return null;
  };

// const getCreateTokenEventByHash = (tx: any, version: number) => {
//     let contract = new ethers.Contract(pumpContract[version - 1], abis.Pump1)
//     let event;
//     tx.logs.forEach((log: any) => {
//         try {
//             const parsedLog = contract.interface.parseLog(log);
//             if (parsedLog && parsedLog.name === 'NewToken') {
//                 event = parsedLog.args
//             }
//         } catch (error) {
//             console.error(error)
//         }
//     });
//     return event
// }

export const getBuyAmountUseEth = async (token: string, ethAmount: BigInt) => {
    const amount: any = await readContract('UniswapRouter', 'getAmountsOut', [ethAmount, [WETH, token]])
    return amount[amount.length - 1];
}

export const getSellAmountUseToken = async (token: string, tokenAmount: BigInt) => {
    const amount: any = await readContract('UniswapRouter', 'getAmountsOut', [tokenAmount, [token, WETH]]);
    return amount[amount.length - 1] * 9800n / 10000n;
}

const V2_FACTORY_LOOKUP_ABI = [{
    type: 'function',
    name: 'getPair',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
}] as const

const v2NativePairCache = new Map<string, Promise<`0x${string}`>>()
const v2NativePairFailureUntil = new Map<string, number>()
const V2_NATIVE_PAIR_FAILURE_BACKOFF_MS = 5 * 60 * 1000

/** Resolve the actual TOKEN/wrapped-native V2 pair used by the one-hop trade path. */
export const resolveV2NativePair = async (token: string): Promise<`0x${string}`> => {
    if (!isAddress(token)) throw new Error('Valid token address is required')
    const deployment = useChainStore().deployment
    if (deployment.dex.v2Factory === zeroAddress) {
        throw new Error(`V2 factory is not configured on ${deployment.name}`)
    }
    const cacheKey = `${deployment.chainId}:${token.toLowerCase()}`
    if ((v2NativePairFailureUntil.get(cacheKey) ?? 0) > Date.now()) {
        throw new Error('No TOKEN/wrapped-native V2 pool is available')
    }
    const cached = v2NativePairCache.get(cacheKey)
    if (cached) return cached

    const loading = (async () => {
        const pair = await getReadOnlyClient().readContract({
            address: deployment.dex.v2Factory,
            abi: V2_FACTORY_LOOKUP_ABI,
            functionName: 'getPair',
            args: [token, deployment.wrappedNative],
        })
        if (pair === zeroAddress) throw new Error('No TOKEN/wrapped-native V2 pool is available')
        return pair
    })()
    v2NativePairCache.set(cacheKey, loading)
    try {
        const pair = await loading
        v2NativePairFailureUntil.delete(cacheKey)
        return pair
    } catch (error) {
        v2NativePairCache.delete(cacheKey)
        v2NativePairFailureUntil.set(cacheKey, Date.now() + V2_NATIVE_PAIR_FAILURE_BACKOFF_MS)
        throw error
    }
}

export const getImportedV2BuyAmountUseNative = async (token: string, nativeAmount: bigint) => {
    await resolveV2NativePair(token)
    const deployment = useChainStore().deployment
    const amounts = await readContract(
        'UniswapRouter',
        'getAmountsOut',
        [nativeAmount, [deployment.wrappedNative, token]],
    ) as bigint[]
    return amounts[amounts.length - 1]
}

export const getImportedV2SellAmountUseToken = async (token: string, tokenAmount: bigint) => {
    await resolveV2NativePair(token)
    const deployment = useChainStore().deployment
    const amounts = await readContract(
        'UniswapRouter',
        'getAmountsOut',
        [tokenAmount, [token, deployment.wrappedNative]],
    ) as bigint[]
    return amounts[amounts.length - 1] * 9800n / 10000n
}

const V3_POOL_LOOKUP_ABI = [
    { type: 'function', name: 'factory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'fee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
    { type: 'function', name: 'liquidity', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
] as const

const V3_FACTORY_LOOKUP_ABI = [{
    type: 'function', name: 'getPool', stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
    outputs: [{ type: 'address' }],
}] as const

const V3_QUOTER_V2_ABI = [{
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{
        name: 'params', type: 'tuple', components: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'fee', type: 'uint24' },
            { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
    }],
    outputs: [
        { name: 'amountOut', type: 'uint256' },
        { name: 'sqrtPriceX96After', type: 'uint160' },
        { name: 'initializedTicksCrossed', type: 'uint32' },
        { name: 'gasEstimate', type: 'uint256' },
    ],
}] as const

type V3NativePool = { pair: `0x${string}`; fee: number }
const v3NativePoolCache = new Map<string, Promise<V3NativePool>>()

/**
 * Imported communities store their most liquid display/chart pool. That pool can
 * be TOKEN/USDT, while the swap wrapper always trades TOKEN/wrapped-native.
 * Resolve the native pool explicitly instead of assuming `community.pair` is it.
 */
export const resolveV3NativePool = async (token: string, pair?: string): Promise<V3NativePool> => {
    if (!isAddress(token) || !pair || !isAddress(pair)) {
        throw new Error('Valid token and Uniswap V3 pool addresses are required')
    }
    const deployment = useChainStore().deployment
    const cacheKey = `${deployment.chainId}:${token.toLowerCase()}:${pair.toLowerCase()}`
    const cached = v3NativePoolCache.get(cacheKey)
    if (cached) return cached

    const resolving = (async () => {
        const client = getReadOnlyClient()
        const storedPair = pair as `0x${string}`
        const [factory, token0, token1, storedFee] = await Promise.all([
            client.readContract({ address: storedPair, abi: V3_POOL_LOOKUP_ABI, functionName: 'factory' }),
            client.readContract({ address: storedPair, abi: V3_POOL_LOOKUP_ABI, functionName: 'token0' }),
            client.readContract({ address: storedPair, abi: V3_POOL_LOOKUP_ABI, functionName: 'token1' }),
            client.readContract({ address: storedPair, abi: V3_POOL_LOOKUP_ABI, functionName: 'fee' }),
        ])
        const target = token.toLowerCase()
        const wrappedNative = deployment.wrappedNative.toLowerCase()
        const pairTokens = [token0.toLowerCase(), token1.toLowerCase()]
        if (!pairTokens.includes(target)) throw new Error('Stored V3 pool does not contain the imported token')
        if (pairTokens.includes(wrappedNative)) return { pair: storedPair, fee: Number(storedFee) }

        const standardFeeTiers = deployment.dex.kind === 'pancake'
            ? [100, 500, 2500, 10000]
            : [100, 500, 3000, 10000]
        const feeTiers = Array.from(new Set([Number(storedFee), ...standardFeeTiers]))
        const pools = await Promise.all(feeTiers.map(async fee => {
            const candidate = await client.readContract({
                address: factory,
                abi: V3_FACTORY_LOOKUP_ABI,
                functionName: 'getPool',
                args: [token as `0x${string}`, deployment.wrappedNative, fee],
            })
            if (candidate === zeroAddress) return null
            const liquidity = await client.readContract({
                address: candidate,
                abi: V3_POOL_LOOKUP_ABI,
                functionName: 'liquidity',
            })
            return liquidity > 0n ? { pair: candidate, fee, liquidity } : null
        }))
        const best = pools
            .filter((pool): pool is V3NativePool & { liquidity: bigint } => pool !== null)
            .sort((a, b) => a.liquidity === b.liquidity ? 0 : a.liquidity > b.liquidity ? -1 : 1)[0]
        if (!best) throw new Error('No liquid TOKEN/wrapped-native V3 pool found')
        return { pair: best.pair, fee: best.fee }
    })()
    v3NativePoolCache.set(cacheKey, resolving)
    try {
        return await resolving
    } catch (error) {
        v3NativePoolCache.delete(cacheKey)
        throw error
    }
}

const getUniswapV3AmountOut = async (
    token: string,
    pair: string,
    amountIn: bigint,
    inputIsToken: boolean
): Promise<bigint> => {
    const deployment = useChainStore().deployment
    const nativePool = await resolveV3NativePool(token, pair)
    if (deployment.dex.v3Quoter !== zeroAddress) {
        const { result } = await getReadOnlyClient().simulateContract({
            address: deployment.dex.v3Quoter,
            abi: V3_QUOTER_V2_ABI,
            functionName: 'quoteExactInputSingle',
            args: [{
                tokenIn: (inputIsToken ? token : deployment.wrappedNative) as `0x${string}`,
                tokenOut: (inputIsToken ? deployment.wrappedNative : token) as `0x${string}`,
                amountIn,
                fee: nativePool.fee,
                sqrtPriceLimitX96: 0n,
            }],
        })
        return result[0]
    }

    // Some product chains do not have QuoterV2 configured yet. Retain the old
    // spot-price fallback there, but always use the resolved native pool.
    const [slot0, token0, fee] = await Promise.all([
        readContract('UniswapV3Pool', 'slot0', [], nativePool.pair),
        readContract('UniswapV3Pool', 'token0', [], nativePool.pair),
        readContract('UniswapV3Pool', 'fee', [], nativePool.pair),
    ])
    const sqrtPriceX96 = BigInt((slot0 as any)[0])
    const sqrtPriceSquared = sqrtPriceX96 * sqrtPriceX96
    if (sqrtPriceSquared === 0n) return 0n

    const amountAfterPoolFee = amountIn * (1_000_000n - BigInt(fee as number)) / 1_000_000n
    const tokenIsToken0 = (token0 as string).toLowerCase() === token.toLowerCase()
    const inputIsToken0 = inputIsToken === tokenIsToken0
    return inputIsToken0
        ? amountAfterPoolFee * sqrtPriceSquared / Q192
        : amountAfterPoolFee * Q192 / sqrtPriceSquared
}

/** Uniswap V3 导入币报价；避免把 V3 池错误发送到 V2 Router.getAmountsOut。 */
export const getV3BuyAmountUseEth = async (token: string, pair: string, ethAmount: bigint) =>
    getUniswapV3AmountOut(token, pair, ethAmount, false)

export const getV3SellAmountUseToken = async (token: string, pair: string, tokenAmount: bigint) =>
    (await getUniswapV3AmountOut(token, pair, tokenAmount, true)) * 9800n / 10000n

export const getAIBalance = async (tokens: string[]) => {
    let calls: any[] = []
    for (let token of tokens) {
        calls.push({
            target: token,
            call: [
                'balanceOf(address)(uint256)',
                AIDeployer
            ],
            returns: [
                [token, (val: any) => val.toString() / 1e18]
            ]
        })
    }
    const res = await aggregateWithRpcFallback(calls)
    return res.results.transformed
}

export const getTokenPair = async (token: string) => {
    const pair: any = await readContract('UniswapFactory', 'getPair', [token, WETH])
    return pair
}

export type DexPoolInfo = {
    pairAddress: string
    baseToken: string
    quoteToken: string
    baseTokenSymbol: string
    quoteTokenSymbol: string
    pairedToken: string
    pairedTokenSymbol: string
    dexVersion: number
    dexLabel: string
    bnbReserves: number
    tokenReserves: number
    priceNative: string
    priceUsd: string
    liquidityUsd: number
    logoUrl: string
    volume24h: number
    txCount24h: number
    createdAt: string
    feeTier: string
}

export type TokenDexResult = {
    tokenName: string
    tokenSymbol: string
    tokenLogo: string
    tokenPrice: string
    fdv: number
    pools: DexPoolInfo[]
}

function parseDexVersion(dexId: string): { dexVersion: number, dexLabel: string } {
    const dex = useChainStore().deployment.dex.kind === 'pancake' ? 'PancakeSwap' : 'Uniswap'
    if (dexId.includes('infinity') || dexId.includes('clmm') || dexId.includes('v4')) return { dexVersion: 4, dexLabel: `${dex} v4` }
    if (dexId.includes('v3')) return { dexVersion: 3, dexLabel: `${dex} v3` }
    return { dexVersion: 2, dexLabel: `${dex} v2` }
}

function parsePoolAttrs(
    p: any,
    bnbPrice: number,
    importedToken: string,
    includedTokens: Map<string, Record<string, any>>,
): DexPoolInfo {
    const attrs = p.attributes ?? {}
    const dexId: string = p.relationships?.dex?.data?.id ?? ''
    const { dexVersion, dexLabel } = parseDexVersion(dexId)
    const reserveUsd = parseFloat(attrs.reserve_in_usd ?? '0')
    const name: string = attrs.name ?? ''
    const feeMatch = name.match(/([\d.]+)%/)
    const baseId = p.relationships?.base_token?.data?.id ?? ''
    const quoteId = p.relationships?.quote_token?.data?.id ?? ''
    const baseToken = String(baseId).replace(/^.+_/, '')
    const quoteToken = String(quoteId).replace(/^.+_/, '')
    const baseAttrs = includedTokens.get(baseId) ?? includedTokens.get(baseToken.toLowerCase()) ?? {}
    const quoteAttrs = includedTokens.get(quoteId) ?? includedTokens.get(quoteToken.toLowerCase()) ?? {}
    const importedIsBase = baseToken.toLowerCase() === importedToken.toLowerCase()
    const pairedToken = importedIsBase ? quoteToken : baseToken
    const pairedAttrs = importedIsBase ? quoteAttrs : baseAttrs
    return {
        pairAddress: attrs.address ?? '',
        baseToken,
        quoteToken,
        baseTokenSymbol: baseAttrs.symbol ?? '',
        quoteTokenSymbol: quoteAttrs.symbol ?? '',
        pairedToken,
        pairedTokenSymbol: pairedAttrs.symbol ?? '',
        dexVersion,
        dexLabel,
        bnbReserves: reserveUsd / bnbPrice,
        tokenReserves: 0,
        priceNative: attrs.base_token_price_native_currency ?? '0',
        priceUsd: attrs.base_token_price_usd ?? attrs.token_price_usd ?? '0',
        liquidityUsd: reserveUsd,
        logoUrl: '',
        volume24h: parseFloat(attrs.volume_usd?.h24 ?? '0'),
        txCount24h: (attrs.transactions?.h24?.buys ?? 0) + (attrs.transactions?.h24?.sells ?? 0),
        createdAt: attrs.pool_created_at ?? '',
        feeTier: feeMatch ? feeMatch[1] + '%' : ''
    }
}

export const getTokenDexPools = async (token: string): Promise<TokenDexResult | null> => {
    const network = getGeckoNetwork()
    if (!network) return null
    const dexKind = useChainStore().deployment.dex.kind
    const tokenLower = token.toLowerCase()
    let poolsJson: any
    let tokenJson: { data: { attributes: Record<string, any> } } | null = null
    try {
        const [tokenAttrs, poolsResp] = await Promise.all([
            fetchGeckoTokenAttributes(tokenLower),
            fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenLower}/pools?include=base_token%2Cquote_token&page=1`)
        ])
        if (!poolsResp.ok) return null
        poolsJson = await poolsResp.json()
        if (tokenAttrs) tokenJson = { data: { attributes: tokenAttrs } }
    } catch (e) {
        console.error('GeckoTerminal fetch error:', e)
        return null
    }

    // Parse token info
    let tokenName = '', tokenSymbol = '', tokenLogo = '', tokenPrice = '0', fdv = 0
    if (tokenJson) {
        const tAttrs = tokenJson?.data?.attributes ?? {}
        tokenName = tAttrs.name ?? ''
        tokenSymbol = tAttrs.symbol ?? ''
        tokenLogo = tAttrs.image_url ?? ''
        tokenPrice = tAttrs.price_usd ?? '0'
        fdv = parseFloat(tAttrs.fdv_usd ?? '0')
    }

    // Parse pools
    const allPools: any[] = poolsJson?.data ?? []
    const filtered = allPools.filter((p: any) => {
        const dexId: string = p.relationships?.dex?.data?.id ?? ''
        return dexKind === 'pancake' ? dexId.includes('pancakeswap') : dexId.includes('uniswap')
    })
    if (filtered.length === 0) return null

    // Get BNB price
    const stateStore = useStateStore()
    if (stateStore.ethPrice === 0) {
        const price: any = await getEthPrice()
        stateStore.ethPrice = parseFloat(price)
    }
    const bnbPrice = stateStore.ethPrice

    // Sort by liquidity descending and map
    filtered.sort((a: any, b: any) =>
        parseFloat(b.attributes?.reserve_in_usd ?? '0') - parseFloat(a.attributes?.reserve_in_usd ?? '0')
    )
    const includedTokens = new Map<string, Record<string, any>>()
    for (const item of poolsJson?.included ?? []) {
        if (item?.type !== 'token' || !item?.id) continue
        includedTokens.set(item.id, item.attributes ?? {})
        includedTokens.set(String(item.id).replace(/^.+_/, '').toLowerCase(), item.attributes ?? {})
    }
    const pools = filtered.map((p: any) => parsePoolAttrs(p, bnbPrice, tokenLower, includedTokens))

    return { tokenName, tokenSymbol, tokenLogo, tokenPrice, fdv, pools }
}

export type ExternalTokenCandle = {
    timestamp: number
    close: number
}

/** Load USD OHLCV for an imported token from its deepest supported DEX pool. */
export const getExternalTokenChartData = async (
    token: string,
    rangeSeconds: number,
): Promise<ExternalTokenCandle[]> => {
    const network = getGeckoNetwork()
    if (!network || !token) return []
    const tokenLower = token.toLowerCase()
    const dex = await getTokenDexPools(tokenLower)
    const pool = dex?.pools[0]
    if (!pool?.pairAddress) return []

    let timeframe = 'hour'
    let aggregate = 1
    let limit = Math.min(1000, Math.max(24, Math.ceil((rangeSeconds || 30 * 86400) / 3600) + 1))
    if (rangeSeconds > 0 && rangeSeconds <= 4 * 3600) {
        timeframe = 'minute'
        aggregate = 5
        limit = Math.max(24, Math.ceil(rangeSeconds / 300) + 1)
    } else if (rangeSeconds > 7 * 86400 && rangeSeconds <= 30 * 86400) {
        aggregate = 4
        limit = Math.ceil(rangeSeconds / (aggregate * 3600)) + 1
    } else if (!rangeSeconds) {
        timeframe = 'day'
        aggregate = 1
        limit = 1000
    }

    const tokenSide = pool.quoteToken?.toLowerCase() === tokenLower ? 'quote' : 'base'
    const params = new URLSearchParams({
        aggregate: String(aggregate),
        limit: String(Math.min(1000, limit)),
        currency: 'usd',
        token: tokenSide,
    })
    try {
        const response = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool.pairAddress}/ohlcv/${timeframe}?${params}`
        )
        if (!response.ok) return []
        const json = await response.json()
        return (json?.data?.attributes?.ohlcv_list ?? [])
            .map((row: unknown[]) => ({ timestamp: Number(row?.[0]), close: Number(row?.[4]) }))
            .filter((row: ExternalTokenCandle) => Number.isFinite(row.timestamp) && Number.isFinite(row.close) && row.close > 0)
            .sort((a: ExternalTokenCandle, b: ExternalTokenCandle) => a.timestamp - b.timestamp)
    } catch (error) {
        console.warn('GeckoTerminal OHLCV fetch failed', tokenLower, error)
        return []
    }
}

export const getTokenERC20Info = async (token: string): Promise<{ totalSupply: number, symbol: string, decimals: number }> => {
    const calls = [
        { target: token, call: ['totalSupply()(uint256)'], returns: [[token + '-totalSupply']] },
        { target: token, call: ['symbol()(string)'], returns: [[token + '-symbol']] },
        { target: token, call: ['decimals()(uint8)'], returns: [[token + '-decimals']] }
    ]
    const res = await aggregateWithRpcFallback(calls)
    const data = res.results.transformed
    const decimals = data[token + '-decimals']
    const totalSupply = Number(data[token + '-totalSupply'].toString()) / (10 ** decimals)
    return {
        totalSupply,
        symbol: data[token + '-symbol'],
        decimals
    }
}
