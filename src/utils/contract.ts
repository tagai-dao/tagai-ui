import { PumpContract, IPShareContract, uniswapV2Router02, ChainConfig } from '@/config'
import { Contract, initializeProvider } from "./nuls";

const ContractAddress = {
    Pump: PumpContract,
    IPShare: IPShareContract,
    UniswapRouter: uniswapV2Router02,
    multicall: ChainConfig.multiConfig.multicallAddress
}

export const getContract = async (contractName: string, address?: string, readOnly = false): Promise<any> => {
    await initializeProvider()

    if (!address) {
        if (Object.keys(ContractAddress).includes(contractName) === false) {
            throw new Error("Invalid contract name")
        }
        // @ts-ignore
        address = ContractAddress[contractName]
    }
    const contract = new Contract(address!);
    await contract.init()

    return contract
}

export interface Call {
    target: string
    call: any[]
    returns: [string, Function | undefined][]
}

export const aggregate = async (calls: Call[], address?: string): Promise<any> => {
    let contracts: string[] = []
    let methods: string[] = []
    let args: any[] = []
    for (const call of calls) {
        contracts.push(call.target)
        methods.push(call.call[0])
        if (call.call.length = 1) {
            args.push(null)
        } else {
            let arg = ""
            let pars = call.call.slice(1)
            for (const par of pars) {
                if (Array.isArray(par)) {
                    arg += par.join(':') + ","
                } else {
                    arg += par + ","
                }
            }
            args.push(arg.substring(0, arg.length - 1))
        }
    }
    let multicall = await getContract("multicall", address)
    let results = await multicall.aggregate(contracts, methods, args);
    let result: any = {}
    for (let i = 0; i < results.length; i++) {
        for (let j = 0; j < calls[i].returns.length; j++) {
            let ret = calls[i].returns[j]
            let [key, fun] = ret
            let data = results[i].split(",")
            if (fun) {
                result[key] = fun(data[j])
            } else {
                result[key] = data[j]
            }
        }
    }
    return result
}