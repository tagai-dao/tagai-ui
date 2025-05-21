import { ethers } from 'ethers';
import { setupNetwork } from './web3';
import { EthWalletState, useAccountStore } from '@/stores/web3';
import { uiLog } from '@/apis/api';
import { MetaMaskSDK } from '@metamask/sdk';

// this.ethWalletType = 'none' // metamask, okx, none
// this.ethConnectState = EthWalletState.Disconnect
// this.ethConnectAddress = ''

const providerDetails: any = []
let mmSdk: any;
let provider: any;
let providerInfo: any;
let accounts: any = []
let initialized = false

export const isMetaMaskInstalled = () => provider && (provider.isMetaMask || provider.isOkxWallet || provider.isOKExWallet || provider.isOKx || provider.isCoinbaseWallet || provider.isTokenPocket);
export const isMetaMaskConnected = () => accounts && accounts.length > 0;
export const isInitinalized = () => initialized;
export const getProviders = () => providerDetails;
export const getProvider = () => provider
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
        console.log("检测到 TP 钱包（传统）");
        providerDetails.push({
            provider: window.ethereum,
            info: {
                name: 'TokenPocket',
                icon: 'https://help.tokenpocket.pro/~gitbook/image?url=https%3A%2F%2F261497644-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252F-MMF2k4MCaxErpZyah2d%252Ficon%252F8FIvhACj72GmT8skuG39%252Fic_launcher.png%3Falt%3Dmedia%26token%3D8ef812d4-b6eb-43f4-a731-c6efedf020d0&width=32&dpr=2&quality=100&sign=19ac625a&sv=2',
                uuid: 'tokenpocket'
            }
        })
        } else {
        console.log("检测到其他钱包");
        }
    }
};

export const setMetaMaskSDK = async () => {
    console.log(1)
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
        provider.on('accountsChanged', handleNewAccounts);
        try {
            const newAccounts = await provider.request({
                method: "eth_requestAccounts"
            });
            if (!newAccounts || newAccounts.length === 0) {
                console.error('read wallet accoutn fail', newAccounts)
            }
            handleNewAccounts(newAccounts);
        } catch (e) {
            console.error('Error on init when getting accounts', e);
        }
    }else {
        console.error('not plugin installed')
    }
}

export const setup = async () => {
    await setupNetwork(provider)
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
    providerDetails.push(newProviderDetail);
};

const handleNewAccounts = async (accounts: any) => {
    accounts = accounts
    const accStore = useAccountStore();
    if (!accounts || accounts.length == 0) {
        accStore.ethConnectState = EthWalletState.Disconnect
        accStore.ethWalletType = 'none'
        return;
    }
    const account = ethers.getAddress(accounts[0])
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
    let eth = getProvider();
    const provider = new ethers.BrowserProvider(eth);
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
}

export const getBalance = async (addr: string) => {
    // @ts-ignore
    if (!ethers.isAddress(addr)) return 0n;
    let eth = getProvider();
    const provider = new ethers.BrowserProvider(eth);
    const balance = await provider.getBalance(addr);
    return balance;
}

export const transferEthTo = async (to: string, value: bigint) => {
    let eth = getProvider();
    await setup()
    const provider = new ethers.BrowserProvider(eth);
    const signer = await provider.getSigner();
    const tx = await signer.sendTransaction({
        to,
        value
    })
    await tx.wait();
    return tx.hash;
}

export async function initPlugin() {
    detectEip6963()
}