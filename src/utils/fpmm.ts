import type { BattleData, Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, Ether, USD_CONTRACTS, 
    USD1, ConditionalTokens, Oracle, USDT, FPMMDeterministicFactory, PredictionMinFee, PredictionMaxFee } from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { abis } from './abis'
import { getEthPrice } from "@/apis/api";
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useStateStore } from "@/stores/common";
import { getTradeSignature, isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, checksumAddress, type Log, keccak256, toBytes, parseUnits } from "viem";
import { writeContract, readContract } from "./contract";

export async function createMarket(questionId: string, tokenAddress: `0x${string}`, feePath: string[], dayNumber: number, funding: bigint) {
    const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, FPMMDeterministicFactory], tokenAddress)
    if (funding > allowance) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [FPMMDeterministicFactory, funding],
            address: tokenAddress
        })
    }

    const nonce = Date.now() + Math.floor(Math.random() * 1000000) * 100000000000;
    
    // 生成lmsrMarketMaker
    const hash = await writeContract({
        contractName: 'FPMMDeterministicFactory',
        functionName: 'create2FixedProductMarketMakerWithCondition',
        args: [tokenAddress, questionId, [], feePath, [nonce, 2, PredictionMinFee, PredictionMaxFee, dayNumber, funding]]
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

export const getMarketInfos = async (markets: BattleData[]) => {
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
    }
    
    const res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed;
}

export async function getUserTokenBalances(tokenAddr: `0x${string}`, accAddr: `0x${string}`, battle: BattleData) {
    let calls = [
        {
            target: tokenAddr,
            call: [
                'balanceOf(address)(uint256)',
                accAddr
            ],
            returns: [
                ['balance', (val: any) => val / 1e18]
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
                ['balanceA', (val: any) => val / 1e18]
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
                ['balanceB', (val: any) => val / 1e18]
            ]
        }
    ]
    const res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed;
}

export async function getBuyData(battle: BattleData, shares: number, outcome: 'red' | 'blue') {
    const sharesBi = parseUnits(shares.toString(), 18)
    if (sharesBi === 0n) return 0;
    console.log('sharesBi', sharesBi)
    let calls = [{
        target: battle.marketMaker,
        call: [
            'calcBuyAmount(uint256,uint256)(uint256)',
            sharesBi.toString(),
            outcome === 'red' ? 0 : 1
        ],
        returns: [
            ['amount', (val: any) => val.toString() / 1e18]
        ]
    }]
    const res: any = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed.amount;
}

export async function getSellData(battle: BattleData, shares: number, outcome: 'red' | 'blue') {
    const sharesBi = parseUnits(shares.toString(), 18)
    if (sharesBi === 0n) return 0;
    let calls = [{
        
    }]

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