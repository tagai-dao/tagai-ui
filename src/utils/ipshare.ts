import { ChainConfig } from "@/config";
import { IPShareContract1, IPShareContract2 } from "@/config";
import { aggregate } from '@makerdao/multicall'
import _ from 'lodash'
import { isAddress } from "viem";
import { readContract, writeContract } from "./contract";
import errCode from "@/errCode";

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
        contractName: 'IPShare2',
        functionName: 'createShare',
        args: [ethAddr]
    })
    if (!hash) {
        throw errCode.TRANSACTION_INVALID;
    }
    return hash;
}

export const getIPShareInfo = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }
    let calls = [{
        target: IPShareContract1,
        call: [
            ''
        ]
    }]
}

export const ipshareCreated = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }
    let calls = [{
        target: IPShareContract2,
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