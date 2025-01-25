import { getContract } from "./contract";
import { ChainConfig } from "@/config";
import { isAddress } from "nuls-api-v2"
import { nulsapi } from "./nuls"
import { IPShareContract } from "@/config";
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
    if (!isAddress(ethAddr)) return;
    const contract = await getContract('IPShare');
    const txHash = await contract.createShare(ethAddr);
    await nulsapi.waitingResult(txHash);
    return txHash;
}

export const getIPShareInfo = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }
    let calls = [{
        target: IPShareContract,
        call: [
            ''
        ]
    }]
}

export const ipshareCreated = async (ethAddr: string) => {
    if (!isAddress(ethAddr)) {
        return {}
    }
    const contract = await getContract('IPShare');
    const res = await contract.ipshareCreated(ethAddr);
    return res
}