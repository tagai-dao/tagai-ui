import { WalletAdapterNetwork, WalletReadyState } from '@solana/wallet-adapter-base'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';


export const newtwork = WalletAdapterNetwork.Devnet;
export const endpoint = clusterApiUrl(newtwork);
export const connection = new Connection(endpoint, 'confirmed');

export const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
]
export const walletContext = {
    wallets,
    autoConnect: true
}
