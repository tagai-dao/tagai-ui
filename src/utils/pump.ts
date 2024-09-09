import { getContract } from "./contract";
import type { Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply } from "@/config";
import { getReadOnlyProvider, getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract, Ether, ClaimFee } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { getPair } from "./web3";
import { useAccountStore } from "@/stores/web3";

export const checkTickUsed = async (tick: string) => {
    const pump = await getContract('Pump', undefined, true)
    const created = await pump.createdTicks(tick)
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump')
    let tx: any = await pump.createToken(createParms.tick, {
        value: (createParms.initEth ?? 0n) + BigInt(CreateFee)
    })

    await tx.wait();
    // tx: any = await getTransactionReceipt(hash);
    const hash = tx.hash;
    tx = await getTransactionReceipt(hash)
    const event: any = getCreateTokenEventByHash(tx);
    if (event && event.length == 3 && event[0] == createParms.tick) {
        return {token: event[1], createHash: tx.hash}
    }
    return {createHash: hash}
}

export const buyToken = async (token: string, amount: bigint, ethAmount: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    if (listed) {
        const router = await getContract('UniswapRouter');
        const tx = await router.swapExactETHForTokens(
            amount * BigInt(slippage) / 10000n,
            [WETH, token],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300,
            {
                value: ethAmount
            }
        )
        
        await tx.wait();
        return tx.hash;
    }else {
        const tc = await getContract('Token', token)
        const tx = await tc.buyToken(amount, sellsman, slippage, ethers.ZeroAddress, {
            value: ethAmount
        })
        await tx.wait();
        return tx.hash;
    }
}

export const sellToken = async (token: string, amount: bigint, receiveEth: bigint, sellsman: ethers.AddressLike, listed: boolean, slippage = 0) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!ethers.isAddress(sellsman)) {
        sellsman = ethers.ZeroAddress;
    }
    const tc = await getContract('Token', token)
    if (listed) {
        // checkout approve
        const allowance = await tc.allowance(useAccountStore().ethConnectAddress, uniswapV2Router02);
        if (allowance < amount) {
            const res = await tc.approve(uniswapV2Router02, ethers.MaxInt256);
            await res.wait();
        }
        const router = await getContract('UniswapRouter');
        const tx = await router.swapExactTokensForETH(
            amount,
            receiveEth * BigInt(slippage) / 10000n,
            [token, WETH],
            useAccountStore().ethConnectAddress,
            Math.floor(Date.now() / 1000) + 300
        )
        await tx.wait();
        return tx.hash;
    }else {
        const tx = await tc.sellToken(amount, receiveEth, sellsman, slippage);
        await tx.wait();
        return tx.hash;
    }
}

export const claimReward = async (token: string, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!ethers.isAddress(token)) throw errCode.PARAMS_ERROR;
    console.log(3, token, orderId, amount, signature)
    const tc = await getContract('Token', token)
    const tx = await tc.userClaim(token, orderId, amount, signature, {
        value: ClaimFee
    });
    await tx.wait();
    return tx.hash;
}

export const calculateInitEth = (amount: bigint) => {
    amount = amount / 100n;
    const price = amount * amount * amount / BigInt(3e36) / (ethers.parseEther('0.00381'))
    return price * 10000n / (10000n - 100n - 100n);
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
                ['balance', (val: any) => val.toString() / 1e18]
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

export const getTokenInfo = async (communities: Community[]) => {
    if (communities.length === 0) return communities;
    let result = await getTokenOnchainInfo(communities.map(com => com.token))
    
    for( let community of communities) {
        const tokenInfo = result[community.token]
        community.listed = tokenInfo.listed;
        community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        community.price = tokenInfo.price;
        community.marketCap = (community.price ?? 0) * TotalSupply;
        community.pair = tokenInfo.pair;
    }
    
    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    let result = await getTokenOnchainInfo(tweets.map(t => t.token ?? ''))
    
    for( let tweet of tweets) {
        if (!tweet.token) continue
        const tokenInfo = result[tweet.token]
        tweet.listed = tokenInfo.listed;
        tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
        tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
        tweet.price = tokenInfo.price;
        tweet.marketCap = (tweet.price ?? 0) * TotalSupply;
        tweet.pair = tokenInfo.pair;
    }
    return tweets;
}

export const getTokenOnchainInfo = async (tokens: String[]) => {
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
                    [token + '-price', (val: any) => (val).toString() / 1e18]
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
            }
        }
    }
    
    return result
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getBuyAmountByValue(amount * 9800n / 10000n);
    return receive
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getSellPriceAfterFee(amount);
    return receive
}

export const calculateCapticalLocal = async (supply: number) => {
    return supply * supply * 10000000000 / (11.43333333 * 1e18)
}

export const getTokenCap = async (communities: Community[]) => {
    if (communities.length == 0) return [];
    let calls = communities.map(com => ({
        target: com.token,
        call: [
            'getBuyPrice(uint256)(uint256)',
            '100000000000000000000'
        ],
        returns: [
            [com.tick, (val: any) => BigInt(val)]
        ]
    }))

    const res = await aggregate(calls, ChainConfig.multiConfig)
    const prices = res.results.transformed
    for(let com of communities) {
        // @ts-ignore
        com.marketCap = (prices[com.tick] * BigInt(TotalSupply)).toString() / 1e18
    }
    return communities
}

const getCreateTokenEventByHash = (tx: any) => {
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