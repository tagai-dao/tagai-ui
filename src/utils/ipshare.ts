import { ChainConfig } from "@/config";
import { IPShareContract1, IPShareContract2, IPShareContract3 } from "@/config";
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