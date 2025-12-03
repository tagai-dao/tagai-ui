import { getReadOnlyClient, getWalletClient, setup, waitForTx } from "./wallets";
import { abis } from './abis'
import { PumpContract1, IPShareContract1, uniswapV2Router02, uniswapV2Factory,
    PumpContract2, PumpContract3, PumpContract4, IPShareContract2, 
    wrappedUniswapV2ForTagAI, CoinPurse, WETH, PumpContract5, PumpContract6, 
    wrappedUniswapV2ForTagAI2, FPMMDeterministicFactory, ConditionalToken } from '@/config'
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
    UniswapFactory: uniswapV2Factory,
    WrapSwaper: wrappedUniswapV2ForTagAI,
    WrapSwaper2: wrappedUniswapV2ForTagAI2,
    CoinPurse: CoinPurse,
    WETH: WETH,
    FPMMDeterministicFactory: FPMMDeterministicFactory,
    ConditionalToken,
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

// export const writeContractC = async ({
//     contractName, 
//     functionName, 
//     args,
//     address,
//     value = 0n
// }: {
//     contractName: string, 
//     functionName: string, 
//     args: any,
//     address?: `0x${string}`,
//     value?: bigint | string
// }): Promise<string> => {
//     const accStore = useAccountStore();
    
//     if (accStore.getWalletType === 'privy') {
//         const lastValidateTime = localStorage.getItem('lastValidateTime');
//         if (lastValidateTime && Date.now() - parseInt(lastValidateTime) < 1800000) {
//             return await executeContract({
//                 contractName,
//                 functionName,
//                 args,
//                 address,
//                 value
//             })
//         }
//         return new Promise((resolve, reject) => {
//             // 监听结果
//             const handleSuccess = async () => {
//                 emitter.off('MFAValidated', handleSuccess);
//                 emitter.off('MFAValidationFailed', handleError);

//                 localStorage.setItem('lastValidateTime', Date.now().toString());

//                 console.log('success:', contractName, functionName, args, address, value);
//                 try {
//                     const result = await executeContract({
//                         contractName,
//                         functionName,
//                         args,
//                         address,
//                         value
//                     })
//                     resolve(result);

//                 } catch (error) {
//                     reject(error);
//                 }
//             };
            
//             const handleError = (error: any) => {
//                 emitter.off('MFAValidated', handleSuccess);
//                 emitter.off('MFAValidationFailed', handleError);
//                 reject(error);
//             };
            
//             emitter.on('MFAValidated', handleSuccess);
//             emitter.on('MFAValidationFailed', handleError);
            
//             // 发送交易请求到 React 端
//             emitter.emit('MFAValidationRequired');
            
//             // 30秒超时
//             setTimeout(() => {
//                 emitter.off('MFAValidated', handleSuccess);
//                 emitter.off('MFAValidationFailed', handleError);
//                 reject(new Error('Transaction timeout'));
//             }, 30000);
//         });
//     }

//     return await executeContract({
//         contractName,
//         functionName,
//         args,
//         address,
//         value
//     });
// }


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
}): Promise<string> => {
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
    const hash = await waitForTx(tx);
    if (!hash) {
        throw 'transaction failed'
    }
    return hash;
}