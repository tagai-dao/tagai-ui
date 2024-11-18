import { WalletAdapterNetwork, WalletReadyState } from '@solana/wallet-adapter-base'
import { Connection } from '@solana/web3.js'
import { createDefaultAuthorizationResultCache } from '@solana/wallet-standard-feature';
import { clusterApiUrl } from '@solana/web3.js';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletProvider } from '@solana/wallet-adapter-vue';

const newtwork = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(newtwork);
const connection = new Connection(endpoint, 'confirmed');
const authorizationResultCache = createDefaultAuthorizationResultCache();

export const useSolanaWallet = () => {
    const wallets = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ]
    const walletContext = {
        wallets,
        autoConnect: true,
        localStorageKey: 'wallet-adapter'
    }

    return {
        walletContext
    }
}
