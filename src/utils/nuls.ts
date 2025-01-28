import { EthWalletState, useAccountStore } from "@/stores/web3";
import { isAddress, NULSAPI } from "nuls-api-v2"
import BigNumber from "bignumber.js"
import { ChainConfig, PumpContract } from "@/config";

declare global {
    interface Window {
        nabox: any;
    }
}

let initialized = false

const handleNewAccounts = async (accounts: any) => {
    const accStore = useAccountStore();
    if (!accounts || accounts.length == 0) {
        accStore.ethConnectState = EthWalletState.Disconnect
        accStore.ethWalletType = 'none'
        return;
    }
    const account = accounts[0]
    if (!account) {
        accStore.ethConnectState = EthWalletState.Disconnect
        accStore.ethWalletType = 'none'
        return;
    }
    accStore.ethConnectState = EthWalletState.Connected
    accStore.ethConnectAddress = account;
    accStore.ethWalletType = "NaBox";
}

export const isNaboxInstalled = () => window && "nabox" in window

export const initializeProvider = async () => {
    if (initialized) return
    if (isNaboxInstalled()) {
        window.nabox.on('accountsChanged', handleNewAccounts);
        try {
            const newAccounts = await window.nabox.createSession()
            if (!newAccounts || newAccounts.length === 0) {
                console.error('read wallet accoutn fail', newAccounts)
            }
            handleNewAccounts(newAccounts);
            initialized = true
        } catch (e) {
            console.error('Error on init when getting accounts', e);
        }
    } else {
        console.error('not plugin installed')
    }
}

export const nulsapi = new NULSAPI({ isBeta: PumpContract.startsWith("tNULS"), rpcURL: ChainConfig.rpc })

export class Contract {
    api: NULSAPI
    address: string

    constructor(address: string) {
        this.address = address
        this.api = nulsapi
    }

    async init() {
        let info: any = localStorage.getItem(this.address);
        if (info == null || info == undefined) {
            info = await this.api.getContract(this.address);
            localStorage.setItem(this.address, JSON.stringify(info));
        } else {
            info = JSON.parse(info);
        }
        info!.method.forEach((method: any) => {
            if (method.event === false && method.name != "<init>") {
                const functionName: keyof Contract = method.name;
                const functionDesc = method.desc;
                const isView = method.view;

                if (isView) {
                    (this as any)[functionName] = async (...args: any[]) => {
                        let blockHeight = null;
                        let lastArg = args[args.length - 1];
                        if (lastArg && typeof lastArg === "object" && !(lastArg instanceof BigNumber)) {
                            let opt = args.pop();
                            if ("blockHeight" in opt) {
                                blockHeight = opt.blockHeight;
                            }
                        }
                        if (blockHeight) {
                            return await this.api.invokeView(this.address, functionName, functionDesc, args, blockHeight);
                        } else {
                            return await this.api.invokeView(this.address, functionName, functionDesc, args);
                        }
                    }
                } else {
                    (this as any)[functionName] = async (...args: any[]) => {
                        const accStore = useAccountStore()
                        let lastArg = args[args.length - 1]
                        let value = 0
                        let multyAssetValues: any[] | null = null
                        if (lastArg && typeof lastArg === "object" && !(lastArg instanceof BigNumber)) {
                            let opt = args.pop();
                            if (method.payable && "value" in opt) {
                                value = opt.value;
                            }
                            if (method.payableMultyAsset && "multyAssetValues" in opt) {
                                multyAssetValues = opt.multyAssetValues;
                            }
                        }
                        let data: {
                            from: string;
                            value: number;
                            contractAddress: string;
                            methodName: keyof Contract;
                            methodDesc: any;
                            args: any[];
                            multyAssetValues?: any[];
                        } = {
                            from: accStore.ethConnectAddress,
                            value,
                            contractAddress: this.address,
                            methodName: functionName,
                            methodDesc: functionDesc,
                            args: [...args]
                        }
                        if (multyAssetValues) {
                            data.multyAssetValues = multyAssetValues
                        }
                        return await window.nabox.contractCall(data)
                    }
                }
            }
        })
    }
}

export const signMessage = async (message: string) => {
    await initializeProvider()
    const accStore = useAccountStore();
    return await window.nabox.signMessage([message, accStore.ethConnectAddress])
}

export const getBalance = async (addr: string) => {
    if (!isAddress(addr)) return 0n;
    const balance = await nulsapi.getAvailableBalance(addr)
    return BigInt(balance.toString(10));
}

export const transferEthTo = async (to: string, value: bigint, assetChainId: number = 1, assetId: number = 1, remarks: string = "", contractAddress: string = "") => {
    await initializeProvider()
    const accStore = useAccountStore();
    const tx = {
        from: accStore.ethConnectAddress,
        to,
        value: value.toString(),
        assetChainId,
        assetId,
        contractAddress,
        remarks
    }
    const res = await window.nabox.sendTransaction(tx);
    return res
}