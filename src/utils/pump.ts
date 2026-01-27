import type { Community, CreateCommunity, OnchainTokenInfo, Tweet } from "@/types";
import { CreateFee, ChainConfig, WETH, uniswapV2Factory, uniswapV2Router02, TotalSupply, IPShareContract1, IPShareContract2, wrappedUniswapV2ForTagAI, PumpContract5, AIDeployer, wrappedUniswapV2ForTagAI2 } from "@/config";
import { getTokenBalance, getTransactionReceipt } from "./web3";
import { PumpContract1, PumpContract2, PumpContract3, PumpContract4, PumpContract6, Ether, ClaimFee, USD_CONTRACTS } from "@/config";
import { abis } from './abis'
import { getEthPrice } from "@/apis/api";
import { aggregate } from '@makerdao/multicall'
import errCode from "@/errCode";
import _ from 'lodash'
import { useStateStore } from "@/stores/common";
import { getTradeSignature, isTokenExist } from "@/apis/api";
import { useAccountStore } from "@/stores/web3";
import { isAddress, zeroAddress, maxUint256, parseEventLogs, checksumAddress, type Log } from "viem";
import { writeContract, readContract } from "./contract";

const pumpContract = [
    PumpContract1,
    PumpContract2,
    PumpContract3,
    PumpContract4,
    PumpContract5,
    PumpContract6
]

export const checkTickUsed = async (tick: string) => {
    const created = await isTokenExist(tick);
    return created
}

export const createCoin = async (createParms: CreateCommunity) => {
    let hash = await writeContract({
        contractName: 'Pump4',
        functionName: 'createToken',
        args: [createParms.tick],
        value: (createParms.initEth ?? 0n) + BigInt(CreateFee)
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }    
    let tx = await getTransactionReceipt(hash as `0x${string}`)
    const event: any = getCreateTokenEventByHash(tx, 2);
    if (event?.tick == createParms.tick) {
        return {token: event.token, createHash: tx.transactionHash}
    }
    return {createHash: hash}
}

export const buyToken = async (token: string, version: number, amount: bigint, ethAmount: bigint, sellsman: `0x${string}` | undefined | null, listed: boolean, isImport: boolean, slippage = 0) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!sellsman || !isAddress(sellsman)) {
        sellsman = zeroAddress;
    }
    if (listed) {
        // 2% transaction fee
        const amountOut = await getBuyAmountUseEth(token, ethAmount * 9800n / 10000n);

        if (isImport) {
            const hash = await writeContract({
                contractName: 'WrapSwaper2',
                functionName: 'buyToken',
                args: [sellsman, 
                    amountOut * BigInt(10000 - slippage) / 10000n, 
                    [WETH, token], 
                    useAccountStore().ethConnectAddress, 
                    Math.floor(Date.now() / 1000) + 300, 
                    uniswapV2Router02],
                value: ethAmount
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else {
            const hash = await writeContract({
                contractName: 'WrapSwaper',
                functionName: 'buyToken',
                args: [sellsman, 
                    amountOut * BigInt(10000 - slippage) / 10000n, 
                    [WETH, token], 
                    useAccountStore().ethConnectAddress, Math.floor(Date.now() / 1000) + 300, 
                    version == 1 ? IPShareContract1 : IPShareContract2],
                value: ethAmount
            })
            if (!hash) {    
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
    }else {
        if (version == 1) {
            const hash = await writeContract({
                contractName: 'Token1',
                functionName: 'buyToken',
                args: [amount, sellsman, slippage, zeroAddress],
                value: ethAmount,
                address: token
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else if (version == 5) {
            // get trade signature
            const result: any = await getTradeSignature(useAccountStore().ethConnectAddress);
            const hash = await writeContract({
                contractName: 'Token5',
                functionName: 'buyToken',
                args: [amount, sellsman, slippage, result.signature],
                value: ethAmount,
                address: token
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }else {
            const hash = await writeContract({
                contractName: 'Token' + version,
                functionName: 'buyToken',
                args: [amount, sellsman, slippage],
                value: ethAmount,
                address: token
            })
            if (!hash) {    
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
    }
}

export const sellToken = async (token: string, version: number, amount: bigint, receiveEth: bigint, sellsman: `0x${string}` | undefined | null, listed: boolean, isImport: boolean, slippage = 0) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    if (!sellsman || !isAddress(sellsman)) {
        sellsman = zeroAddress;
    }
    if (listed) {
        if (isImport) {
            const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, wrappedUniswapV2ForTagAI2], token)
            if (allowance < amount) {
                // 安全: 只授权所需金额，避免无限授权风险
                const approvalAmount = amount * 2n; // 授权2倍所需金额，减少频繁授权
                const hash = await writeContract({
                    contractName: 'Token1',
                    functionName: 'approve',
                    args: [wrappedUniswapV2ForTagAI2, approvalAmount],
                    address: token
                })
                if (!hash) {
                    throw errCode.TRANSACTION_INVALID;
                }
            }

            const expectedReceive = await getSellAmountUseToken(token, amount);

            const hash = await writeContract({
                contractName: 'WrapSwaper2',
                functionName: 'sellToken',
                args: [amount, 
                    expectedReceive * BigInt(10000 - slippage) / 10000n, [token, WETH], 
                    useAccountStore().ethConnectAddress, 
                    Math.floor(Date.now() / 1000) + 300, 
                    sellsman, 
                    uniswapV2Router02]
            })
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
            return hash
        }
        const allowance: any = await readContract('Token1', 'allowance', [useAccountStore().ethConnectAddress, wrappedUniswapV2ForTagAI], token)
        if (allowance < amount) {
            // 安全: 只授权所需金额，避免无限授权风险
            const approvalAmount = amount * 2n; // 授权2倍所需金额，减少频繁授权
            const hash = await writeContract({
                contractName: 'Token1',
                functionName: 'approve',
                args: [wrappedUniswapV2ForTagAI, approvalAmount],
                address: token
            })
            console.log('approve hash', hash)
            if (!hash) {
                throw errCode.TRANSACTION_INVALID;
            }
        }
        const expectedReceive = await getSellAmountUseToken(token, amount);
        const hash = await writeContract({
            contractName: 'WrapSwaper',
            functionName: 'sellToken',
            args: [amount, 
                expectedReceive * BigInt(10000 - slippage) / 10000n, 
                [token, WETH], 
                useAccountStore().ethConnectAddress, 
                Math.floor(Date.now() / 1000) + 300, 
                sellsman, 
                version == 1 ? IPShareContract1 : IPShareContract2]
        })
        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash
    }else {
        const hash = await writeContract({
            contractName: 'Token1',
            functionName: 'sellToken',
            args: [amount, receiveEth, sellsman, slippage],
            address: token
        })
        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash
    }
}

export const claimReward = async (token: string, version: number, orderId: BigInt, amount: BigInt, signature: string) => {
    if (!isAddress(token)) throw errCode.PARAMS_ERROR;
    const hash = await writeContract({
        contractName: 'Pump' + version,
        functionName: 'userClaim',
        args: [token, orderId, amount, signature],
        value: (version === 1 || version === 2 || version === 3) ? '1000000000000000' : ClaimFee
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash
}

export const transferToken = async (token: string, to: string, amount: bigint, isMax: boolean) => {
    if (isMax) {
        amount = await getTokenBalance(token as `0x${string}`);
    }
    
    const hash = await writeContract({
        contractName: 'Token1',
        functionName: 'transfer',
        args: [to, amount],
        address: token as `0x${string}`
    })
    return hash;
}

export const calculateInitEth = async (amount: bigint) => {
    return await readContract('Pump1', 'getBuyPriceAfterFee', [0n, amount]) as bigint
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
    let tokens = communities.filter(com => !com.isImport).map(com => com.token)
    let versions: Record<string, number> = {}
    for (let com of communities) {
        versions[com.token!] = com.version ?? 2;
    }
    let result = await getTokenOnchainInfo(tokens, versions)

    let importResult = await getImportTokenOnchainInfo(communities.filter(com => com.isImport))

    for (let community of communities) {
        const tokenInfo = result[community.token]
        if (tokenInfo) {
            community.listed = tokenInfo.listed;
            community.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
            community.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
            community.price = tokenInfo.price;
            community.marketCap = ((community.price ?? 0) * TotalSupply);
            community.pair = tokenInfo.pair;
            community.totalSupply = TotalSupply;
        }else{
            const importInfo = importResult[community.token]
            community.listed = true;
            community.bondingCurveSupply = 0;
            community.totalClaimedSocialRewards = 0;
            community.price = importInfo.price;
            community.marketCap = (community.price ?? 0) * importInfo.totalSupply;
            community.totalSupply = importInfo.totalSupply;
        }
        // const distribution = JSON.parse(community.distribution);
        // community.distributionEnded = (community.listedDayNumber ?? 0) + 100 < getDayNumber();
        // community.distributionEnded = checkDistributionEnd(distribution);
    }

    return communities;
}

export const getTokenInfoOfTweets = async (tweets: Tweet[]) => {
    if (tweets.length === 0) return tweets;
    try {
        let tokens = tweets.filter(t => !t.isImport).map(t => t.token ?? '')
        let versions: Record<string, number> = {}
        for (let tweet of tweets) {
            versions[tweet.token!] = tweet.version ?? 2;
        }
        let result = await getTokenOnchainInfo(tokens, versions)
        let importResult = await getImportTokenOnchainInfo(tweets.filter(t => t.isImport))

        const stateStore = useStateStore();
        if (stateStore.ethPrice == 0) {
            const price: any = await getEthPrice()
            stateStore.ethPrice = parseFloat(price)
        }
        
        for( let tweet of tweets) {
            if (!tweet.token) continue
            const tokenInfo = result[tweet.token]
            if (tweet.isImport) {
                const importInfo = importResult[tweet.token]
                tweet.listed = true;
                tweet.bondingCurveSupply = 0;
                tweet.totalClaimedSocialRewards = 0;
                tweet.price = importInfo.byUSD ? importInfo.price / stateStore.ethPrice : importInfo.price;
                tweet.marketCap = importInfo.price * importInfo.totalSupply;
                tweet.totalSupply = importInfo.totalSupply;
            }else {
                tweet.listed = tokenInfo.listed;
                tweet.bondingCurveSupply = tokenInfo.bondingCurveSupply.toString() / 1e18;
                tweet.totalClaimedSocialRewards = tokenInfo.totalClaimedSocialRewards.toString() / 1e18;
                tweet.price = tokenInfo.byUSD ? tokenInfo.price / stateStore.ethPrice : tokenInfo.price;
                tweet.marketCap = ((tweet.price ?? 0) * TotalSupply);
                tweet.pair = tokenInfo.pair;
            }
        }
        return tweets;
    } catch (e) {
        console.log(321, e)
        return tweets;
    }
}

export const getTokenOnchainInfo = async (tokens: string[], versions: Record<string, number>) => {
    if (tokens.length === 0) return []
    tokens = _.union(tokens)
    let calls: any[] = []
    for (let token of tokens) {
        if (!isAddress(token)) continue;
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
            calls.push({
                target: info.pair,
                call: [
                    'token1()(address)',
                ],
                returns: [
                    [token + '-token1']
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

export const getImportTokenOnchainInfo = async (communities: OnchainTokenInfo[]) => {
    if (communities.length === 0) return []
    let calls: any[] = []
    for (let i = 0; i < communities.length; i++) {
        const community = communities[i]
        if (community.dexVersion != 2) continue;
        let token = community.token
        let pair = community.pair
        if (!isAddress(token)) continue;
        calls.push({
            target: token,
            call: [
                'totalSupply()(uint256)'
            ],
            returns: [
                [token + '-totalSupply', (val: any) => (val).toString() / 1e18]
            ]
        })
        calls.push({
            target: token,
            call: [
                'symbol()(string)'
            ],
            returns: [
                [token + '-symbol']
            ]
        })
        calls.push({
            target: token,
            call: [
                'decimals()(uint8)'
            ],
            returns: [
                [token + '-decimals']
            ]
        })
        calls.push({
            target: pair,
            call: [
                'getReserves()(uint256, uint256)'
            ],
            returns: [
                [token + '-1', (val: any) => (val).toString() / 1e18],
                [token + '-2', (val: any) => (val).toString() / 1e18]
            ]
        })
        calls.push({
            target: pair,
            call: [
                'token0()(address)',
            ],
            returns: [
                [token + '-token0']
            ]
        })
        calls.push({
            target: pair,
            call: [
                'token1()(address)',
            ],
            returns: [
                [token + '-token1']
            ]
        })
    }
    const res = await aggregate(calls, ChainConfig.multiConfig)
    let infos = res.results.transformed
    let result: any = {};
    const stateStore = useStateStore();
    if (stateStore.ethPrice == 0) {
        const price: any = await getEthPrice()
        stateStore.ethPrice = parseFloat(price)
    }
    for (let community of communities) {
        const token = community.token
        if (!result[token]) {
            result[token] = {}
        }
        if (infos[token + '-token0'].toLowerCase() === token.toLowerCase()) {
            result[token].price = infos[token + '-2'] / infos[token + '-1']
            result[token].totalSupply = infos[token + '-totalSupply']
            result[token].symbol = infos[token + '-symbol']
            result[token].decimals = infos[token + '-decimals']
            if (USD_CONTRACTS[checksumAddress(infos[token + '-token1']) as `0x${string}`]) {
                result[token].price = result[token].price / stateStore.ethPrice;
            }
        }else {
            result[token].price = infos[token + '-1'] / infos[token + '-2']
            result[token].totalSupply = infos[token + '-totalSupply']
            result[token].symbol = infos[token + '-symbol']
            result[token].decimals = infos[token + '-decimals']
            if (USD_CONTRACTS[checksumAddress(infos[token + '-token0']) as `0x${string}`]) {
                result[token].price = result[token].price / stateStore.ethPrice;
            }
        }
    }
    return result;
}

export const getBuyAmountWithETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token || !isAddress(token)) return {supply: 0n, receive: 0n}
    const supply: any = await  readContract('Token1', 'bondingCurveSupply', [], token)
    const receive: any = await readContract('Pump' + version, 'getBuyAmountByValue', [supply, amount * 9800n / 10000n])
    return {supply, receive}
}

export const getBuyPriceAfterFee = async (supply: bigint, amount: bigint) => {
    return await readContract('Pump4', 'getBuyPriceAfterFee', [supply, amount]) as bigint
}

export const getReceivedAmountSellETHAfterFee = async (token: string | undefined, version: number, amount: bigint) => {
    if (!token || !isAddress(token)) return 0n
    const supply: any = await readContract('Token1', 'bondingCurveSupply', [], token)
    const receive: any = await readContract('Pump' + version, 'getSellPriceAfterFee', [supply, amount])
    return receive
}

const getCreateTokenEventByHash = (tx: { logs: Log[] }, version: number) => {
    const logs = tx.logs;
  
    try {
      const events = parseEventLogs({
        abi: abis.Pump1,
        logs,
        // 如果你确定只关心某个合约地址：
        // strict: true,
        // args: [可选],
      });
  
      for (const event of events) {
        if ('eventName' in event && event.eventName === 'NewToken') {
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

// const getCreateTokenEventByHash = (tx: any, version: number) => {
//     let contract = new ethers.Contract(pumpContract[version - 1], abis.Pump1)
//     let event;
//     tx.logs.forEach((log: any) => {
//         try {
//             const parsedLog = contract.interface.parseLog(log);
//             if (parsedLog && parsedLog.name === 'NewToken') {
//                 event = parsedLog.args
//             }
//         } catch (error) {
//             console.error(error)
//         }
//     });
//     return event
// }

export const getBuyAmountUseEth = async (token: string, ethAmount: BigInt) => {
    const amount: any = await readContract('UniswapRouter', 'getAmountsOut', [ethAmount, [WETH, token]])
    return amount[amount.length - 1];
}

export const getSellAmountUseToken = async (token: string, tokenAmount: BigInt) => {
    const amount: any = await readContract('UniswapRouter', 'getAmountsOut', [tokenAmount, [token, WETH]]);
    return amount[amount.length - 1] * 9800n / 10000n;
}

export const getAIBalance = async (tokens: string[]) => {
    let calls: any[] = []
    for (let token of tokens) {
        calls.push({
            target: token,
            call: [
                'balanceOf(address)(uint256)',
                AIDeployer
            ],
            returns: [
                [token, (val: any) => val.toString() / 1e18]
            ]
        })
    }
    const res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed
}

export const getTokenPair = async (token: string) => {
    const pair: any = await readContract('UniswapFactory', 'getPair', [token, WETH])
    return pair
}