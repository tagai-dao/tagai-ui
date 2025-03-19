import { getContract } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply, IPShareContract1, IPShareContract2, wrappedUniswapV2ForTagAI } from "@/config";
import { getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, Ether, ClaimFee } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { getDayNumber } from '@/utils/helper'
import { version } from "os";

const pumpContract = [
    PumpContract1,
    PumpContract2,
    PumpContract3,
    PumpContract4
]

export const checkTickUsed = async (tick: string) => {
    const created = await isTokenExist(tick);
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump4')
    let tx: any = await pump.createToken(createParms.tick, {
        value: (createParms.initEth ?? 0n) + BigInt(CreateFee)
    })

    await tx.wait();
    // tx: any = await getTransactionReceipt(hash);
    const hash = tx.hash;
    tx = await getTransactionReceipt(hash)
    const event: any = getCreateTokenEventByHash(tx, 2);
    if (event && event.length == 3 && event[0] == createParms.tick) {
        return {token: event[1], createHash: tx.hash}
    }
    return {createHash: hash}
}

export const buyToken = async (token: string, version: number, amount: bigint, ethAmount: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    if (listed) {
        // const router = await getContract('UniswapRouter');
        // const tx = await router.swapExactETHForTokens(
        //     amount * BigInt(10000 - slippage) / 10000n,
        //     [WETH, token],
        //     useAccountStore().ethConnectAddress,
        //     Math.floor(Date.now() / 1000) + 300,
        //     {
        //         value: ethAmount
        //     }
        // )
        
        // await tx.wait();
        // return tx.hash;

        // 2% transaction fee
        const amountOut = await getBuyAmountUseEth(token, ethAmount * 9800n / 10000n);

        const wrapSwaper = await getContract('WrapSwaper');
        const tx = await wrapSwaper.buyToken(
            ethers.ZeroAddress,
            amountOut * BigInt(10000 - slippage) / 10000n,
            [WETH, token],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300,
            version == 1 ? IPShareContract1 : IPShareContract2,
            {
                value: ethAmount
            }
        )
        await tx.wait();
        return tx.hash;
    }else {
        const tc = await getContract('Token' + version, token)
        if (version == 1) {
            const tx = await tc.buyToken(amount, sellsman, slippage, ethers.ZeroAddress, {
                value: ethAmount
            })
            await tx.wait();
            return tx.hash;
        }else {
            const tx = await tc.buyToken(amount, sellsman, slippage, {
                value: ethAmount
            })
            await tx.wait();
            return tx.hash;
        }
    }
}

export const sellToken = async (token: string, version: number, amount: bigint, receiveEth: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    const tc = await getContract('Token1', token)
    if (listed) {
        // checkout approve
        // const allowance = await tc.allowance(useAccountStore().ethConnectAddress, uniswapV2Router02);
        // if (allowance < amount) {
        //     const res = await tc.approve(uniswapV2Router02, ethers.MaxInt256);
        //     await res.wait();
        // }
        // const router = await getContract('UniswapRouter');
        // const tx = await router.swapExactTokensForETH(
        //     amount,
        //     receiveEth * BigInt(10000 - slippage) / 10000n,
        //     [token, WETH],
        //     useAccountStore().ethConnectAddress,
        //     Math.floor(Date.now() / 1000) + 300
        // )
        // await tx.wait();
        // return tx.hash;

        const allowance = await tc.allowance(useAccountStore().ethConnectAddress, wrappedUniswapV2ForTagAI);
        if (allowance < amount) {
            const res = await tc.approve(wrappedUniswapV2ForTagAI, ethers.MaxInt256);
            await res.wait();
        }

        const expectedReceive = await getSellAmountUseToken(token, amount);

        const wrapSwaper = await getContract('WrapSwaper');

        const tx = await wrapSwaper.sellToken(
            amount,
            expectedReceive * BigInt(10000 - slippage) / 10000n,
            [token, WETH],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300,
            ethers.ZeroAddress,
            version == 1 ? IPShareContract1 : IPShareContract2
        )
        await tx.wait();
        return tx.hash;
    }else {
        const tx = await tc.sellToken(amount, receiveEth, sellsman, slippage);
        await tx.wait();
        return tx.hash;
    }
}

export const claimReward = async (token: string, version: number, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    const tc = await getContract('Pump' + version)
    const tx = await tc.userClaim(token, orderId, amount, signature, {
        value: ClaimFee
    });
    await tx.wait();
    return tx.hash;
}

export const calculateInitEth = async (amount: bigint) => {
    const pump = await getContract('Pump1', undefined, true);
    const price = await pump.getBuyPriceAfterFee(0n, amount);
    return price;
}

export const getUserTokenInfo = async (token: string, ethAddr: string) => {
    let calls = [
        {
            target: token,
            call: [
                'balanceOf(address)(uint256)',
                ethAddr
            ],
            returns: [
                ['balance']
            ]
        },
        {
            call: [
              'getEthBalance(address)(uint256)', 
              ethAddr
            ],
            returns: [['ethBalance', (val: any) => val / 10 ** 18]]
          }
    ]
    const res = await aggregate(calls, ChainConfig.multiConfig);
    return res.results.transformed;
}

function checkDistributionEnd(config: any) {
    let lastTime = 0;
    config.forEach((v: any) => {
        if (v.end >= lastTime) lastTime = v.end;
    })
    return Date.now() / 1000 > lastTime;
}

export const getTokenInfo = async (communities: Community[]) => {
    if (communities.length === 0) return communities;
    let tokens = communities.map(com => com.token)
    let versions: Record<string, number> = {}
    for (let com of communities) {
        versions[com.token!] = com.version ?? 2;
    }
    let result = await getTokenOnchainInfo(tokens, versions)

    for (let community of communities) {
        const tokenInfo = result[community.token]
        community.listed = tokenInfo.listed;
        community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        community.price = tokenInfo.price;
        community.marketCap = ((community.price ?? 0) * TotalSupply);
        community.pair = tokenInfo.pair;
        // const distribution = JSON.parse(community.distribution);
        // community.distributionEnded = (community.listedDayNumber ?? 0) + 100 < getDayNumber();
        // community.distributionEnded = checkDistributionEnd(distribution);
    }

    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    if (tweets.length === 0) return tweets;
    let tokens = tweets.map(t => t.token ?? '')
    let versions: Record<string, number> = {}
    for (let tweet of tweets) {
        versions[tweet.token!] = tweet.version ?? 2;
    }
    let result = await getTokenOnchainInfo(tokens, versions)
    
    for( let tweet of tweets) {
        if (!tweet.token) continue
        const tokenInfo = result[tweet.token]
        tweet.listed = tokenInfo.listed;
        tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        tweet.price = tokenInfo.price;
        tweet.marketCap = ((tweet.price ?? 0) * TotalSupply);
        tweet.pair = tokenInfo.pair;
    }
    return tweets;
}

export const getTokenOnchainInfo = async (tokens: String[], versions: Record<string, number>) => {
    if (tokens.length === 0) return []
    tokens = _.union(tokens)
    let calls: any[] = []
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
                target: pumpContract[versions[token] - 1],
                call: [
                    'totalClaimedSocialRewards(address)(uint256)',
                    token
                ],
                returns: [
                    [token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]
                ]
            },
            {
                target: uniswapV2Factory,
                call: [
                    'getPair(address,address)(address)',
                    token,
                    WETH
                ],
                returns: [
                    [token + '-pair']
                ]
            }
        ])
    }
    
    const res = await aggregate(calls, ChainConfig.multiConfig)
    let infos = res.results.transformed
    let result: any = {}
    
    for (let [key, value] of Object.entries(infos)) {
        const [token, type] = key.split('-')
        if (!result[token]) {
            result[token] = {}
        }
        result[token][type] = value;
    }
    calls = []
    for (let p of Object.entries(result)) {
        const token = p[0]
        let info: any = p[1]
        calls.push({
            target: pumpContract[versions[token] - 1],
            call: [
                'getPrice(uint256,uint256)(uint256)',
                info.bondingCurveSupply.toString(),
                '1000000000000000000'
            ],
            returns: [
                [token + '-price', (val: any) => (val).toString() / 1e18]
            ]
        })
        if (info.listed) {
            calls.push({
                target: info.pair,
                call: [
                    'getReserves()(uint256, uint256)'
                ],
                returns: [
                    [token + '-1', (val: any) => (val).toString() / 1e18],
                    [token + '-2', (val: any) => (val).toString() / 1e18]
                ]
            })
            calls.push({
                target: info.pair,
                call: [
                    'token0()(address)',
                ],
                returns: [
                    [token + '-token0']
                ]
            })
        }
    }
    if (calls.length > 0) {
        let res = await aggregate(calls, ChainConfig.multiConfig);
        res = res.results.transformed;
        for (let [key, value] of Object.entries(result)) {
            // @ts-ignore
            if (value.listed) {
                if (res[key + '-token0'] === key) {
                    result[key].price = res[key + '-2'] / res[key + '-1']
                }else {
                    result[key].price = res[key + '-1'] / res[key + '-2']
                }
            }else{
                result[key].price = res[key + '-price']
            }
        }
    }
    return result
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token) return {supply: 0n, receive: 0n}
    const tc = await getContract('Token1', token, true);
    const supply = await tc.bondingCurveSupply();
    const pumpC = await getContract('Pump' + version, pumpContract[version - 1], true);
    const receive = await pumpC.getBuyAmountByValue(supply, amount * 9800n / 10000n)
    return {supply, receive}
}

export const getBuyPriceAfterFee = async (supply: bigint, amount: bigint) => {
    const pump = await getContract('Pump2', undefined, true);
    const price = await pump.getBuyPriceAfterFee(supply, amount);
    return price;
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token1', token, true);
    const pumpC = await getContract('Pump' + version, pumpContract[version - 1], true);
    const supply = await tc.bondingCurveSupply();
    const receive = await pumpC.getSellPriceAfterFee(supply, amount)
    return receive
}

const getCreateTokenEventByHash = (tx: any, version: number) => {
    let contract = new ethers.Contract(pumpContract[version - 1], abis.Pump1)
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

export const getBuyAmountUseEth = async (token: string, ethAmount: BigInt) => {
    let contract = await getContract('UniswapRouter', undefined, true);
    const amount = await contract.getAmountsOut(ethAmount, [WETH, token]);
    return amount[amount.length - 1];
}

export const getSellAmountUseToken = async (token: string, tokenAmount: BigInt) => {
    let contract = await getContract('UniswapRouter', undefined, true);
    const amount = await contract.getAmountsOut(tokenAmount, [token, WETH]);
    return amount[amount.length - 1];
}