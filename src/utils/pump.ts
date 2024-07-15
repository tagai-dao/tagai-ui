import { getContract } from "./contract";
import { type CreateCommunity } from "@/types";
import { CreateFee } from "@/config";

export const createCoin = async (createParms: CreateCommunity) => {
    const pump = await getContract('Pump')
    const tx = await pump.createToken(createParms.tick, {
        value: (createParms.initAmount ? createParms.initAmount : 0n) + BigInt(CreateFee)
    })
    await tx.await;
    return tx.hash
}