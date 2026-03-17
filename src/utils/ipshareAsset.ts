/**
 * IPShare 资产查询工具
 * 用于批量查询 IPShare 的持有量、质押量、收益等信息
 */

import { aggregate } from '@makerdao/multicall'
import { IPShareContract3, ChainConfig } from '@/config'
import { isAddress } from 'viem'
import { useAccountStore, useIpshareData } from '@/stores/web3'

/**
 * 去重数组
 */
const uniqueArray = <T>(arr: T[]): T[] => {
    return Array.from(new Set(arr));
}

// ======================== IPShare 批量查询 ========================

/**
 * 批量查询 IPShare 供应量
 * @param subjects IPShare 主体地址数组
 * @returns 供应量映射 { address: supply }
 */
export const getIPshareSupplies = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) {
            console.log('No valid addresses to query IPShare supplies');
            return {};
        }

        const calls = subjects.map(s => ({
            target: IPShareContract3,
            call: [
                'ipshareSupply(address)(uint256)',
                s
            ],
            returns: [
                [s, (val: any) => {
                    const supply = parseFloat(val.toString()) / 1e18;
                    return isNaN(supply) ? 0 : supply;
                }]
            ]
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        const result = res.results?.transformed || {};
        console.log('IPShare supplies fetched:', result);
        
        // 保存到 store（参考 Donut 实现）
        const ipshareStore = useIpshareData();
        const currentSupplies = ipshareStore.ipshareSupplies;
        const mergedSupplies = {
            ...currentSupplies,
            ...result
        };
        ipshareStore.saveIPshareSupplies(mergedSupplies);
        
        return result;
    } catch (e) {
        console.error('Get IPShare supplies fail:', e);
        return {};
    }
}

/**
 * 批量查询用户的 IPShare 持有量
 * @param subjects IPShare 主体地址数组
 * @returns 持有量映射 { address: balance }
 */
export const getIPshareBalances = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const accountStore = useAccountStore();
        // 优先使用连接的钱包地址，如果没有则使用账户绑定的地址
        let address: string | undefined = accountStore.ethConnectAddress;
        if (!address || !isAddress(address)) {
            address = accountStore.getAccountInfo?.ethAddr || undefined;
        }
        if (!address || !isAddress(address)) {
            console.log('Get IPShare balances: No valid address found');
            return {};
        }

        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) return {};

        const calls = subjects.map(s => ({
            target: IPShareContract3,
            call: [
                'ipshareBalance(address,address)(uint256)',
                s,
                address
            ],
            returns: [
                [s, (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        const result = res.results.transformed || {};
        console.log('IPShare balances fetched:', address, result);
        
        // 保存到 store（参考 Donut 实现）
        const ipshareStore = useIpshareData();
        const currentBalances = ipshareStore.ipshareBalances;
        const mergedBalances = {
            ...currentBalances,
            ...result
        };
        ipshareStore.saveIPshareBalances(mergedBalances);
        
        return result;
    } catch (e) {
        console.log('Get user IPShare balances fail:', e);
        return {};
    }
}

/**
 * 质押信息类型
 */
export interface StakeInfo {
    address: string;
    amount: number;        // 质押数量
    redeemAmount: number;  // 可赎回数量
    unlockTime: number;    // 解锁时间
    debts: number;         // 债务
    profit: number;        // 累计收益
}

/**
 * 批量查询用户的 IPShare 质押信息
 * @param subjects IPShare 主体地址数组
 * @returns 质押信息映射 { address: StakeInfo }
 */
export const getIPshareStaked = async (subjects: string[]): Promise<Record<string, StakeInfo>> => {
    try {
        const accountStore = useAccountStore();
        // 优先使用连接的钱包地址，如果没有则使用账户绑定的地址
        let address: string | undefined = accountStore.ethConnectAddress;
        if (!address || !isAddress(address)) {
            address = accountStore.getAccountInfo?.ethAddr || undefined;
        }
        if (!address || !isAddress(address)) {
            console.log('Get IPShare staked: No valid address found');
            return {};
        }

        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) return {};

        const calls = subjects.map(s => ({
            target: IPShareContract3,
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
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        const stakeData = res.results.transformed;

        // 重组数据结构
        const stakeInfos: Record<string, StakeInfo> = {};
        for (let key in stakeData) {
            const [id, type] = key.split('-');
            if (!stakeInfos[id]) {
                stakeInfos[id] = {} as StakeInfo;
            }
            // @ts-ignore
            stakeInfos[id][type] = stakeData[key];
        }

        // 保存到 store（参考 Donut 实现）
        const ipshareStore = useIpshareData();
        const currentStakeInfos = ipshareStore.stakeInfos;
        const mergedStakeInfos = {
            ...currentStakeInfos,
            ...stakeInfos
        };
        ipshareStore.saveStakeInfos(mergedStakeInfos);

        return stakeInfos;
    } catch (e) {
        console.log('Get IPShare staked fail:', e);
        return {};
    }
}

/**
 * 批量查询 IPShare 的总质押量
 * @param subjects IPShare 主体地址数组
 * @returns 总质押量映射 { address: totalStaked }
 */
export const getTotalStakedIPshares = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) return {};

        const calls = subjects.map(s => ({
            target: IPShareContract3,
            call: [
                'totalStakedIPshare(address)(uint256)',
                s
            ],
            returns: [
                [s, (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        const result = res.results.transformed || {};
        
        // 保存到 store（参考 Donut 实现）
        const ipshareStore = useIpshareData();
        const currentTotalStaked = ipshareStore.totalStakedIPshares;
        const mergedTotalStaked = {
            ...currentTotalStaked,
            ...result
        };
        ipshareStore.saveTotalStakedIPshares(mergedTotalStaked);
        
        return result;
    } catch (e) {
        console.log('Get total staked IPShares fail:', e);
        return {};
    }
}

/**
 * 批量查询用户的待领取 IPShare 收益
 * @param subjects IPShare 主体地址数组
 * @returns 待领取收益映射 { address: pendingProfit }
 */
export const getPendingIPshareProfits = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        const address = useAccountStore().ethConnectAddress;
        if (!isAddress(address)) {
            return {};
        }

        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) return {};

        const calls = subjects.map(s => ({
            target: IPShareContract3,
            call: [
                'getPendingProfits(address,address)(uint256)',
                s,
                address
            ],
            returns: [
                [s, (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        return res.results.transformed;
    } catch (e) {
        console.log('Get pending IPShare profits fail:', e);
        return {};
    }
}

/**
 * 查询单个 IPShare 的待领取收益
 * @param subject IPShare 主体地址
 * @returns 待领取收益
 */
export const getPendingProfits = async (subject: string): Promise<number> => {
    try {
        const address = useAccountStore().ethConnectAddress;
        if (!isAddress(address) || !isAddress(subject)) {
            return 0;
        }

        const call = [{
            target: IPShareContract3,
            call: [
                'getPendingProfits(address,address)(uint256)',
                subject,
                address
            ],
            returns: [
                ['profits', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }];

        const res = await aggregate(call, ChainConfig.multiConfig);
        return res.results.transformed.profits;
    } catch (e) {
        console.log('getPendingProfits fail', e);
        return 0;
    }
}

/**
 * 批量查询 IPShare 的 Key Fund Ratio (密钥基金比例)
 * @param subjects IPShare 主体地址数组
 * @returns 比例映射 { address: ratio }
 */
export const getKeyFundRatios = async (subjects: string[]): Promise<Record<string, number>> => {
    try {
        subjects = uniqueArray(subjects).filter(s => isAddress(s));
        if (subjects.length === 0) return {};

        const calls = subjects.map(s => ({
            target: IPShareContract3,
            call: [
                'keyFundRatio(address)(uint256)',
                s
            ],
            returns: [
                [s, (val: any) => parseInt(val.toString())]
            ]
        }));

        const res = await aggregate(calls, ChainConfig.multiConfig);
        return res.results.transformed;
    } catch (e) {
        console.log('Get key fund ratios fail:', e);
        return {};
    }
}

/**
 * 查询最大质押者
 * @param subject IPShare 主体地址
 * @returns { staker: 地址, amount: 质押量 }
 */
export const getMaxStaker = async (subject: string): Promise<{ staker: string; amount: number }> => {
    try {
        if (!isAddress(subject)) {
            return { staker: '', amount: 0 };
        }

        const call = [{
            target: IPShareContract3,
            call: [
                'getMaxStaker(address)(address,uint256)',
                subject
            ],
            returns: [
                ['staker'],
                ['amount', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }];

        const res = await aggregate(call, ChainConfig.multiConfig);
        return res.results.transformed as { staker: string; amount: number };
    } catch (e) {
        console.log('getMaxStaker fail', e);
        return { staker: '', amount: 0 };
    }
}

// ======================== 价格查询 (链上) ========================

/**
 * 查询购买指定数量 IPShare 的实际价格 (含手续费,链上查询)
 * @param subject IPShare 主体地址
 * @param amount IPShare 数量
 * @returns ETH 价格
 */
export const getBuyPriceAfterFee = async (subject: string, amount: number): Promise<number> => {
    try {
        if (!isAddress(subject)) {
            return 0;
        }

        const call = [{
            target: IPShareContract3,
            call: [
                'getBuyPriceAfterFee(address,uint256)(uint256)',
                subject,
                BigInt(Math.floor(amount * 1e18))
            ],
            returns: [
                ['price', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }];

        const res = await aggregate(call, ChainConfig.multiConfig);
        return res.results.transformed.price;
    } catch (e) {
        console.log('getBuyPriceAfterFee fail:', e);
        return 0;
    }
}

/**
 * 查询卖出指定数量 IPShare 的实际价格 (含手续费,链上查询)
 * @param subject IPShare 主体地址
 * @param amount IPShare 数量
 * @returns ETH 价格
 */
export const getSellPriceAfterFee = async (subject: string, amount: number): Promise<number> => {
    try {
        if (!isAddress(subject)) {
            return 0;
        }

        const call = [{
            target: IPShareContract3,
            call: [
                'getSellPriceAfterFee(address,uint256)(uint256)',
                subject,
                BigInt(Math.floor(amount * 1e18))
            ],
            returns: [
                ['price', (val: any) => parseFloat(val.toString()) / 1e18]
            ]
        }];

        const res = await aggregate(call, ChainConfig.multiConfig);
        return res.results.transformed.price;
    } catch (e) {
        console.log('getSellPriceAfterFee fail:', e);
        return 0;
    }
}
