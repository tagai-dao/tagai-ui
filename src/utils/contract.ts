import { getProvider, setup } from "./wallets";
import { abis } from './abis'
import { ethers } from 'ethers'
import { getReadOnlyProvider } from "./web3";
import { PumpContract1, IPShareContract1, uniswapV2Router02, PumpContract2, PumpContract3, PumpContract4, IPShareContract2, wrappedUniswapV2ForTagAI } from '@/config'

const ContractAddress = {
    Pump1: PumpContract1,
    Pump2: PumpContract2,
    Pump3: PumpContract3,
    Pump4: PumpContract4,
    IPShare1: IPShareContract1,
    IPShare2: IPShareContract2,
    UniswapRouter: uniswapV2Router02,
    WrapSwaper: wrappedUniswapV2ForTagAI
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