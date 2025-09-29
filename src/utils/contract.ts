import { getReadOnlyClient, getWalletClient, setup, waitForTx } from "./wallets";
import { abis } from './abis'
import { PumpContract1, IPShareContract1, uniswapV2Router02, 
    PumpContract2, PumpContract3, PumpContract4, IPShareContract2, 
    wrappedUniswapV2ForTagAI, CoinPurse, WETH, PumpContract5, PumpContract6, wrappedUniswapV2ForTagAI2 } from '@/config'
import { useAccountStore } from "@/stores/web3";
import { customBsc } from "./privy";

const ContractAddress = {
    Pump1: PumpContract1,
    Pump2: PumpContract2,
    Pump3: PumpContract3,
    Pump4: PumpContract4,
    Pump5: PumpContract5,
    Pump6: PumpContract6,
    IPShare1: IPShareContract1,
    IPShare2: IPShareContract2,
    UniswapRouter: uniswapV2Router02,
    WrapSwaper: wrappedUniswapV2ForTagAI,
    WrapSwaper2: wrappedUniswapV2ForTagAI2,
    CoinPurse: CoinPurse,
    WETH: WETH
}

export const readContract = async (contractName: string, functionName: string, args: any, address?: `0x${string}`) => {
    const client = getReadOnlyClient();
    if (!address) {
        // @ts-ignore
        address = ContractAddress[contractName] as `0x${string}`
    }
    const abi = abis[contractName as keyof typeof abis]
    const result = await client.readContract({
        address,
        abi,
        functionName,
        args
    });
    return result;
}

export const writeContract = async ({
    contractName, 
    functionName, 
    args,
    address,
    value = 0n
}: {
    contractName: string, 
    functionName: string, 
    args: any,
    address?: `0x${string}`,
    value?: bigint | string
}) => {
    const client = getWalletClient();
    if (!client) {
        throw 'no wallet client'
    }
    if (useAccountStore().getWalletType !== 'privy') {
        await setup()
    }
    if (!address) {
        // @ts-ignore
        address = ContractAddress[contractName] as `0x${string}`
    }
    const abi = abis[contractName as keyof typeof abis]
    const tx = await client.writeContract({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        address,
        abi,
        functionName,
        args,
        chain: customBsc,
        value: typeof value === 'string' ? BigInt(value) : value
    });
    return await waitForTx(tx);
}