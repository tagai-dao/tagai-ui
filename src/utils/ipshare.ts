import { ChainConfig } from "@/config";
import { IPShareContract3 } from "@/config";
import { aggregate } from '@makerdao/multicall'
import _ from 'lodash'
import { isAddress } from "viem";
import { readContract, writeContract } from "./contract";
import errCode from "@/errCode";
import { useAccountStore } from "@/stores/web3";

// ethAddr?: string;
//   shareSupply?: bigint | string | number;
//   created?: boolean,
//   price?: number;
//   formatPrice?: string;
//   holdersCount?: number;
//   holdingsCount?: number;
//   stakedCount?: number,
//   feeAmount?: number | bigint | string,
//   totalCaptured?: string | bigint | number,
//   totalStaked?: string | bigint | number,
//   createTime?: number;
//   holders?: Array<IPShareHolder>;

export const create = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) return;
    const hash = await writeContract({
        contractName: 'IPShare3',
        functionName: 'createShare',
        args: [ethAddr]
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash;
}

// ethAddr?: string;
// shareSupply?: bigint | string | number;
// created?: boolean,
// price?: number;
// formatPrice?: string;
// holdersCount?: number;
// holdingsCount?: number;
// stakedCount?: number,
// feeAmount?: number | bigint | string,
// totalCaptured?: string | bigint | number,
// totalStaked?: string | bigint | number,
// createTime?: number;
// holders?: Array<IPShareHolder>;
export const getIPShareSupply = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }

    let calls = [{
        target: IPShareContract3,
        call: [
            'ipshareSupply(address)(uint256)',
            ethAddr
        ],
        returns: [
            ['supply', (val: any) => val / 1e18]
        ]
    }]
    const res = await aggregate(calls, ChainConfig.multiConfig);
    return res.results.transformed.supply;
}

export const ipshareCreated = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }
    let calls = [{
        target: IPShareContract3,
        call: [
                'ipshareCreated(address)(bool)',
                ethAddr
            ],
            returns: [
                ['created']
            ]
        }]
        const res = await aggregate(calls, ChainConfig.multiConfig);
    return res.results.transformed.created;
}

export const calculateIPsharePriceLocal = (supply: number | string | undefined) => {
    supply = parseFloat(supply?.toString() ?? '0')
    return supply * supply / 100000;
}

// ======================== 交易功能 ========================

/**
 * 买入 IPShare
 * @param subject IPShare 主体地址
 * @param buyer 买家地址
 * @param amount IPShare 数量 (人类可读)
 * @param ethAmount 需要支付的 ETH 数量
 * @returns 交易哈希
 */
export const buyShares = async (
    subject: string,
    buyer: string,
    amount: number,
    ethAmount: number
): Promise<string> => {
    if (!isAddress(subject) || !isAddress(buyer)) {
        throw new Error('Invalid address');
    }

    try {
        // 应用 2% 滑点保护
        const amountWithSlippage = amount * 0.98;
        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'buyShares',
            args: [subject, buyer, BigInt(Math.floor(amountWithSlippage * 1e18))],
            value: BigInt(Math.floor(ethAmount * 1e18))
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('buy shares fail:', e);
        throw e;
    }
}

/**
 * 卖出 IPShare
 * @param subject IPShare 主体地址
 * @param amount IPShare 数量 (人类可读)
 * @param expectReceive 期望收到的 ETH 数量 (人类可读)
 * @returns 交易哈希
 */
export const sellShares = async (
    subject: string,
    amount: number | string,
    expectReceive: number | string
): Promise<string> => {
    if (!isAddress(subject)) {
        throw new Error('Invalid subject address');
    }

    try {
        const amountBigInt = BigInt(Math.floor(parseFloat(amount.toString()) * 1e18));
        const expectReceiveBigInt = BigInt(Math.floor(parseFloat(expectReceive.toString()) * 1e18));

        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'sellShares',
            args: [subject, amountBigInt, expectReceiveBigInt]
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('sell shares fail:', e);
        throw e;
    }
}

// ======================== 质押功能 ========================

/**
 * 质押 IPShare
 * @param subject IPShare 主体地址
 * @param amount 质押数量 (人类可读)
 * @param isMax 是否质押全部
 * @returns 交易哈希
 */
export const stake = async (
    subject: string,
    amount: number | string,
    isMax: boolean = false
): Promise<string> => {
    if (!isAddress(subject)) {
        throw new Error('Invalid subject address');
    }

    try {
        let amountBigInt = BigInt(Math.floor(parseFloat(amount.toString()) * 1e18));

        if (isMax) {
            // 如果是质押全部,查询当前持有量
            amountBigInt = await readContract('IPShare3', 'ipshareBalance', [
                subject,
                // @ts-ignore - 从 store 获取用户地址
                useAccountStore().ethConnectAddress
            ]) as bigint;
        }

        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'stake',
            args: [subject, amountBigInt]
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('stake shares fail:', e);
        throw e;
    }
}

/**
 * 解除质押 IPShare
 * @param subject IPShare 主体地址
 * @param amount 解除质押数量 (人类可读)
 * @param isMax 是否解除全部质押
 * @returns 交易哈希
 */
export const unstake = async (
    subject: string,
    amount: number | string,
    isMax: boolean = false
): Promise<string> => {
    if (!isAddress(subject)) {
        throw new Error('Invalid subject address');
    }

    try {
        let amountBigInt = BigInt(Math.floor(parseFloat(amount.toString()) * 1e18));

        if (isMax) {
            // 如果是解除全部质押,查询当前质押信息
            const stakeInfo = await readContract('IPShare3', 'getStakerInfo', [
                subject,
                // @ts-ignore
                useAccountStore().ethConnectAddress
            ]) as any[];
            amountBigInt = stakeInfo[1]; // stakeInfo[1] 是质押数量
        }

        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'unstake',
            args: [subject, amountBigInt]
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('unstake shares fail:', e);
        throw e;
    }
}

/**
 * 赎回已解除质押的 IPShare
 * @param subject IPShare 主体地址
 * @returns 交易哈希
 */
export const redeem = async (subject: string): Promise<string> => {
    if (!isAddress(subject)) {
        throw new Error('Invalid subject address');
    }

    try {
        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'redeem',
            args: [subject]
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('redeem fail:', e);
        throw e;
    }
}

/**
 * 领取质押收益
 * @param subject IPShare 主体地址
 * @returns 交易哈希
 */
export const claim = async (subject: string): Promise<string> => {
    if (!isAddress(subject)) {
        throw new Error('Invalid subject address');
    }

    try {
        const hash = await writeContract({
            contractName: 'IPShare3',
            functionName: 'claim',
            args: [subject]
        });

        if (!hash) {
            throw errCode.TRANSACTION_INVALID;
        }
        return hash;
    } catch (e) {
        console.log('claim fail:', e);
        throw e;
    }
}

// ======================== 计算函数 ========================

/**
 * 计算购买指定数量 IPShare 需要的 ETH (本地计算,包含手续费)
 * @param supply 当前供应量
 * @param amount 购买数量
 * @returns 需要的 ETH 数量
 */
export const calculateEthNeedToBuyIPshares = (supply: number, amount: number): number => {
    const price = (amount *
        (amount ** 2 + 3 * amount * supply + 3 * (supply ** 2))) / 300000;
    return price / 0.93; // 手续费调整 (7% 手续费)
}

/**
 * 计算指定 ETH 可以购买的 IPShare 数量 (本地计算)
 * @param supply 当前供应量
 * @param ethAmount ETH 数量
 * @returns IPShare 数量
 */
export const calculateIPshareObtainLocal = (supply: number, ethAmount: number): number => {
    supply = parseFloat(supply?.toString() ?? '0');
    ethAmount = parseFloat(ethAmount?.toString() ?? '0');
    return Math.cbrt(ethAmount * 100000 * 3 + supply ** 3) - supply;
}

/**
 * 计算卖出指定数量 IPShare 可以获得的 ETH (本地计算,包含手续费)
 * @param supply 当前供应量
 * @param sellAmount 卖出数量
 * @returns 可获得的 ETH 数量
 */
export const calculateEthReceivedWhenSellIPshare = (supply: number, sellAmount: number): number => {
    supply = supply - sellAmount;
    let price = (sellAmount *
        (sellAmount ** 2 + 3 * sellAmount * supply + 3 * (supply ** 2))) / 300000;
    return price * 0.93; // 手续费调整 (7% 手续费)
}

/**
 * 计算 IPShare 的 CC (Content Credits)
 * @param supply 供应量
 * @returns CC 值
 */
export const calculateIPShareCC = (supply: number): number => {
    supply = parseFloat(supply?.toString() ?? '0');
    return supply ** 3 * 0.012875;
}