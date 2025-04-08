import { getContract } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply, IPShareContract1, IPShareContract2, wrappedUniswapV2ForTagAI, CoinPurse } from "@/config";
import { getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, Ether, ClaimFee } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useAccountStore } from "@/stores/web3";

export const getRewardsClaimd = async (twitterId: string) => {
    let coinPurse = await getContract('CoinPurse', undefined, true);
    let claimEthAddress = await coinPurse.alreadyWithdraw(twitterId);
    return claimEthAddress;
}

export const wrapBNB = async (amount: bigint) => {
    let weth = await getContract('WETH');
    let tx = await weth.deposit({value: amount});
    await tx.wait();
    return tx;
}

export const unwrapBNB = async (amount: bigint) => {
    let weth = await getContract('WETH');
    let tx = await weth.withdraw(amount);
    await tx.wait();
    return tx;
}

export const approveCoinPurse = async (token: string, allowance: bigint) => {
    let coinPurse = await getContract('ERC20', token);
    let tx = await coinPurse.approve(CoinPurse, allowance);
    await tx.wait();
    return tx;
}

export const setTokenLimit = async (token: string, limitPerTx: bigint, limitPerDay: bigint) => {
    let coinPurse = await getContract('CoinPurse');
    let tx = await coinPurse.setLimit(token, limitPerTx, limitPerDay);
    return tx;
}