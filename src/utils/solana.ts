import { useWallet } from 'solana-wallets-vue'
import { Connection, clusterApiUrl, Keypair, SystemProgram, Transaction } from '@solana/web3.js'

export const { wallets, connect, disconnect, connected, publicKey, signMessage } = useWallet()