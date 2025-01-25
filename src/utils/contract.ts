import { PumpContract, IPShareContract, uniswapV2Router02 } from '@/config'
import { Contract, initializeProvider } from "./nuls";

const ContractAddress = {
    Pump: PumpContract,
    IPShare: IPShareContract,
    UniswapRouter: uniswapV2Router02
}

export const getContract = async (contractName: string, address?: string, readOnly = false): Promise<any> => {
    await initializeProvider()

    if (!address) {
        // @ts-ignore
        address = ContractAddress[contractName]
    }
    const contract = new Contract(address!);
    
    return contract
}