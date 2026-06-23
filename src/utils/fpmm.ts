import type { BattleData, Community, CreateCommunity, EventPredictData, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, Ether, USD_CONTRACTS,
    USD1, ConditionalTokens, Oracle, USDT, FPMMDeterministicFactory, PredictionMinFee, PredictionMaxFee,
    FPMMDeterministicFactoryEventV2,
    OracleDistributorV2,
    FPMMDeterministicFactoryEventV3} from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { abis } from './abis'
import { aggregateWithRpcFallback } from './multicall'
import _, { min } from 'lodash'
import { useStateStore } from "@/stores/common";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, checksumAddress, type Log, toBytes, parseUnits, encodeAbiParameters, parseAbiParameters, zeroHash } from "viem";
import { writeContract, readContract } from "./contract";

export async function approveToken(spender: `0x${string}`, tokenAddress: `0x${string}`, amount: bigint | BigInt) {
   console.log(35, spender, tokenAddress, amount)
    const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, spender], tokenAddress)
    console.log(36, allowance)
    if (amount > allowance) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [spender, maxUint256],
            address: tokenAddress
        })
    }
}

export async function createMarket(questionId: string, tokenAddress: `0x${string}`, feePath: string[], distributionHint: number, dayNumber: number, funding: bigint) {
    await approveToken(FPMMDeterministicFactory, tokenAddress, funding);

    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000;
    distributionHint = Math.ceil(distributionHint)
    // 生成lmsrMarketMaker
    const hash = await writeContract({
        contractName: 'FPMMDeterministicFactory',
        functionName: 'create2FixedProductMarketMakerWithCondition',
        args: [tokenAddress, questionId, [100 - distributionHint, distributionHint], feePath, [nonce, 2, PredictionMinFee, PredictionMaxFee, dayNumber, funding]]
    });

    // 预创建预测市场

    let tx = await getTransactionReceipt(hash as `0x${string}`)
    // event FixedProductMarketMakerCreation(
    //     address indexed creator,
    //     FixedProductMarketMaker fixedProductMarketMaker,
    //     ConditionalTokens conditionalTokens,
    //     IERC20 collateralToken,
    //     bytes32[] conditionIds,
    //     uint fee,
    //     uint maxFee,
    //     uint endTime
    // );
    const event: any = getCreateFPMMMarketMakerEventByHash(tx);
    if (event && event.creator === useAccountStore().ethConnectAddress) {
        // 读取链上的conditionid是否和事件中的一致
        const conditionId = await readContract('ConditionalTokens', 'getConditionId', [Oracle, questionId, 2])
        if (conditionId !== event.conditionIds[0]) {
            throw 'Invalid transaction'
        }
        // 创建成功，返回txhash，event.lmsrMarketMaker
        return {hash, fpmmMaker: event.fixedProductMarketMaker};
    }else {
        // 非法交易
        throw 'Invalid transaction'
    }
}

export type EventMarketDexConfig = {
    feeDexVersion: number
    feeQuoteTarget: `0x${string}`
    feePoolId: `0x${string}`
    feePath: `0x${string}`[]
}

/** factory_version >= 2 的多元 outcome 市场（含 V2/V3） */
export const isMultiOutcomeEventFactory = (factoryVersion?: number | null) =>
    Number(factoryVersion ?? 1) >= 2

type OutcomePositionSpec = { outcomeIndex: number; positionId: string; label?: string }

/** 多元市场：从 API outcomes 收集带 positionId 的槽位 */
export const resolveMultiOutcomePositions = (event: EventPredictData) => {
    const allOutcomes = getOutcomeList(event)
    const withPosition = allOutcomes
        .filter(o => o.positionId?.trim())
        .map(o => ({
            outcomeIndex: o.outcomeIndex,
            positionId: o.positionId!.trim(),
            label: o.label,
        }))
    const slotCount = event.outcomeCount ?? allOutcomes.length
    const isMulti = isMultiOutcomeEventFactory(event.factoryVersion) && slotCount > 2
    return { allOutcomes, withPosition, slotCount, isMulti }
}

/** multicall 结果 → 按 outcomeIndex 对齐的储备数组 */
export const buildOutcomeReservesFromInfos = (
    marketMaker: string,
    slotCount: number,
    infos: Record<string, number>,
): number[] =>
    Array.from({ length: slotCount }, (_, i) => infos[`${marketMaker}-reserve-${i}`] ?? 0)

/** dex v3/v4 池子走 DexFee；v2 池子走 WithCondition */
const usesDexFeeCreation = (feeDexVersion: number) => feeDexVersion >= 3

const verifyEventMarketCreation = async (
    tx: { logs: Log[] },
    questionId: string,
    outcomeSlotCount: number,
) => {
    const event: any = getCreateFPMMMarketMakerEventByHash(tx)
    const fpmmMaker = event?.fixedProductMarketMaker ?? event?.fixedProductMarketMaker2
    if (event && event.creator === useAccountStore().ethConnectAddress && fpmmMaker) {
        const onChainConditionId = await readContract('ConditionalTokens', 'getConditionId', [Oracle, questionId, outcomeSlotCount])
        if (onChainConditionId !== event.conditionIds[0]) {
            throw 'Invalid transaction'
        }
        return { hash: '', fpmmMaker }
    }
    throw 'Invalid transaction'
}

/** Event V3 factory + WithCondition（dex v2 代币） */
async function createEventMarketV3WithCondition(
    questionId: string,
    tokenAddress: `0x${string}`,
    distributionHint: number[],
    outcomeSlotCount: number,
    endTime: number,
    funding: bigint,
    feePath: `0x${string}`[],
) {
    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000
    const hint = distributionHint.map(h => Math.ceil(h))
    const hash = await writeContract({
        contractName: 'FPMMDeterministicEventFactoryV3',
        functionName: 'create2FixedProductMarketMakerWithCondition',
        args: [tokenAddress, questionId, hint, feePath, [nonce, outcomeSlotCount, PredictionMinFee, PredictionMaxFee, endTime, funding]],
    })

    const tx = await getTransactionReceipt(hash as `0x${string}`)
    const result = await verifyEventMarketCreation(tx, questionId, outcomeSlotCount)
    return { hash, fpmmMaker: result.fpmmMaker }
}

/** Event V3 factory + WithDexFee（dex v3/v4 代币） */
async function createEventMarketV3WithDexFee(
    questionId: string,
    tokenAddress: `0x${string}`,
    distributionHint: number[],
    outcomeSlotCount: number,
    endTime: number,
    funding: bigint,
    dexConfig: EventMarketDexConfig,
) {
    const conditionId = await readContract('ConditionalTokens', 'getConditionId', [Oracle, questionId, outcomeSlotCount]) as `0x${string}`
    const existingSlots: bigint = await readContract('ConditionalTokens', 'getOutcomeSlotCount', [conditionId]) as bigint
    if (existingSlots === 0n) {
        await writeContract({
            contractName: 'ConditionalTokens',
            functionName: 'prepareCondition',
            args: [Oracle, questionId, outcomeSlotCount, tokenAddress],
        })
    }

    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000
    const feePath = (dexConfig.feePath ?? []).map(a => a as `0x${string}`)
    const encodedParams = encodeAbiParameters(
        parseAbiParameters('uint256[6], address, address, bytes32, bytes32[], uint256[], address[]'),
        [
            [BigInt(nonce), PredictionMinFee, PredictionMaxFee, BigInt(endTime), funding, BigInt(dexConfig.feeDexVersion)],
            tokenAddress,
            dexConfig.feeQuoteTarget || zeroAddress,
            dexConfig.feePoolId || zeroHash,
            [conditionId],
            distributionHint.map(h => BigInt(Math.ceil(h))),
            feePath,
        ]
    )

    const hash = await writeContract({
        contractName: 'FPMMDeterministicEventFactoryV3',
        functionName: 'create2FixedProductMarketMakerWithDexFee',
        args: [encodedParams],
    })

    const tx = await getTransactionReceipt(hash as `0x${string}`)
    const result = await verifyEventMarketCreation(tx, questionId, outcomeSlotCount)
    return { hash, fpmmMaker: result.fpmmMaker }
}

export async function createEventMarket(
    questionId: string,
    tokenAddress: `0x${string}`,
    distributionHint: number | number[],
    outcomeSlotCount: number,
    endTime: number,
    funding: bigint,
    dexConfig: EventMarketDexConfig,
) {
    const hint = Array.isArray(distributionHint)
        ? distributionHint.map(h => Math.ceil(h))
        : [100 - Math.ceil(distributionHint), Math.ceil(distributionHint)]

    await approveToken(FPMMDeterministicFactoryEventV3, tokenAddress, funding)

    if (usesDexFeeCreation(dexConfig.feeDexVersion)) {
        return createEventMarketV3WithDexFee(
            questionId,
            tokenAddress,
            hint,
            outcomeSlotCount,
            endTime,
            funding,
            dexConfig,
        )
    }

    return createEventMarketV3WithCondition(
        questionId,
        tokenAddress,
        hint,
        outcomeSlotCount,
        endTime,
        funding,
        dexConfig.feePath ?? [],
    )
}

/** @deprecated 请使用 createEventMarket，内部已按 dex 版本自动分支 */
export async function createEventMarketV3(
    questionId: string,
    tokenAddress: `0x${string}`,
    distributionHint: number[],
    outcomeSlotCount: number,
    endTime: number,
    funding: bigint,
    dexConfig: EventMarketDexConfig,
) {
    return createEventMarket(
        questionId,
        tokenAddress,
        distributionHint,
        outcomeSlotCount,
        endTime,
        funding,
        dexConfig,
    )
}

/** @deprecated 仅兼容旧代码引用，请使用 createEventMarketV3 */
export async function createEventMarketV2(
    questionId: string,
    tokenAddress: `0x${string}`,
    feePath: string[],
    distributionHint: number[],
    outcomeSlotCount: number,
    endTime: number,
    funding: bigint
) {
    await approveToken(FPMMDeterministicFactoryEventV2, tokenAddress, funding);

    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000;
    const hint = distributionHint.map(h => Math.ceil(h));
    const hash = await writeContract({
        contractName: 'FPMMDeterministicFactoryEventV2',
        functionName: 'create2FixedProductMarketMakerWithCondition',
        args: [tokenAddress, questionId, hint, feePath, [nonce, outcomeSlotCount, PredictionMinFee, PredictionMaxFee, endTime, funding]]
    });

    const tx = await getTransactionReceipt(hash as `0x${string}`)
    const event: any = getCreateFPMMMarketMakerEventByHash(tx);
    if (event && event.creator === useAccountStore().ethConnectAddress) {
        const conditionId = await readContract('ConditionalTokens', 'getConditionId', [Oracle, questionId, outcomeSlotCount])
        if (conditionId !== event.conditionIds[0]) {
            throw 'Invalid transaction'
        }
        return { hash, fpmmMaker: event.fixedProductMarketMaker };
    }
    throw 'Invalid transaction'
}

import { calcSellReturnFromReserves, getOutcomeList, getOutcomeReserves } from '@/composables/useEventMarketOutcomes'

const resolveOutcomeIndex = (outcome: 'yes' | 'no' | 'red' | 'blue' | number) =>
    typeof outcome === 'number' ? outcome : ((outcome === 'red' || outcome === 'yes') ? 0 : 1)

export type EventMarketInfos = {
    reserves: number[]
    fee: number
    totalSupply: number
}

/** 读取 event 市场各 outcome 池子储备 + 费率 */
export const getEventMarketInfos = async (market: EventPredictData): Promise<EventMarketInfos> => {
    const { withPosition, slotCount, isMulti } = resolveMultiOutcomePositions(market)
    const useMulti = isMulti && withPosition.length > 0

    const calls: any[] = []
    if (useMulti) {
        for (const o of withPosition) {
            calls.push({
                target: ConditionalTokens,
                call: [
                    'balanceOf(address,uint256)(uint256)',
                    market.marketMaker,
                    o.positionId
                ],
                returns: [
                    [`${market.marketMaker}-reserve-${o.outcomeIndex}`, (val: any) => val / 1e18]
                ]
            })
        }
    } else if (!isMulti) {
        calls.push({
            target: ConditionalTokens,
            call: ['balanceOf(address,uint256)(uint256)', market.marketMaker, market.positionAID],
            returns: [[market.marketMaker + '-priceA', (val: any) => val / 1e18]]
        })
        calls.push({
            target: ConditionalTokens,
            call: ['balanceOf(address,uint256)(uint256)', market.marketMaker, market.positionBID],
            returns: [[market.marketMaker + '-priceB', (val: any) => val / 1e18]]
        })
    }
    calls.push({
        target: market.marketMaker,
        call: ['getFee()(uint256)'],
        returns: [[market.marketMaker + '-fee', (val: any) => val / 1e18]]
    })
    calls.push({
        target: market.marketMaker,
        call: ['totalSupply()(uint256)'],
        returns: [[market.marketMaker + '-totalSupply', (val: any) => val / 1e18]]
    })

    const res = await aggregateWithRpcFallback(calls)
    const transformed = res.results.transformed as Record<string, number>
    const reserves = useMulti
        ? buildOutcomeReservesFromInfos(market.marketMaker, slotCount, transformed)
        : [
            transformed[market.marketMaker + '-priceA'] ?? 0,
            transformed[market.marketMaker + '-priceB'] ?? 0,
        ]
    return {
        reserves,
        fee: transformed[market.marketMaker + '-fee'] ?? 0,
        totalSupply: transformed[market.marketMaker + '-totalSupply'] ?? 0,
    }
}

export const getMarketInfos = async (markets: BattleData[] | EventPredictData[]) => {
    if (markets.length === 0) {
        return {} as Record<string, number>
    }
    const calls: any[] = []
    for (const market of markets) {
        const eventMarket = market as EventPredictData
        const { withPosition, slotCount, isMulti } = resolveMultiOutcomePositions(eventMarket)

        if (isMulti && withPosition.length < slotCount) {
            warnIncompleteMultiOutcomePositions(market.marketMaker, withPosition.length, slotCount)
        }

        const useMulti = isMulti && withPosition.length > 0

        if (useMulti) {
            for (const o of withPosition) {
                calls.push({
                    target: ConditionalTokens,
                    call: [
                        'balanceOf(address,uint256)(uint256)',
                        market.marketMaker,
                        o.positionId,
                    ],
                    returns: [
                        [`${market.marketMaker}-reserve-${o.outcomeIndex}`, (val: any) => val / 1e18],
                    ],
                })
            }
        } else if (!isMulti) {
            calls.push({
                target: ConditionalTokens,
                call: [
                    'balanceOf(address,uint256)(uint256)',
                    market.marketMaker,
                    market.positionAID,
                ],
                returns: [
                    [market.marketMaker + '-priceA', (val: any) => val / 1e18],
                ],
            })
            calls.push({
                target: ConditionalTokens,
                call: [
                    'balanceOf(address,uint256)(uint256)',
                    market.marketMaker,
                    market.positionBID,
                ],
                returns: [
                    [market.marketMaker + '-priceB', (val: any) => val / 1e18],
                ],
            })
        }
        calls.push({
            target: market.marketMaker,
            call: ['getFee()(uint256)'],
            returns: [[market.marketMaker + '-fee', (val: any) => val / 1e18]],
        })
        calls.push({
            target: market.marketMaker,
            call: ['totalSupply()(uint256)'],
            returns: [[market.marketMaker + '-totalSupply', (val: any) => val / 1e18]],
        })
    }
    const res = await aggregateWithRpcFallback(calls)
    return res.results.transformed as Record<string, number>
}

/** 多元市场 positionId 未齐时打日志，避免静默走二元储备路径 */
const warnIncompleteMultiOutcomePositions = (
    marketMaker: string,
    withPositionCount: number,
    slotCount: number,
) => {
    if (withPositionCount === 0) {
        console.warn(
            `[fpmm] multi-outcome market ${marketMaker}: missing positionId on all ${slotCount} outcomes`,
        )
        return
    }
    if (withPositionCount < slotCount) {
        console.warn(
            `[fpmm] multi-outcome market ${marketMaker}: only ${withPositionCount}/${slotCount} outcomes have positionId`,
        )
    }
}

/** 将批量 multicall 结果写回 event 市场对象（含多元 outcomeReserves） */
export const applyMulticallInfosToEvent = (
    event: EventPredictData,
    infos: Record<string, number>,
) => {
    const mm = event.marketMaker
    const fee = infos[`${mm}-fee`] ?? 0
    const { withPosition, slotCount, isMulti } = resolveMultiOutcomePositions(event)

    if (isMulti && withPosition.length < slotCount) {
        warnIncompleteMultiOutcomePositions(mm, withPosition.length, slotCount)
    }

    const useMulti = isMulti && withPosition.length > 0

    if (useMulti) {
        const outcomeReserves = buildOutcomeReservesFromInfos(mm, slotCount, infos)
        return {
            outcomeReserves,
            reserveA: outcomeReserves[0] ?? 0,
            reserveB: outcomeReserves[1] ?? 0,
            fee,
        }
    }

    // 多元市场 positionId 未齐时不回退 reserveA/B，避免列表误判为二元储备
    if (isMulti) {
        return { fee }
    }

    return {
        reserveA: infos[`${mm}-priceA`] ?? 0,
        reserveB: infos[`${mm}-priceB`] ?? 0,
        fee,
    }
}

export async function getUserTokenBalances(tokenAddr: `0x${string}`, accAddr: `0x${string}`, battle: BattleData | EventPredictData) {
    if (!isAddress(tokenAddr) || !isAddress(battle.marketMaker)) {
        return { balance: 0, balanceA: 0, balanceB: 0, lpBalance: 0, outcomeBalances: [] as number[] }
    }

    const eventMarket = battle as EventPredictData
    const { withPosition, slotCount, isMulti } = resolveMultiOutcomePositions(eventMarket)
    if (isMulti && withPosition.length > 2) {
        let calls: any[] = [
            {
                target: tokenAddr,
                call: ['balanceOf(address)(uint256)', accAddr],
                returns: [['balance', (val: any) => val]]
            },
            {
                target: battle.marketMaker,
                call: ['balanceOf(address)(uint256)', accAddr],
                returns: [['lpBalance', (val: any) => val]]
            },
        ]
        for (const o of withPosition) {
            calls.push({
                target: ConditionalTokens,
                call: ['balanceOf(address,uint256)(uint256)', accAddr, o.positionId],
                returns: [[`outcome-${o.outcomeIndex}`, (val: any) => val]]
            })
        }
        const res = await aggregateWithRpcFallback(calls)
        const transformed = res.results.transformed as Record<string, bigint>
        const outcomeBalances = Array.from({ length: slotCount }, () => 0)
        const outcomeBalancesBi = Array.from({ length: slotCount }, () => 0n)
        for (const o of withPosition) {
            const bi = transformed[`outcome-${o.outcomeIndex}`] ?? 0n
            outcomeBalances[o.outcomeIndex] = Number(bi) / 1e18
            outcomeBalancesBi[o.outcomeIndex] = bi
        }
        return {
            balance: Number(transformed.balance ?? 0n) / 1e18,
            balanceBi: transformed.balance ?? 0n,
            balanceA: outcomeBalances[0] ?? 0,
            balanceB: outcomeBalances[1] ?? 0,
            balanceABi: outcomeBalancesBi[0] ?? 0n,
            balanceBBi: outcomeBalancesBi[1] ?? 0n,
            lpBalance: Number(transformed.lpBalance ?? 0n) / 1e18,
            lpBalanceBi: transformed.lpBalance ?? 0n,
            outcomeBalances,
            outcomeBalancesBi,
        }
    }

    if (!isAddress(tokenAddr) || !isAddress(battle.marketMaker)) return {balance: 0, balanceA: 0, balanceB: 0, lpBalance: 0, outcomeBalances: [] as number[]};
    let calls = [
        {
            target: tokenAddr,
            call: [
                'balanceOf(address)(uint256)',
                accAddr
            ],
            returns: [
                ['balance', (val: any) => val]
            ]
        },
        {
            target: battle.marketMaker,
            call: [
                'balanceOf(address)(uint256)',
                accAddr
            ],
            returns: [
                ['lpBalance', (val: any) => val]
            ]
        },
        {
            target: ConditionalTokens,
            call: [
                'balanceOf(address,uint256)(uint256)',
                accAddr,
                battle.positionAID  
            ],
            returns: [
                ['balanceA', (val: any) => val]
            ]
        },
        {
            target: ConditionalTokens,
            call: [
                'balanceOf(address,uint256)(uint256)',
                accAddr,
                battle.positionBID
            ],
            returns: [
                ['balanceB', (val: any) => val]
            ]
        }
    ]
    const res = await aggregateWithRpcFallback(calls)
    const transformed = res.results.transformed;
    let result: any = {};
    for (let [key, value] of Object.entries(transformed)) {
        result[key] = Number(value) / 1e18;
        result[key + 'Bi'] = value;
    }
    result.outcomeBalances = [result.balanceA ?? 0, result.balanceB ?? 0]
    return result;
}

export async function getPotentialReward(market: EventPredictData) {
    let calls = [{
        target: OracleDistributorV2,
        call: [
            'marketReward(address)(address,address,uint256)',
            market.marketMaker
        ],
        returns: [
            ['rewardToken', (val: any) => val],
            ['marketAddr'],
            ['rewardAmount', (val: any) => val.toString() / 1e18]
        ]
    }]
    const res: any = await aggregateWithRpcFallback(calls)
    return res.results.transformed;
}

export async function getBuyData(battle: BattleData | EventPredictData, shares: number, outcome: 'yes' | 'no' | 'red' | 'blue' | number) {
    if (!shares) return 0;
    const sharesBi = parseUnits(shares.toFixed(18), 18)
    if (sharesBi === 0n) return 0;
    const outcomeIndex = resolveOutcomeIndex(outcome)
    let calls = [{
        target: battle.marketMaker,
        call: [
            'calcBuyAmount(uint256,uint256)(uint256)',
            sharesBi.toString(),
            outcomeIndex
        ],
        returns: [
            ['amount', (val: any) => val.toString() / 1e18]
        ]
    }, {
        target: battle.marketMaker,
        call: [
            "getBNBFee(uint256)(uint256)",
            sharesBi.toString()
        ],
        returns: [
            ['fee', (val: any) => val.toString() / 1e18]
        ]
    }]
    const res: any = await aggregateWithRpcFallback(calls)
    return res.results.transformed;
}

export async function getSellData(battle: BattleData | EventPredictData, reserveA: number, reserveB: number, shares: number, outcome: 'red' | 'blue' | 'yes' | 'no' | number) {
    if (!shares) return {receive: 0, fee: 0};
    if (parseFloat(shares.toFixed(18)) === 0) return {receive: 0, fee: 0};

    const outcomeIndex = resolveOutcomeIndex(outcome)
    const eventMarket = battle as EventPredictData
    const isMulti = isMultiOutcomeEventFactory(eventMarket.factoryVersion) && (eventMarket.outcomeCount ?? 0) > 2

    if (isMulti) {
        // shares = 用户要卖出的 outcome 数量（TradePanel 已减 0.1 缓冲）
        const S = Math.max(0, shares)
        if (S === 0) return { receive: 0, fee: 0 }

        const reserves = getOutcomeReserves(eventMarket)
        const feeRate = eventMarket.fee ?? 0
        const stateReturnAmount = calcSellReturnFromReserves(reserves, outcomeIndex, S, feeRate)
        if (stateReturnAmount === 0) return { receive: 0, fee: 0 }

        const returnBi = parseUnits(stateReturnAmount.toFixed(18), 18)
        const res: any = await aggregateWithRpcFallback([{
            target: battle.marketMaker,
            call: [
                "getBNBFee(uint256)(uint256)",
                returnBi.toString()
            ],
            returns: [
                ['fee', (val: any) => val.toString() / 1e18]
            ]
        }])

        return { receive: stateReturnAmount, fee: res.results.transformed.fee }
    }

    const S = shares;
    const poolBalanceA = reserveA;
    const poolBalanceB = reserveB;

    if (S === 0) return 0n;

    const P_sell = (outcome === 'red' || outcome === 'yes') ?  poolBalanceA : poolBalanceB;
    const P_other = (outcome === 'red' || outcome === 'yes') ? poolBalanceB : poolBalanceA;

    // 计算卖出能得到的抵押代币数量

    const b = -(S + P_sell + P_other);
    const c = S * P_other;
    const delta = Math.sqrt(b * b - 4 * c);
    const x = (-b - delta) / 2;

    const stateReturnAmount = x * (1 - (battle.fee ?? 0)) * 0.99999;
    
    const sharesBi = parseUnits(stateReturnAmount.toFixed(18), 18)
    if (sharesBi === 0n) return 0;
    let calls = [{
        target: battle.marketMaker,
        call: [
            "getBNBFee(uint256)(uint256)",
            sharesBi.toString()
        ],
        returns: [
            ['fee', (val: any) => val.toString() / 1e18]
        ]
    }]
    const res: any = await aggregateWithRpcFallback(calls)
    const fee = res.results.transformed.fee;

    return {receive: stateReturnAmount, fee};
}

export async function buyToken(battle: BattleData | EventPredictData, collateralToken: string, sharesBi: BigInt, minOutcomeTokensToBuy: number, outcome: 'yes' | 'no' | 'red' | 'blue' | number, bnbFee: number) {
    if (!isAddress(battle.marketMaker)) return;
    const minOutcomeTokensToBuyBi = parseUnits(minOutcomeTokensToBuy.toFixed(18), 18)
    if (minOutcomeTokensToBuyBi === 0n) return;
    const outcomeIndex = resolveOutcomeIndex(outcome)

    await approveToken(battle.marketMaker, collateralToken as `0x${string}`, sharesBi);
    
    const bnbFeeBi = bnbFee > 0 ? parseUnits(bnbFee.toFixed(18), 18) + 1000000n : 0n;
    return await writeContract({
        contractName: 'FixedProductMarketMaker',
        functionName: 'buy',
        args: [sharesBi, outcomeIndex, minOutcomeTokensToBuyBi],
        value: bnbFeeBi,
        address: battle.marketMaker
    })

}

export async function sellToken(battle: BattleData | EventPredictData, sharesBi: BigInt, maxOutcomeTokensToSell: BigInt, outcome: 'yes' | 'no' | 'red' | 'blue' | number, bnbFee: number) {
    if (!isAddress(battle.marketMaker)) return;
    if (sharesBi === 0n) return;
    const outcomeIndex = resolveOutcomeIndex(outcome)
    // 与买入 minOutcome * 0.95 对称：最低可接受抵押品留 5% 滑点
    const minReturnAmount = (sharesBi as bigint) * 95n / 100n
    if (minReturnAmount === 0n) return

    const bnbFeeBi = bnbFee > 0 ? parseUnits(bnbFee.toFixed(18), 18) + 1000000n : 0n;

    // approve token
    const approved: any = await readContract('ConditionalTokens', 'isApprovedForAll', [useAccountStore().ethConnectAddress, battle.marketMaker], ConditionalTokens);
    if (!approved) {
        await writeContract({
            contractName: 'ConditionalTokens',
            functionName: 'setApprovalForAll',
            args: [battle.marketMaker, true],
            address: ConditionalTokens
        })
    }

    return await writeContract({
        contractName: 'FixedProductMarketMaker',
        functionName: 'sell',
        args: [minReturnAmount, outcomeIndex, maxOutcomeTokensToSell],
        value: bnbFeeBi,
        address: battle.marketMaker
    })
}

export async function calculateMaxSellAmount(battle: BattleData, index: number) {
    // 获取用户和池子余额
    let calls = [
        {
            target: ConditionalTokens,
            call: [
                "balanceOf(address,uint256)(uint256)",
                useAccountStore().ethConnectAddress,
                index == 0 ? battle.positionAID : battle.positionBID
            ],
            returns: [
                ['balance', (val: any) => val / 1e18]
            ]
        },
        {
            target: ConditionalTokens,
            call: [
                "balanceOf(address,uint256)(uint256)",
                battle.marketMaker,
                battle.positionAID
            ],
            returns: [
                ['poolBalanceA', (val: any) => val / 1e18]
            ]
        },
        {
            target: ConditionalTokens,
            call: [
                "balanceOf(address,uint256)(uint256)",
                battle.marketMaker,
                battle.positionBID
            ],
            returns: [
                ['poolBalanceB', (val: any) => val]
            ]
        }
    ]
    const res = await aggregateWithRpcFallback(calls)
    const S = res.results.transformed['balance'];
    const poolBalanceA = res.results.transformed['poolBalanceA'];
    const poolBalanceB = res.results.transformed['poolBalanceB'];

    if (S === 0) return 0n;

    const P_sell = index === 0 ?  poolBalanceA : poolBalanceB;
    const P_other = index === 0 ? poolBalanceB : poolBalanceA;


    // 计算能卖出的最大值

    const b = -(S + P_sell + P_other);
    const c = S * P_other;
    const delta = Math.sqrt(b * b - 4 * c);
    const x = (-b - delta) / 2;

    const stateReturnAmount = x * 0.99999;
    return parseUnits(stateReturnAmount.toFixed(18), 18);
}

export async function addLiquidity(battle: BattleData | EventPredictData, amount: number, collateralToken: string) {
    if (!isAddress(battle.marketMaker)) return;
    const amountBi = parseUnits(amount.toFixed(18), 18)
    if (amountBi === 0n) return;

    // approve token
    const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, battle.marketMaker], collateralToken as `0x${string}`)
    if (allowance < amountBi) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [battle.marketMaker, amountBi],
            address: collateralToken as `0x${string}`
        })
    }

    return await writeContract({
        contractName: 'FixedProductMarketMaker',
        functionName: 'addFunding',
        args: [amountBi, []],
        address: battle.marketMaker
    })
}

export async function removeLiquidity(battle: BattleData | EventPredictData, sharesBi: bigint) {
    if (!isAddress(battle.marketMaker)) return
    // 留一些流动性在里面，可以维持当前的价格
    const newSharesBi = BigInt(sharesBi) - BigInt(10000000000)
    if (newSharesBi <= 0n) return 
    return await writeContract({
        contractName: 'FixedProductMarketMaker',
        functionName: 'removeFunding',
        args: [newSharesBi],
        address: battle.marketMaker
    })
}

/** Gnosis CT indexSets：outcome i 对应 1 << i；二元 [1,2]，三元 [1,2,4] */
const buildRedeemIndexSets = (battle: BattleData | EventPredictData): number[] => {
    const eventMarket = battle as EventPredictData
    let outcomeSlotCount = 2
    if (isMultiOutcomeEventFactory(eventMarket.factoryVersion)) {
        outcomeSlotCount = Math.max(
            2,
            eventMarket.outcomeCount ?? getOutcomeList(eventMarket).length ?? 2,
        )
    }
    return Array.from({ length: outcomeSlotCount }, (_, i) => 1 << i)
}

export async function redeemPositions(battle: BattleData | EventPredictData, collateralToken: string) {
     if (!isAddress(ConditionalTokens)) return;
     const indexSets = buildRedeemIndexSets(battle);
     const parentCollectionId = '0x0000000000000000000000000000000000000000000000000000000000000000';
     
     return await writeContract({
        contractName: 'ConditionalTokens',
        functionName: 'redeemPositions',
        args: [collateralToken, parentCollectionId, battle.conditionID, indexSets],
        address: ConditionalTokens
    })
}

export async function getUserLpBalance(battle: BattleData | EventPredictData, accAddr: `0x${string}`) {
    if (!isAddress(battle.marketMaker)) return 0;
    const res: any = await readContract('FixedProductMarketMaker', 'balanceOf', [accAddr], battle.marketMaker)
    return Number(res) / 1e18
}

const getCreateFPMMMarketMakerEventByHash = (tx: { logs: Log[] }) => {
    const logs = tx.logs;
  
    try {
      const events = parseEventLogs({
        abi: abis.FPMMDeterministicEventFactoryV3,
        logs,
      });

      for (const event of events) {
        if ('eventName' in event && event.eventName === 'FixedProductMarketMakerCreation') {
            if ('args' in event) {
                return event.args;
            }
        }
      }

      const legacyEvents = parseEventLogs({
        abi: abis.FPMMDeterministicFactoryEventV2,
        logs,
      });

      for (const event of legacyEvents) {
        if ('eventName' in event && event.eventName === 'FixedProductMarketMakerCreation') {
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