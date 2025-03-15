import { getContract } from "./contract";
import { ChainConfig } from "@/config";
import { ethers } from 'ethers'
import { IPShareContract1, IPShareContract2 } from "@/config";
import { aggregate } from '@makerdao/multicall'
import _ from 'lodash'

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
    if (!ethers.isAddress(ethAddr)) return;
    const contract = await getContract('IPShare2');
    const tx = await contract.createShare(ethAddr);
    await tx.wait();
    return tx.hash;
}

export const getIPShareInfo = async (ethAddr: string) => {
    if (!ethers.isAddress(ethAddr)) {
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
    if (!ethers.isAddress(ethAddr)) {
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