import { getContract } from "./contract";
import { type CreateCommunity } from "@/types";
import { CreateFee } from "@/config";
import { getReadOnlyProvider, getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract, Ether } from "@/config";
import { abis } from './abis'
import { createHash } from "crypto";

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

export const calculateInitBtc = (amount: bigint) => {
    const price = amount * amount * amount / BigInt(3e36) / (320n * Ether)
    return price * 10000n / (10000n - 100n - 100n);
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