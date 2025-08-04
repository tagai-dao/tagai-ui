import type { SocialAccountTokens } from "@/types";
import { ChainConfig, CoinPurse } from "@/config";
import { aggregate } from '@makerdao/multicall'
import { useAccountStore } from "@/stores/web3";
import { readContract, writeContract } from "./contract";
import { zeroAddress } from "viem";
import { isAddress } from 'viem/utils'

export const getRewardsClaimd = async (twitterId: string) => {
    return await readContract('CoinPurse', 'alreadyWithdraw', [twitterId])
}

export const getPendingClaimTokens = async (twitterId: string, tokens: string[]) => {
    tokens = tokens.filter((token: string) => isAddress(token))
    if (tokens.length === 0) {
        return []
    }
    let calls = []
    for (let token of tokens) {
        calls.push({
            target: CoinPurse,
            call: ['hostingAmount(uint256,address)(uint256)', twitterId, token],
            returns: [
                [token, (val: any) => val.toString() / 1e18]
            ]
        })
    }
    let res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed
}

export const claimTokens = async (twitterId: string, signature: string, tokens: string[]) => {
    // return await writeContract('CoinPurse', 'withdraw', [BigInt(twitterId), tokens, signature])
    return await writeContract({
        contractName: 'CoinPurse',
        functionName: 'withdraw',
        args: [BigInt(twitterId), tokens, signature]
    })
}

export const withdrawBNB = async (amount: bigint) => {
    return await writeContract({
        contractName: 'CoinPurse',
        functionName: 'withdrawBNB',
        args: [amount]
    })
}

export const wrapBNB = async (amount: bigint) => {
    return await writeContract({
        contractName: 'WETH',
        functionName: 'deposit',
        args: [],
        value: amount
    })
}

export const unwrapBNB = async (amount: bigint) => {
    return await writeContract({
        contractName: 'WETH',
        functionName: 'withdraw',
        args: [amount]
    })
}

export const approveCoinPurse = async (token: `0x${string}`, allowance: bigint) => {
    return await writeContract({
        contractName: 'ERC20',
        functionName: 'approve',
        args: [CoinPurse, allowance],
        address: token
    })
}

export const setTokenLimit = async (token: `0x${string}`, limitPerTx: bigint, limitPerDay: bigint, value: bigint = 0n) => {
    if (token == zeroAddress) {
        return await writeContract({
            contractName: 'CoinPurse',
            functionName: 'setLimit',
            args: [token, limitPerTx, limitPerDay]
        })
    }
    return await writeContract({
        contractName: 'CoinPurse',
        functionName: 'setLimit',
        args: [token, limitPerTx, limitPerDay]
    })
}

export const getTokensInfo = async (tokens: SocialAccountTokens[]) => {
    let calls = []
    let tokensCA = tokens.map((item: any) => item.token).filter((token: string) => isAddress(token))
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