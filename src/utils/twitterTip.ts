import { getContract } from "./contract";
import type { Community, CreateCommunity, SocialAccountTokens, Tweet } from "@/types";
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

export const getTokensInfo = async (tokens: SocialAccountTokens[]) => {
    let calls = []
    let tokensCA = tokens.map((item: any) => item.token).filter(ethers.isAddress)
    if (tokensCA.length === 0) {
        return []
    }
    const user = useAccountStore().getAccountInfo.ethAddr
    for (let token of tokensCA) {
        calls.push({
            target: CoinPurse,
            call: [
                'userLimits(address,address)(uint256,uint256,uint256,uint256)',
                user, 
                token
            ],
            returns: [
                [token + '-maxPerTx', (val: any) => val.toString() / 1e18],
                [token + '-maxPerDay', (val: any) => val.toString() / 1e18],
                [token + '-spentToday', (val: any) => val.toString() / 1e18],
                [token + '-lastUpdatedDay', (val: any) => val.toString() / 1e18],
            ]
        }),
        calls.push({
            target: token,
            call: [
                'allowance(address,address)(uint256)',
                user,
                CoinPurse
            ],
            returns: [
                [token + '-allowance', (val: any) => val.toString() / 1e18]
            ]
        }),
        calls.push({
            target: token,
            call: [
                'balanceOf(address)(uint256)',
                user
            ],
            returns: [
                [token + '-balance', (val: any) => val.toString() / 1e18]
            ]
        })
    }
    let res = await aggregate(calls, ChainConfig.multiConfig)
    let results: any = {}
    for(let [key, value] of Object.entries(res.results.transformed)) {
        const [token, type] = key.split('-')
        if (!results[token]) {
            results[token] = tokens.find((item: any) => item.token === token)
        }
        results[token][type] = value
    }
    return Object.values(results) as SocialAccountTokens[]
}