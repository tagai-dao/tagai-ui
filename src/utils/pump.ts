import { getContract, aggregate } from "./contract";
import type { Community, CreateCommunity, Tweet } from "@/types";
import { CreateFee, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply } from "@/config";
import { ClaimFee } from "@/config";
import errCode from "@/errCode";
import _ from 'lodash'
import { isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { nulsapi } from "./nuls"
import { getEvent, isAddress, parseNULS, fromNULS } from "nuls-api-v2"

export const checkTickUsed = async (tick: string) => {
    const created = await isTokenExist(tick);
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump')
    let txHash: any = await pump.createToken(createParms.tick, {
        value: (createParms.initEth ?? 0n) + BigInt(CreateFee)
    })

    const txResult = await nulsapi.waitingResult(txHash)
    const event: any = getEvent(txResult, 'NewToken')
    if (event && event.tick == createParms.tick) {
        return { token: event.token, createHash: txHash }
    }
    return { createHash: txHash }
}

export const buyToken = async (token: string, amount: bigint, ethAmount: bigint, sellsman: string | null, listed: boolean, slippage = 0) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!isAddress(sellsman)) {
        sellsman = null;
    }
    if (listed) {
        const router = await getContract('UniswapRouter');
        const txHash = await router.swapExactETHForTokens(
            (amount * BigInt(slippage) / 10000n).toString(),
            [WETH, token],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300,
            {
                value: ethAmount
            }
        )

        await nulsapi.waitingResult(txHash)
        return txHash;
    } else {
        const tc = await getContract('Token', token)
        const txHash = await tc.buyToken(amount, sellsman, slippage, null, {
            value: ethAmount
        })
        await nulsapi.waitingResult(txHash)
        return txHash;
    }
}

export const sellToken = async (token: string, amount: bigint, receiveEth: bigint, sellsman: string | null, listed: boolean, slippage = 0) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!isAddress(sellsman)) {
        sellsman = null;
    }
    const tc = await getContract('Token', token)
    if (listed) {
        // checkout approve
        const result = await tc.allowance(useAccountStore().ethConnectAddress, uniswapV2Router02);
        const allowance = BigInt(result.toString(10))
        if (allowance < amount) {
            const res = await tc.approve(uniswapV2Router02, BigInt("100000000000000000"));
            await nulsapi.waitingResult(res)
        }
        const router = await getContract('UniswapRouter');
        const txHash = await router.swapExactTokensForETH(
            amount.toString(),
            (receiveEth * BigInt(slippage) / 10000n).toString(),
            [token, WETH],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300
        )
        await nulsapi.waitingResult(txHash)
        return txHash
    } else {
        const txHash = await tc.sellToken(amount, receiveEth, sellsman, slippage);
        await nulsapi.waitingResult(txHash)
        return txHash;
    }
}

export const claimReward = async (token: string, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    console.log(3, token, orderId, amount, signature)
    const tc = await getContract('Token', token)
    const txHash = await tc.userClaim(token, orderId, amount, signature, {
        value: ClaimFee
    });
    await nulsapi.waitingResult(txHash)
    return txHash;
}

export const calculateInitEth = (amount: bigint) => {
    amount = amount / 100n;
    const price = amount * amount * amount / BigInt(3e36) / (BigInt(parseNULS('0.00381', 18).toString(10)))
    return (price * 10000n / (10000n - 100n - 100n)) / 10000000000n;
}

export const getUserTokenInfo = async (token: string, ethAddr: string) => {
    let multicall = await getContract("multicall");
    let results = await multicall.userTokenBalancesAndNulsAvailable(ethAddr, [token, ""]);
    return results.map((result: any) => {
        if (/^-?\d+$/.test(result)) {
            return fromNULS(result)
        } else if (Array.isArray(result)) {
            return fromNULS(result[0])
        } else {
            return 0
        }
    })
}

export const getTokenInfo = async (communities: Community[]) => {
    if (communities.length === 0) return communities;
    let result = await getTokenOnchainInfo(communities.map(com => com.token))

    for (let community of communities) {
        const tokenInfo = result[community.token]
        community.listed = tokenInfo.listed;
        community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e8;
        community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e8;
        community.price = tokenInfo.price;
        community.marketCap = (community.price ?? 0) * TotalSupply;
        community.pair = tokenInfo.pair;
    }

    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    let result = await getTokenOnchainInfo(tweets.map(t => t.token ?? ''))

    for (let tweet of tweets) {
        if (!tweet.token) continue
        const tokenInfo = result[tweet.token]
        tweet.listed = tokenInfo.listed;
        tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e8;
        tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e8;
        tweet.price = tokenInfo.price;
        tweet.marketCap = (tweet.price ?? 0) * TotalSupply;
        tweet.pair = tokenInfo.pair;
    }
    return tweets;
}

export const getTokenOnchainInfo = async (tokens: string[]) => {
    if (tokens.length === 0) return []
    tokens = _.union(tokens)
    let calls: any[] = []
    for (let token of tokens) {
        if (!isAddress(token)) continue;
        calls = calls.concat([
            {
                target: token,
                call: [
                    'bondingCurveSupply'
                ],
                returns: [
                    [token + '-bondingCurveSupply', (val: any) => BigInt(val)]
                ]
            }, {
                target: token,
                call: [
                    'listed'
                ],
                returns: [
                    [token + '-listed']
                ]
            },
            {
                target: token,
                call: [
                    'totalClaimedSocialRewards'
                ],
                returns: [
                    [token + '-totalClaimedSocialRewards', (val: any) => BigInt(val)]
                ]
            },
            {
                target: token,
                call: [
                    'getBuyPrice',
                    '100000000'
                ],
                returns: [
                    [token + '-price', (val: any) => (val).toString() / 1e8]
                ]
            },
            {
                target: uniswapV2Factory,
                call: [
                    'getPair',
                    token,
                    WETH
                ],
                returns: [
                    [token + '-pair']
                ]
            }
        ])
    }

    const res = await aggregate(calls)
    let infos = res
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
        if (info.listed) {
            calls.push({
                target: info.pair,
                call: [
                    'getReserves'
                ],
                returns: [
                    [token + '-1', (val: any) => (val).toString() / 1e8],
                    [token + '-2', (val: any) => (val).toString() / 1e8]
                ]
            })
            calls.push({
                target: info.pair,
                call: [
                    'getToken0',
                ],
                returns: [
                    [token + '-token0']
                ]
            })
        }
    }
    if (calls.length > 0) {
        let res = await aggregate(calls);
        for (let [key, value] of Object.entries(result)) {
            // @ts-ignore
            if (value.listed) {
                if (res[key + '-token0'] === key) {
                    result[key].price = res[key + '-2'] / res[key + '-1']
                } else {
                    result[key].price = res[key + '-1'] / res[key + '-2']
                }
            }
        }
    }

    return result
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getBuyAmountByValue(amount * 9800n / 10000n);
    return BigInt(receive.toString(10))
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getSellPriceAfterFee(amount);
    return BigInt(receive.toString(10))
}

export const getTokenCap = async (communities: Community[]) => {
    if (communities.length == 0) return [];
    let calls = communities.map(com => ({
        target: com.token,
        call: [
            'getBuyPrice',
            '10000000000'
        ],
        returns: [
            [com.tick, (val: any) => BigInt(val)] as [string, Function | undefined]
        ]
    }))

    const res = await aggregate(calls)
    const prices = res
    for (let com of communities) {
        // @ts-ignore
        com.marketCap = (prices[com.tick] * BigInt(TotalSupply)).toString() / 1e8
    }
    return communities
}

export const getBuyAmountUseEth = async (token: string, ethAmount: BigInt) => {
    let contract = await getContract('UniswapRouter', undefined, true);
    const amount = await contract.getAmountsOut(ethAmount, [WETH, token]);
    return amount[1];
}

export const getSellAmountUseToken = async (token: string, tokenAmount: BigInt) => {
    let contract = await getContract('UniswapRouter', undefined, true);
    const amount = await contract.getAmountsOut(tokenAmount, [token, WETH]);
    return amount[1];
}