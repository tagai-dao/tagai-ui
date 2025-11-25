import type { Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, LMSRTradeFee, Ether, USD_CONTRACTS, 
    USD1, LMSRMarketMakerFactory, ConditionalToken, Oracle, USDT } from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { abis } from './abis'
import { getEthPrice } from "@/apis/api";
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useStateStore } from "@/stores/common";
import { getTradeSignature, isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, checksumAddress, type Log, keccak256, toBytes } from "viem";
import { writeContract, readContract } from "./contract";

export async function createMarket(question: string, tokenAddress: `0x${string}`, funding: bigint) {
    const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, LMSRMarketMakerFactory], tokenAddress)
    if (funding > allowance) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [LMSRMarketMakerFactory, funding],
            address: tokenAddress
        })
    }
    // 生成questingId
    const questionId = keccak256(toBytes(question));
    // 生成whitelist
    const whitelist = zeroAddress;
    // 生成lmsrMarketMaker
    const hash = await writeContract({
        contractName: 'LMSRMarketMakderFactory',
        functionName: 'prepareAndCreateLMSRMarketMaker',
        args: [ConditionalToken, tokenAddress, Oracle, questionId, 2, LMSRTradeFee, whitelist, funding]
    });

    // 预创建预测市场


    let tx = await getTransactionReceipt(hash as `0x${string}`)
    //   event LMSRMarketMakerCreation(address indexed creator, LMSRMarketMaker lmsrMarketMaker, ConditionalTokens pmSystem, IERC20 collateralToken, bytes32[] conditionIds, uint64 fee, uint funding);
    const event: any = getCreateLMSRMarketMakerEventByHash(tx);
    if (event && event.creator === useAccountStore().ethConnectAddress
        && event.pmSystem == ConditionalToken
        && event.collateralToken === tokenAddress
        && event.conditionIds.length === 1
        && event.fee === LMSRTradeFee) {
        // 读取链上的conditionid是否和事件中的一致
        const conditionId = await readContract('ConditionalToken', 'getConditionId', [Oracle, questionId, 2])
        if (conditionId !== event.conditionIds[0]) {
            throw 'Invalid transaction'
        }
        // 创建成功，返回txhash，event.lmsrMarketMaker
        return {hash, lmsrMarketMaker: event.lmsrMarketMaker};
    }else {
        // 非法交易
        throw 'Invalid transaction'
    }
}

const getCreateLMSRMarketMakerEventByHash = (tx: { logs: Log[] }) => {
    const logs = tx.logs;
  
    try {
      const events = parseEventLogs({
        abi: abis.LMSRMarketMakerFactory,
        logs,
        // 如果你确定只关心某个合约地址：
        // strict: true,
        // args: [可选],
      });

      for (const event of events) {
        if ('eventName' in event && event.eventName === 'LMSRMarketMakerCreation') {
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