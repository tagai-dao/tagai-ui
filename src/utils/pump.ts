import { getContract } from "./contract";
import { type Community, type CreateCommunity } from "@/types";
import { CreateFee, ChainConfig } from "@/config";
import { getReadOnlyProvider, getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract, Ether } from "@/config";
import { abis } from './abis'
import { aggregate } from '@makerdao/multicall'

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

export const buyToken = async (token: string, amount: bigint) => {
    const pump = await getContract('Pump')

}

export const sellToken = async (token: string, amount: bigint) => {
    const pump = await getContract('Pump')
}

export const calculateInitBtc = (amount: bigint) => {
    const price = amount * amount * amount / BigInt(3e36) / (320n * Ether)
    return price * 10000n / (10000n - 100n - 100n);
}

export const getTokenInfo = async (token: string) => {
    if (!ethers.isAddress(token)) return;
    let calls = [
        {
            target: token,
            call: [
                'bondingCurveSupply()(uint256)'
            ],
            returns: [
                ['bondingCurveSupply']
            ]
        },{
            target: token,
            call: [
                'listed()(bool)'
            ],
            returns: [
                ['listed']
            ]
        }
    ]
    const res = await aggregate(calls, ChainConfig.multiConfig)
    return res.results.transformed
}

export const getBuyAmountWithBTCAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getBuyAmountByValue(amount);
    return receive
}

export const getReceivedAmountSellBTCAfterFee = async (token: string | undefined, amount: bigint) => {
    if (!token) return 0n
    const tc = await getContract('Token', token, true);
    const receive = await tc.getSellPriceAfterFee(amount);
    return receive
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