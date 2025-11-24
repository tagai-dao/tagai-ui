import type { Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { ChainConfig, WETH, LMSRTradeFee, Ether, USD_CONTRACTS, 
    USD1, LMSRMarketMakerFactory, ConditionalToken, Oracle } from "@/config";
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

export async function createMarket(question: string, funding: bigint) {
    const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, LMSRMarketMakerFactory], USD1)
    if (funding > allowance) {
        await writeContract({
            contractName: 'Token1',
            functionName: 'approve',
            args: [LMSRMarketMakerFactory, funding],
            address: USD1
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
        args: [ConditionalToken, USD1, Oracle, questionId, 2, LMSRTradeFee, whitelist, funding]
    });

    
    return hash;
}