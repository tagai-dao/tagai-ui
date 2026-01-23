import type { BattleData, Community, CreateCommunity, EventPredictData, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, Ether, USD_CONTRACTS, 
    USD1, ConditionalTokens, Oracle, USDT, FPMMDeterministicFactory, PredictionMinFee, PredictionMaxFee, 
    FPMMDeterministicFactory2,
    OracleDistributor} from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import _ from 'lodash'
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
    await approveToken(FPMMDeterministicFactory2, tokenAddress, funding);

    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000;
    distributionHint = Math.ceil(distributionHint)
    // 生成lmsrMarketMaker
    const hash = await writeContract({
        contractName: 'FPMMDeterministicFactory2',
        functionName: 'create2FixedProductMarketMakerWithCondition',
        args: [tokenAddress, questionId, [100 - distributionHint, distributionHint], feePath, [nonce, 2, PredictionMinFee, PredictionMaxFee, endTime, funding]]
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
    if (!isAddress(tokenAddr) || !isAddress(battle.marketMaker)) return {balance: 0, balanceA: 0, balanceB: 0, lpBalance: 0};
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
    return result;
}

export async function getPotentialReward(market: EventPredictData) {
    let calls = [{
        target: OracleDistributor,
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

export async function getBuyData(battle: BattleData | EventPredictData, shares: number, outcome: 'yes' | 'no' | 'red' | 'blue') {
    if (!shares) return 0;
    const sharesBi = parseUnits(shares.toFixed(18), 18)
    if (sharesBi === 0n) return 0;
    console.log('sharesBi', sharesBi)
    let calls = [{
        target: battle.marketMaker,
        call: [
            'calcBuyAmount(uint256,uint256)(uint256)',
            sharesBi.toString(),
            (outcome === 'red' || outcome === 'yes') ? 0 : 1
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

export async function getSellData(battle: BattleData | EventPredictData, reserveA: number, reserveB: number, shares: number, outcome: 'red' | 'blue') {
    if (!shares) return {receive: 0, fee: 0};
    if (parseFloat(shares.toFixed(18)) === 0) return {receive: 0, fee: 0};

    const S = shares;
    const poolBalanceA = reserveA;
    const poolBalanceB = reserveB;

    if (S === 0) return 0n;

    const P_sell = outcome === 'red' ?  poolBalanceA : poolBalanceB;
    const P_other = outcome === 'red' ? poolBalanceB : poolBalanceA;

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

export async function buyToken(battle: BattleData | EventPredictData, collateralToken: string, sharesBi: BigInt, minOutcomeTokensToBuy: number, outcome: 'yes' | 'no' | 'red' | 'blue', bnbFee: number) {
    if (!isAddress(battle.marketMaker)) return;
    const minOutcomeTokensToBuyBi = parseUnits(minOutcomeTokensToBuy.toFixed(18), 18)
    if (minOutcomeTokensToBuyBi === 0n) return;

    await approveToken(battle.marketMaker, collateralToken as `0x${string}`, sharesBi);
    
    const bnbFeeBi = bnbFee > 0 ? parseUnits(bnbFee.toFixed(18), 18) + 1000000n : 0n;

    return await writeContract({
        contractName: 'FixedProductMarketMaker',
        functionName: 'buy',
        args: [sharesBi, (outcome === 'red' || outcome === 'yes') ? 0 : 1, minOutcomeTokensToBuyBi],
        value: bnbFeeBi,
        address: battle.marketMaker
    })

}

export async function sellToken(battle: BattleData | EventPredictData, sharesBi: BigInt, maxOutcomeTokensToSell: BigInt, outcome: 'yes' | 'no' | 'red' | 'blue', bnbFee: number) {
    if (!isAddress(battle.marketMaker)) return;
    if (sharesBi === 0n) return;
    

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
        args: [sharesBi, (outcome === 'red' || outcome === 'yes') ? 0 : 1, maxOutcomeTokensToSell],
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
        abi: abis.FPMMDeterministicFactory,
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