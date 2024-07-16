import { getContract } from "./contract";
import { type CreateCommunity } from "@/types";
import { CreateFee } from "@/config";
import { getReadOnlyProvider, getTransactionReceipt } from "./web3";
import { ethers } from 'ethers'
import { PumpContract } from "@/config";
import { abis } from './abis'

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump')
    pump.on('CreateNewToken', );
    const tx = await pump.createToken(createParms.tick, {
        value: (createParms.initAmount ? createParms.initAmount : 0n) + BigInt(CreateFee)
    })
    await tx.await();
    const event: any = getCreateTokenEventByHash(tx.hash);
    if (event && event.length == 3 && event[0] == createParms.tick) {
        return {token: event[1], createHash: tx.hash}
    }
    return {createHash: tx.hash}
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