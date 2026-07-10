/**
 * IPShare 资产查询：始终走当前产品链的 IPShare + multicall（地址见 chains.ts）
 */

import { aggregate } from '@makerdao/multicall'
import { isAddress } from 'viem'
import { useAccountStore, useIpshareData } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { getChainDeployment } from '@/config/chains'

const uniqueArray = <T>(arr: T[]): T[] => Array.from(new Set(arr))

/** 当前链 IPShare 地址 + multicall 配置 */
const getActiveIpshare = () => {
    const deployment = getChainDeployment(useChainStore().activeChainId)
    return { address: deployment.contracts.ipshare3, multiConfig: deployment.multiConfig }
}

const getUserAddress = (): string | undefined => {
    const accountStore = useAccountStore()
    let address: string | undefined = accountStore.ethConnectAddress
    if (!address || !isAddress(address)) {
        address = accountStore.getAccountInfo?.ethAddr || undefined
    }
    return address && isAddress(address) ? address : undefined
}

export const getIPshareSupplies = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const ipshare = getActiveIpshare()
        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: ['ipshareSupply(address)(uint256)', s],
            returns: [[s, (val: any) => {
                const supply = parseFloat(val.toString()) / 1e18
                return isNaN(supply) ? 0 : supply
            }]]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        const result = res.results?.transformed || {}
        useIpshareData().saveIPshareSupplies({ ...useIpshareData().ipshareSupplies, ...result })
        return result
    } catch (e) {
        console.error('Get IPShare supplies fail:', e)
        return {}
    }
}

export const getIPshareBalances = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const ipshare = getActiveIpshare()
        const address = getUserAddress()
        if (!address) return {}

        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: ['ipshareBalance(address,address)(uint256)', s, address],
            returns: [[s, (val: any) => parseFloat(val.toString()) / 1e18]]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        const result = res.results.transformed || {}
        useIpshareData().saveIPshareBalances({ ...useIpshareData().ipshareBalances, ...result })
        return result
    } catch (e) {
        console.log('Get user IPShare balances fail:', e)
        return {}
    }
}

export type StakeInfo = {
    address: string
    amount: number
    redeemAmount: number
    unlockTime: number
    debts: number
    profit: number
}

export const getIPshareStaked = async (subjects: string[]): Promise<Record<string, StakeInfo>> => {
    try {
        const ipshare = getActiveIpshare()
        const address = getUserAddress()
        if (!address) return {}

        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: [
                'getStakerInfo(address,address)(address,uint256,uint256,uint256,uint256,uint256)',
                s,
                address
            ],
            returns: [
                [s + '-address'],
                [s + '-amount', (val: any) => parseFloat(val.toString()) / 1e18],
                [s + '-redeemAmount', (val: any) => parseFloat(val.toString()) / 1e18],
                [s + '-unlockTime', (val: any) => parseInt(val.toString())],
                [s + '-debts', (val: any) => parseFloat(val.toString()) / 1e18],
                [s + '-profit', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        const stakeData = res.results.transformed
        const stakeInfos: Record<string, StakeInfo> = {}
        for (let key in stakeData) {
            const [id, type] = key.split('-')
            if (!stakeInfos[id]) stakeInfos[id] = {} as StakeInfo
            // @ts-ignore
            stakeInfos[id][type] = stakeData[key]
        }
        useIpshareData().saveStakeInfos({ ...useIpshareData().stakeInfos, ...stakeInfos })
        return stakeInfos
    } catch (e) {
        console.log('Get IPShare staked fail:', e)
        return {}
    }
}

export const getTotalStakedIPshares = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const ipshare = getActiveIpshare()
        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: ['totalStakedIPshare(address)(uint256)', s],
            returns: [[s, (val: any) => parseFloat(val.toString()) / 1e18]]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        const result = res.results.transformed || {}
        useIpshareData().saveTotalStakedIPshares({ ...useIpshareData().totalStakedIPshares, ...result })
        return result
    } catch (e) {
        console.log('Get total staked IPShares fail:', e)
        return {}
    }
}

export const getPendingIPshareProfits = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const ipshare = getActiveIpshare()
        const address = useAccountStore().ethConnectAddress
        if (!isAddress(address)) return {}

        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: ['getPendingProfits(address,address)(uint256)', s, address],
            returns: [[s, (val: any) => parseFloat(val.toString()) / 1e18]]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        return res.results.transformed
    } catch (e) {
        console.log('Get pending IPShare profits fail:', e)
        return {}
    }
}

export const getPendingProfits = async (subject: string): Promise<number> => {
    try {
        const ipshare = getActiveIpshare()
        const address = useAccountStore().ethConnectAddress
        if (!isAddress(address) || !isAddress(subject)) return 0

        const call = [{
            target: ipshare.address,
            call: ['getPendingProfits(address,address)(uint256)', subject, address],
            returns: [['profits', (val: any) => parseFloat(val.toString()) / 1e18]]
        }]

        const res = await aggregate(call, ipshare.multiConfig)
        return res.results.transformed.profits
    } catch (e) {
        console.log('getPendingProfits fail', e)
        return 0
    }
}

export const getKeyFundRatios = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const ipshare = getActiveIpshare()
        subjects = uniqueArray(subjects).filter(s => isAddress(s))
        if (subjects.length === 0) return {}

        const calls = subjects.map(s => ({
            target: ipshare.address,
            call: ['keyFundRatio(address)(uint256)', s],
            returns: [[s, (val: any) => parseInt(val.toString())]]
        }))

        const res = await aggregate(calls, ipshare.multiConfig)
        return res.results.transformed
    } catch (e) {
        console.log('Get key fund ratios fail:', e)
        return {}
    }
}

export const getMaxStaker = async (subject: string): Promise<{ staker: string; amount: number }> => {
    try {
        if (!isAddress(subject)) return { staker: '', amount: 0 }
        const ipshare = getActiveIpshare()

        const call = [{
            target: ipshare.address,
            call: ['getMaxStaker(address)(address,uint256)', subject],
            returns: [
                ['staker'],
                ['amount', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }]

        const res = await aggregate(call, ipshare.multiConfig)
        return res.results.transformed as { staker: string; amount: number }
    } catch (e) {
        console.log('getMaxStaker fail', e)
        return { staker: '', amount: 0 }
    }
}

export const getBuyPriceAfterFee = async (subject: string, amount: number): Promise<number> => {
    try {
        if (!isAddress(subject)) return 0
        const ipshare = getActiveIpshare()

        const call = [{
            target: ipshare.address,
            call: [
                'getBuyPriceAfterFee(address,uint256)(uint256)',
                subject,
                BigInt(Math.floor(amount * 1e18))
            ],
            returns: [['price', (val: any) => parseFloat(val.toString()) / 1e18]]
        }]

        const res = await aggregate(call, ipshare.multiConfig)
        return res.results.transformed.price
    } catch (e) {
        console.log('getBuyPriceAfterFee fail:', e)
        return 0
    }
}

export const getSellPriceAfterFee = async (subject: string, amount: number): Promise<number> => {
    try {
        if (!isAddress(subject)) return 0
        const ipshare = getActiveIpshare()

        const call = [{
            target: ipshare.address,
            call: [
                'getSellPriceAfterFee(address,uint256)(uint256)',
                subject,
                BigInt(Math.floor(amount * 1e18))
            ],
            returns: [['price', (val: any) => parseFloat(val.toString()) / 1e18]]
        }]

        const res = await aggregate(call, ipshare.multiConfig)
        return res.results.transformed.price
    } catch (e) {
        console.log('getSellPriceAfterFee fail:', e)
        return 0
    }
}
