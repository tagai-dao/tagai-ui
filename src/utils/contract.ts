import { getReadOnlyClient, getWalletClient, setup, waitForTx } from "./wallets";
import { abis } from './abis'
import { PumpContract1, IPShareContract1, uniswapV2Router02, uniswapV2Factory,
    PumpContract2, PumpContract3, PumpContract4, IPShareContract2,
    wrappedUniswapV2ForTagAI, CoinPurse, WETH, PumpContract5, PumpContract6,
    wrappedUniswapV2ForTagAI2, FPMMDeterministicFactory, ConditionalTokens,
    FPMMDeterministicFactoryEvent, FPMMDeterministicFactoryEventV2, FPMMDeterministicFactoryEventV3, PumpContract7, PumpContract8, PumpContract9, PumpContract11, IPShareContract3,
    HourlyTickCalculator, NutboxCommittee,
    PCSUniversalRouter, PCSPermit2, PCSCLPoolManager, ImportHelper,
    LinearCalculator, LinearTimeCalculator} from '@/config'
import { useAccountStore } from "@/stores/web3";
import { getChainById } from "./privy";
import { useChainStore } from "@/stores/chain";
import { getChainDeployment } from "@/config/chains";
import { zeroAddress } from "viem";

/** BSC 默认地址表；多链时由 resolveContractAddress 覆盖关键合约 */
const ContractAddress = {
    Pump1: PumpContract1,
    Pump2: PumpContract2,
    Pump3: PumpContract3,
    Pump4: PumpContract4,
    Pump5: PumpContract5,
    Pump6: PumpContract6,
    Pump7: PumpContract7,
    Pump8: PumpContract8,
    Pump9: PumpContract9,
    Pump11: PumpContract11,
    HourlyTickCalculator,
    LinearCalculator,
    LinearTimeCalculator,
    NutboxCommittee,
    ImportHelper,
    IPShare1: IPShareContract1,
    IPShare2: IPShareContract2,
    IPShare3: IPShareContract3,
    UniswapRouter: uniswapV2Router02,
    UniswapFactory: uniswapV2Factory,
    WrapSwaper: wrappedUniswapV2ForTagAI,
    WrapSwaper2: wrappedUniswapV2ForTagAI2,
    TagAISwapWrapper: wrappedUniswapV2ForTagAI2,
    CoinPurse: CoinPurse,
    WETH: WETH,
    FPMMDeterministicFactory: FPMMDeterministicFactory,
    FPMMDeterministicFactoryEvent: FPMMDeterministicFactoryEvent,
    FPMMDeterministicFactoryEventV2: FPMMDeterministicFactoryEventV2,
    FPMMDeterministicEventFactoryV3: FPMMDeterministicFactoryEventV3,
    ConditionalTokens,
    UniversalRouter: PCSUniversalRouter,
    Permit2: PCSPermit2,
    PCSCLPoolManager,
}

/** 这些合约必须按链取址，禁止跨链回退到 BSC 常量 */
const CHAIN_SCOPED_CONTRACTS = new Set([
    'Pump9', 'Pump11', 'IPShare3', 'ImportHelper', 'TagAISwapWrapper', 'WrapSwaper', 'WrapSwaper2', 'HourlyTickCalculator',
    'NutboxCommittee', 'CoinPurse', 'WETH', 'UniswapRouter', 'UniversalRouter', 'Permit2', 'PCSCLPoolManager',
])

/** 按当前产品链解析合约地址（RH 用 chains.ts 部署表） */
export const resolveContractAddress = (contractName: string): `0x${string}` | undefined => {
    const chainId = useChainStore().activeChainId
    const deployment = getChainDeployment(chainId)
    const c = deployment.contracts
    const dex = deployment.dex

    // BSC keeps two legacy swap wrappers for listed TagCoins. They predate the
    // multi-chain deployment table and must not be replaced by
    // contracts.tagAiSwapWrapper (which is intentionally unset on BSC).
    if (chainId === 56) {
        if (contractName === 'WrapSwaper') return wrappedUniswapV2ForTagAI
        if (contractName === 'WrapSwaper2' || contractName === 'TagAISwapWrapper') return wrappedUniswapV2ForTagAI2
    }

    const byName: Record<string, `0x${string}` | undefined> = {
        Pump9: c.pump9,
        Pump11: c.pump11,
        IPShare3: c.ipshare3,
        ImportHelper: c.importHelper,
        TagAISwapWrapper: c.tagAiSwapWrapper,
        WrapSwaper: c.tagAiSwapWrapper,
        WrapSwaper2: c.tagAiSwapWrapper,
        HourlyTickCalculator: c.hourlyTickCalculator,
        NutboxCommittee: c.nutboxCommittee,
        CoinPurse: c.coinPurse,
        WETH: deployment.wrappedNative,
        UniswapRouter: dex.v2Router,
        UniversalRouter: dex.universalRouter,
        Permit2: dex.permit2,
        PCSCLPoolManager: dex.v4PoolManager,
    }

    if (contractName in byName) {
        const addr = byName[contractName]
        // 零地址 = 本链未部署，绝不回退到 BSC
        if (!addr || addr === zeroAddress) return undefined
        return addr
    }

    // 非链作用域合约：仅 BSC 允许用历史常量表
    if (chainId === 56) {
        // @ts-ignore
        return ContractAddress[contractName] as `0x${string}` | undefined
    }
    if (CHAIN_SCOPED_CONTRACTS.has(contractName)) return undefined
    // @ts-ignore
    return ContractAddress[contractName] as `0x${string}` | undefined
}

/** V11 保持 V9 的现有调用 ABI；只替换部署地址。 */
const resolveContractAbi = (contractName: string) => {
    const aliases: Record<string, keyof typeof abis> = {
        Pump11: 'Pump9',
        Token11: 'Token9',
    }
    return abis[(aliases[contractName] ?? contractName) as keyof typeof abis]
}

export const readContract = async (contractName: string, functionName: string, args: any, address?: `0x${string}`) => {
    const client = getReadOnlyClient();
    if (!address) {
        address = resolveContractAddress(contractName)
    }
    if (!address || address === zeroAddress) {
        throw new Error(`Contract ${contractName} not deployed on current chain`)
    }
    const abi = resolveContractAbi(contractName)
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
    const publicClient = getReadOnlyClient();
    if (!client) {
        throw 'no wallet client'
    }
    if (useAccountStore().getWalletType !== 'privy') {
        await setup()
    }
    if (!address) {
        address = resolveContractAddress(contractName)
    }
    if (!address || address === zeroAddress) {
        throw new Error(`Contract ${contractName} not deployed on current chain`)
    }
    const abi = resolveContractAbi(contractName)
    // 交易目标链必须与产品当前链一致（Privy 钱包 chain 也要对齐）
    const chain = getChainById(useChainStore().activeChainId)

    console.log({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        address,
        abi,
        functionName,
        args,
        chain: chain.id,
        value: typeof value === 'string' ? BigInt(value) : value
    })
    
    const { request } = await publicClient.simulateContract({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        address,
        abi,
        functionName,
        args,
        chain,
        value: typeof value === 'string' ? BigInt(value) : value
    });

    const tx = await client.writeContract(request);
    console.log('tx', tx)
    const hash = await waitForTx(tx);
    console.log('hash1', hash)
    if (!hash) {
        throw 'transaction failed'
    }
    return hash;
}
