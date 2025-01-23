import { getContract } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply } from "@/config";
import { getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract, Ether, ClaimFee } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { get } from "@/apis/axios";

export const checkTickUsed = async (tick: string) => {
    const created = await isTokenExist(tick);
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
  
}

export const buyToken = async (token: string, amount: bigint, ethAmount: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    
}

export const sellToken = async (token: string, amount: bigint, receiveEth: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    
}

export const claimReward = async (token: string, orderId: BigInt, amount: BigInt, signature: string) => {

}

export const calculateInitEth = (amount: bigint) => {
    amount = amount / 100n;
    const price = amount * amount * amount / BigInt(3e36) / (ethers.parseEther('11.43333333'))
    return price * 10000n / (10000n - 100n - 100n);
}

export const getUserTokenInfo = async (token: string, ethAddr: string) => {
    return {}
}

export const getTokenInfo = async (communities: Community[]) => {
    if (communities.length === 0) return [];
    const result = await getTokenOnchainInfo(communities.map(community => community.token));
    return communities.map(community => {
        return {
            ...community,
            listed: community.listedTimestamp ? community.listedTimestamp > 0 : false,
            price: result[community.token]?.price ?? 0,
            marketCap: result[community.token]?.price * 1000000000
        }
    }).filter(community => community.name != 'XCountry');
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    return tweets;
}

export const getTokenOnchainInfo = async (tokens: string[]) => {
    const prices: any = await getTokensPrices(tokens);
    return prices.data
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, amount: bigint) => {
    return 0n
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, amount: bigint) => {
    return 0n
}

export const calculateCapticalLocal = async (supply: number) => {
    return 10000000
}

export const getTokensPrices = async (tokens: string[]) => 
    get('https://api.jup.ag/price/v2', {ids: tokens.join(',')})