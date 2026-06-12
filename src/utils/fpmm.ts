import type { BattleData, Community, CreateCommunity, EventPredictData, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, Ether, USD_CONTRACTS,
    USD1, ConditionalTokens, Oracle, USDT, FPMMDeterministicFactory, PredictionMinFee, PredictionMaxFee,
    FPMMDeterministicFactoryEventV2,
    OracleDistributorV2} from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import _, { min } from 'lodash'
import { useStateStore } from "@/stores/common";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, checksumAddress, type Log, keccak256, toBytes, parseUnits } from "viem";
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

export async function createEventMarket(questionId: string, tokenAddress: `0x${string}`, feePath: string[], distributionHint: number, endTime: number, funding: bigint) {
    return createEventMarketV2(
        questionId,
        tokenAddress,
        feePath,
        [100 - Math.ceil(distributionHint), Math.ceil(distributionHint)],
        2,
        endTime,
        funding
    )
}

/** Event V2 多元市场（N 个 outcome） */
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
    const outcomes = getOutcomeList(market).filter(o => o.positionId)
    const useMulti = market.factoryVersion === 2 && outcomes.length > 0

    const calls: any[] = []
    if (useMulti) {
        for (const o of outcomes) {
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
    } else {
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

    const res = await aggregate(calls, ChainConfig.multiConfig)
    const transformed = res.results.transformed as Record<string, number>
    const reserves = useMulti
        ? outcomes.map(o => transformed[`${market.marketMaker}-reserve-${o.outcomeIndex}`] ?? 0)
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
        return []
    }
    // 获取价格
    let calls = [];
    for (let market of markets) {
        calls.push({
            target: ConditionalTokens,
            call: [
                'balanceOf(address,uint256)(uint256)',
                market.marketMaker,
                market.positionAID
            ],
            returns: [
                [market.marketMaker + '-priceA', (val: any) => val / 1e18]
            ]
        })
        calls.push({
            target: ConditionalTokens,
            call: [
                'balanceOf(address,uint256)(uint256)',
                market.marketMaker,
                market.positionBID
            ],
            returns: [
                [market.marketMaker + '-priceB', (val: any) => val / 1e18]
            ]
        })
        calls.push({
            target: market.marketMaker,
            call: [
                'getFee()(uint256)'
            ],
            returns: [
                [market.marketMaker + '-fee', (val: any) => val / 1e18]
            ]
        })
        calls.push({
            target: market.marketMaker,
            call: [
                'totalSupply()(uint256)'
            ],
            returns: [
                [market.marketMaker + '-totalSupply', (val: any) => val / 1e18]
            ]
        })
    }
    const res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed;
}

export async function getUserTokenBalances(tokenAddr: `0x${string}`, accAddr: `0x${string}`, battle: BattleData | EventPredictData) {
    if (!isAddress(tokenAddr) || !isAddress(battle.marketMaker)) {
        return { balance: 0, balanceA: 0, balanceB: 0, lpBalance: 0, outcomeBalances: [] as number[] }
    }

    const eventMarket = battle as EventPredictData
    const outcomes = getOutcomeList(eventMarket).filter(o => o.positionId)
    if (eventMarket.factoryVersion === 2 && outcomes.length > 2) {
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
        for (const o of outcomes) {
            calls.push({
                target: ConditionalTokens,
                call: ['balanceOf(address,uint256)(uint256)', accAddr, o.positionId],
                returns: [[`outcome-${o.outcomeIndex}`, (val: any) => val]]
            })
        }
        const res = await aggregate(calls, ChainConfig.multiConfig)
        const transformed = res.results.transformed as Record<string, bigint>
        const outcomeBalances = outcomes.map(o => Number(transformed[`outcome-${o.outcomeIndex}`] ?? 0n) / 1e18)
        const outcomeBalancesBi = outcomes.map(o => transformed[`outcome-${o.outcomeIndex}`] ?? 0n)
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
    const res = await aggregate(calls, ChainConfig.multiConfig)
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
    const res: any = await aggregate(calls, ChainConfig.multiConfig)
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
    const res: any = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed;
}

export async function getSellData(battle: BattleData | EventPredictData, reserveA: number, reserveB: number, shares: number, outcome: 'red' | 'blue' | 'yes' | 'no' | number) {
    if (!shares) return {receive: 0, fee: 0};
    if (parseFloat(shares.toFixed(18)) === 0) return {receive: 0, fee: 0};

    const outcomeIndex = resolveOutcomeIndex(outcome)
    const eventMarket = battle as EventPredictData
    const isMulti = eventMarket.factoryVersion === 2 && (eventMarket.outcomeCount ?? 0) > 2

    if (isMulti) {
        // shares = 用户要卖出的 outcome 数量（TradePanel 已减 0.1 缓冲）
        const S = Math.max(0, shares)
        if (S === 0) return { receive: 0, fee: 0 }

        const reserves = getOutcomeReserves(eventMarket)
        const feeRate = eventMarket.fee ?? 0
        const stateReturnAmount = calcSellReturnFromReserves(reserves, outcomeIndex, S, feeRate)
        if (stateReturnAmount === 0) return { receive: 0, fee: 0 }

        const returnBi = parseUnits(stateReturnAmount.toFixed(18), 18)
        const res: any = await aggregate([{
            target: battle.marketMaker,
            call: [
                "getBNBFee(uint256)(uint256)",
                returnBi.toString()
            ],
            returns: [
                ['fee', (val: any) => val.toString() / 1e18]
            ]
        }], ChainConfig.multiConfig)

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
    const res: any = await aggregate(calls, ChainConfig.multiConfig)
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
    const res = await aggregate(calls, ChainConfig.multiConfig)
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

export async function redeemPositions(battle: BattleData | EventPredictData, collateralToken: string) {
     if (!isAddress(ConditionalTokens)) return;
     // indexSets: [1, 2] for binary
     const indexSets = [1, 2];
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
        abi: abis.FPMMDeterministicFactoryEventV2,
        logs,
        // 如果你确定只关心某个合约地址：
        // strict: true,
        // args: [可选],
      });

      for (const event of events) {
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