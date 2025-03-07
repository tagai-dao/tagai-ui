import { getProvider, setup } from "./wallets";
import { abis } from './abis'
import { ethers } from 'ethers'
import { getReadOnlyProvider } from "./web3";
import { PumpContract1, IPShareContract, uniswapV2Router02, PumpContract2 } from '@/config'

const ContractAddress = {
    Pump1: PumpContract1,
    Pump2: PumpContract2,
    IPShare: IPShareContract,
    UniswapRouter: uniswapV2Router02
}

export const getContract = async (contractName: string, address?: string, readOnly = false): Promise<any> => {
    let provider = getProvider();
    if (!readOnly) {
        await setup()
    }
    // @ts-ignore
    const abi = abis[contractName]

    if (readOnly) {
        provider = getReadOnlyProvider()
    } else {
        provider = new ethers.BrowserProvider(provider)
    }

    if (!provider || !abi) {
        throw 'no provider'
    }

    if (!address) {
        // @ts-ignore
        address = ContractAddress[contractName]
    }
    const contract = new ethers.Contract(address!, abi, provider);
    if (!readOnly) {
        return contract.connect(await provider.getSigner())
    }
    return contract
}