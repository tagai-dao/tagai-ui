import { getContract } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, ChainConfig } from "@/config";
import { getReadOnlyProvider, getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract, Ether } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'

export const checkTickUsed = async (tick: string) => {
    const pump = await getContract('Pump')
    const created = await pump.createdTicks(tick)
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump')
    const tx = await pump.createToken(createParms.tick, {
        value: (createParms.initBtc ?? 0n) + BigInt(CreateFee)
    })
    await tx.wait();
    const event: any = await getCreateTokenEventByHash(tx.hash);
    if (event && event.length == 3 && event[0] == createParms.tick) {
        return {token: event[1], createHash: tx.hash}
    }
    return {createHash: tx.hash}
}

export const buyToken = async (token: string, amount: bigint, ethAmount: bigint, sellsman: ethers.AddressLike, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    const tc = await getContract('Token', token)
    const tx = await tc.buyToken(amount, sellsman, slippage, ethers.ZeroAddress, {
        value: ethAmount
    })
    await tx.wait();
    return tx.hash;
}

export const sellToken = async (token: string, amount: bigint, receiveEth: bigint, sellsman: ethers.AddressLike, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    try {
        const tc = await getContract('Token', token)
        const tx = await tc.sellToken(amount, receiveEth, sellsman, slippage);
        await tx.wait();
        return tx.hash;
    } catch (error: any) {
        try {
            const iface = new ethers.Interface(abis.Token);
            const ipface = new ethers.Interface(abis.IPShare);
            const ipump = new ethers.Interface(abis.Pump);
            const decodedError1 = iface.parseError(error.data);
            const decodedError2 = ipface.parseError(error.data);
            const decodedError3 = ipump.parseError(error.data);
            console.log('custom error', decodedError1, decodedError2, decodedError3)
        } catch (error) {
            
        }
    }
}

export const calculateInitBtc = (amount: bigint) => {
    const price = amount * amount * amount / BigInt(3e36) / (320n * Ether)
    return price * 10000n / (10000n - 100n - 100n);
}

export const getTokenInfo = async (communities: Community[]) => {
    let calls: any = []
    for (let community of communities) {
        const token = community.token;
        if (!ethers.isAddress(token)) continue;
        calls = calls.concat([
            {
                target: token,
                call: [
                    'bondingCurveSupply()(uint256)'
                ],
                returns: [
                    [token + '-bondingCurveSupply', (val: any) => BigInt(val)]
                ]
            },{
                target: token,
                call: [
                    'listed()(bool)'
                ],
                returns: [
                    [token + '-listed']
                ]
            },
            {
                target: token,
                call: [
                    'totalClaimedSocialRewards()(uint256)'
                ],
                returns: [
                    [token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]
                ]
            },
            {
                target: token,
                call: [
                    'getBuyPrice(uint256)(uint256)',
                    '1000000000000000000'
                ],
                returns: [
                    [token + '-price', (val: any) => BigInt(val)]
                ]
            }
        ])
    }
    const res = await aggregate(calls, ChainConfig.multiConfig)
    let info = res.results.transformed
    let result: any = {}
    for (let [key, value] of Object.entries(info)) {
        const [token, type] = key.split('-')
        if (!result[token]) {
            result[token] = {}
        }
        result[token][type] = value;
    }
    for( let community of communities) {
        const tokenInfo = result[community.token]
        community.listed = tokenInfo.listed;
        community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        community.price = tokenInfo.price.toString() / 1e18;
        community.marketCap = community.price * 10000000;
    }
    
    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    let calls: any = []
    const tokens = _.union(tweets.map(t => t.token))
    for (let token of tokens) {
        if (!ethers.isAddress(token)) continue;
        calls = calls.concat([
            {
                target: token,
                call: [
                    'bondingCurveSupply()(uint256)'
                ],
                returns: [
                    [token + '-bondingCurveSupply', (val: any) => BigInt(val)]
                ]
            },{
                target: token,
                call: [
                    'listed()(bool)'
                ],
                returns: [
                    [token + '-listed']
                ]
            },
            {
                target: token,
                call: [
                    'totalClaimedSocialRewards()(uint256)'
                ],
                returns: [
                    [token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]
                ]
            },
            {
                target: token,
                call: [
                    'getBuyPrice(uint256)(uint256)',
                    '1000000000000000000'
                ],
                returns: [
                    [token + '-price', (val: any) => BigInt(val)]
                ]
            }
        ])
    }
    const res = await aggregate(calls, ChainConfig.multiConfig)
    let info = res.results.transformed
    let result: any = {}
    for (let [key, value] of Object.entries(info)) {
        const [token, type] = key.split('-')
        if (!result[token]) {
            result[token] = {}
        }
        result[token][type] = value;
    }
    for( let tweet of tweets) {
        if (!tweet.token) continue
        const tokenInfo = result[tweet.token]
        tweet.listed = tokenInfo.listed;
        tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        tweet.price = tokenInfo.price.toString() / 1e18;
        tweet.marketCap = tweet.price * 10000000;
    }
    return tweets;
}

export const getBuyAmountWithBTCAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getBuyAmountByValue(amount * 9800n / 10000n);
    return receive
}

export const getReceivedAmountSellBTCAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getSellPriceAfterFee(amount);
    return receive
}

export const calculateCapticalLocal = async (supply: number) => {
    return supply * supply * 1000000 / 320e18
}

export const getTokenCap = async (communities: Community[]) => {
    if (communities.length == 0) return [];
    let calls = communities.map(com => ({
        target: com.token,
        call: [
            'getBuyPrice(uint256)(uint256)',
            '1000000000000000000'
        ],
        returns: [
            [com.tick, (val: any) => BigInt(val)]
        ]
    }))

    const res = await aggregate(calls, ChainConfig.multiConfig)
    const prices = res.results.transformed
    for(let com of communities) {
        // @ts-ignore
        com.marketCap = (prices[com.tick] * 10000000n).toString() / 1e18
    }
    return communities
}

const getCreateTokenEventByHash = async (hash: string) => {
    let tx: any = await getTransactionReceipt(hash);
    let contract = new ethers.Contract(PumpContract, abis.Pump)
    let event;
    tx.logs.forEach((log: any) => {
        try {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'NewToken') {
                event = parsedLog.args
            }
        } catch (error) {
            console.error(error)
        }
    });
    return event
}