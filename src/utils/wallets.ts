import { isAddress, checksumAddress, type WalletClient, type PublicClient } from 'viem';
import { setupNetwork } from './web3';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { uiLog } from '@/apis/api';
import { MetaMaskSDK } from '@metamask/sdk';
import { getProvider as getBNProvider } from "@binance/w3w-ethereum-provider";
import { ChainConfig } from "@/config"
import { usePrivyStore } from '@/stores/privy';
import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { customBsc } from './privy';


// this.ethWalletType = 'none' // metamask, okx, none
// this.ethConnectState = EthWalletState.Disconnect
// this.ethConnectAddress = ''

const providerDetails: any = []
let mmSdk: any;
let provider: any;
let providerInfo: any;
let accounts: any = []
let initialized = false
let readOnlyClient: PublicClient | undefined;

export const isMetaMaskInstalled = () => provider && (provider.isMetaMask || provider.isOkxWallet || provider.isOKExWallet || provider.isOKx || provider.isCoinbaseWallet || provider.isTokenPocket || provider.isBinanceWallet);
export const isMetaMaskConnected = () => accounts && accounts.length > 0;
export const isInitinalized = () => initialized;
export const getProviders = () => {
    const index = providerDetails.findIndex((p: any) => p.info.name === "Binance Wallet")
    if (index === -1) {
        handleNewProviderDetail({
            provider: { isBinanceWallet: true },
            info: {
                name: "Binance Wallet",
                icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" fill="none"><path fill="%23000" d="M0 0h130v130H0z"/><path fill="%23F3BA2F" d="M45.587 57.02 65.01 37.606l19.43 19.43 11.295-11.303L65.01 15 34.284 45.725zM15 65.004l11.299-11.299 11.298 11.299L26.3 76.302zM45.587 72.983 65.01 92.406l19.43-19.43 11.303 11.287-.008.007-30.725 30.734-30.725-30.718-.016-.016zM92.403 65.006 103.7 53.708 115 65.006l-11.299 11.299z"/><path fill="%23F3BA2F" d="m76.471 64.998-11.46-11.469-8.476 8.475-.98.972-2.005 2.006-.016.016.016.024 11.46 11.453 11.461-11.47.008-.007z"/></svg>`,
                uuid: "BinanceW3WSDK"
            }
        })
    }
    return providerDetails
};

export const getProvider = () => {
    const accStore = useAccountStore();
    const privyStore = usePrivyStore();
    if (accStore.getWalletType === 'privy-twitter') {
        return privyStore.ethersProvider;
    }
    if (provider) {
        return provider
    }
    return window.ethereum
}

export const getReadOnlyClient = () => {
    if (readOnlyClient) {
        return readOnlyClient;
    }
    readOnlyClient = createPublicClient({
        chain: customBsc,
        transport: http()
    });
    return readOnlyClient;
}

export const getWalletClient = () => {
    const accStore = useAccountStore();
    const accInfo = accStore.getAccountInfo;
    if (accInfo?.twitterId && (accInfo?.walletType === 1 || !accInfo?.ethAddr)) {
        const privyStore = usePrivyStore();
        if (!privyStore.viemWalletClient) {
            return null;
        }
        return privyStore.viemWalletClient;
        // const walletClient = createWalletClient({
        //     chain: bsc,
        //     transport: custom(privyStore.ethersProvider)
        // }) as WalletClient;
        // return walletClient;
    }
    const provider = getProvider();
    console.log(provider)
    if (provider) {
        const walletClient = createWalletClient({
            chain: customBsc,
            transport: custom(provider) // 使用插件钱包（如 MetaMask）
        }) as WalletClient;
        return walletClient;
    }
}

export const getProviderInfo = () => providerInfo

const detectEip6963 = () => {
    const accStore = useAccountStore();
    let walletType = accStore.ethWalletType;
    window.addEventListener('eip6963:announceProvider', (event: any) => {
        if (event.detail.info.uuid) {
            if (walletType && walletType !== 'none') {
                if (walletType == event.detail.info.name) {
                    setActiveProviderDetail(event.detail)
                }
            }

            handleNewProviderDetail(event.detail);
            initialized = true;
        }
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // 同时检测 window.ethereum
    if (window.ethereum) {
        if (window.ethereum.isTokenPocket) {
            console.log("detecte TP 钱包（传统）");
            providerDetails.push({
                provider: window.ethereum,
                info: {
                    name: 'TokenPocket',
                    icon: 'https://help.tokenpocket.pro/~gitbook/image?url=https%3A%2F%2F261497644-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252F-MMF2k4MCaxErpZyah2d%252Ficon%252F8FIvhACj72GmT8skuG39%252Fic_launcher.png%3Falt%3Dmedia%26token%3D8ef812d4-b6eb-43f4-a731-c6efedf020d0&width=32&dpr=2&quality=100&sign=19ac625a&sv=2',
                    uuid: 'tokenpocket'
                }
            })
        } else {
            console.log("No TP wallet detected");
        }
    }
};

export const setMetaMaskSDK = async () => {
    mmSdk = new MetaMaskSDK({
        checkInstallationImmediately: true,
        dappMetadata: {
            name: 'TagAI',
            url: 'https://tagai.fun'
        }
    });
    const accounts = await mmSdk.connect();
    provider = mmSdk.getProvider();
    providerInfo = {
        name: 'MetaMask',
        icon: 'https://docs.metamask.io/img/metamask-logo.svg',
        uuid: 'metamask'
    }
    const accStore = useAccountStore();
    accStore.ethWalletType = 'metamask';
    handleNewAccounts(accounts);
}

export const setActiveProviderDetail = (providerDetail: any) => {
    try {
        provider = providerDetail.provider;
        providerInfo = providerDetail.info;
        const accStore = useAccountStore();
        accStore.ethWalletType = providerInfo.name
        initializeProvider();
    } catch (error) {
        console.error(error)
    }
};

export const initializeProvider = async () => {
    if (isMetaMaskInstalled()) {
        if (provider.isBinanceWallet) {
            const rpc: { [chainId: number]: string } = {}
            rpc[ChainConfig.chainId] = ChainConfig.rpc
            provider = Object.assign(getBNProvider({
                rpc: rpc
            }), { isBinanceWallet: true })
        }
        provider.on('accountsChanged', handleNewAccounts);
        try {
            const newAccounts = await provider.request({
                method: "eth_requestAccounts"
            });
            if (!newAccounts || newAccounts.length === 0) {
                console.error('read wallet accoutn fail', newAccounts)
            }
            handleNewAccounts(newAccounts);
        } catch (e: any) {
            console.error('Error on init when getting accounts', e);
            if (e.message.includes("User closed modal")) {
                provider.disconnect()
            }
        }
    } else {
        console.error('not plugin installed')
    }
}

export const setup = async () => {
    await setupNetwork(getProvider())
}

const existsProviderDetail = (newProviderDetail: any) => {
    const existingProvider = providerDetails.find(
        (providerDetail: any) =>
            providerDetail.info &&
            newProviderDetail.info &&
            providerDetail.info.uuid === newProviderDetail.info.uuid,
    );

    return existingProvider;
};

const handleNewProviderDetail = (newProviderDetail: any) => {
    if (existsProviderDetail(newProviderDetail)) {
        return;
    }
    if (newProviderDetail.info.name === 'Binance Wallet') {
        providerDetails.unshift(newProviderDetail);
    } else {
        providerDetails.push(newProviderDetail);
    }
};

const handleNewAccounts = async (accounts: any) => {
    accounts = accounts
    const accStore = useAccountStore();
    if (!accounts || accounts.length == 0) {
        accStore.ethConnectState = EthWalletState.Disconnect
        accStore.ethWalletType = 'none'
        return;
    }
    const account = checksumAddress(accounts[0])
    if (!account) {
        accStore.ethConnectState = EthWalletState.Disconnect
        accStore.ethWalletType = 'none'
        return;
    }
    accStore.ethConnectState = EthWalletState.Connected
    accStore.ethConnectAddress = account;
    accStore.ethWalletType = providerInfo.name;
}

export const closeProvider = () => {
    handleNewAccounts([]);
    provider.removeListener('accountsChanged', handleNewAccounts)
    const accStore = useAccountStore();
    accStore.ethConnectState = EthWalletState.Disconnect;
    accStore.ethConnectAddress = '';
    provider = undefined;
}

export const signMessage = async (message: string) => {
    let wallet = getWalletClient() as WalletClient;
    if (!wallet) {
        return null;
    }
    return await wallet.signMessage({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        message: message
    });
}

export const getBalance = async (addr: string) => {
    if (!isAddress(addr)) return 0n;
    let wallet = getReadOnlyClient();
    const balance = await wallet.getBalance({
        address: addr as `0x${string}`
    });
    return balance;
}

export const getBlockNumber = async () => {
    let wallet = getReadOnlyClient();
    const blockNumber = await wallet.getBlockNumber();
    return blockNumber;
}

export const transferEthTo = async (to: string, value: bigint) => {
    let wallet = getWalletClient(); 
    if (!wallet) {
        return null;
    }
    await setup()
    const hash = await wallet.sendTransaction({
        account: useAccountStore().ethConnectAddress as `0x${string}`,
        to: to as `0x${string}`,
        value: value,
        chain: customBsc
    })
    return await waitForTx(hash);
}

export const waitForTx = async (hash: `0x${string}`) => {
    let wallet = getReadOnlyClient();
    const receipt = await wallet.waitForTransactionReceipt({
        hash
    });
    if (receipt.status === 'success') {
        return hash;
    }
    return null;
}

export async function initPlugin() {
    detectEip6963()
}