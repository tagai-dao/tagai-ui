import { defineStore } from 'pinia'
import type { Inscriptions, IPShare, MingingPool, MyHolding, Trade, Twitter } from '@/types'

export enum WalletState {
    Disconnect,
    Okx,
    Unisat,
    WrongAddress
}

export enum EthWalletState {
    Disconnect,
    Connected,
    Connecting
}

// user related
export const useAccountStore = defineStore('account', {
    actions: {
        clear() {
            this.account = ''
            this.ethAddress = ''
            this.ethBalance = 0
            this.twitter = {}
            this.steemId = ''
            this.ipshare = {}
            this.holdings = []
            this.trades = []
            this.pubKey = ''
            this.inscriptions = {} as Inscriptions
            this.utxos = [] as UTXOs,
            this.wallet = null as any,
            this.connectState = WalletState.Disconnect,
            this.ethWalletType = 'none' // metamask, okx, none
            this.ethConnectState = EthWalletState.Disconnect
            this.ethConnectAddress = ''
            this.miningPool = undefined
            localStorage.removeItem('jwtToken')
        }
    },
    state() {
        return {
            account: '',
            ethAddress: '',
            ethBalance: 0,
            ipshare: {} as IPShare,
            twitter: {} as Twitter,
            steemId: '',
            holdings: [] as Array<MyHolding>,
            trades: [] as Array<Trade>,
            pubKey: '',
            inscriptions: {} as Inscriptions,
            utxos: [] as UTXOs,
            wallet: null as any,  // btc
            connectState: WalletState.Disconnect,
            ethWalletType: '',
            ethConnectState: EthWalletState.Disconnect,
            ethConnectAddress: '',
            miningPool: {} as MingingPool | undefined
        }
    },
    getters:{

    }
})

// global data
export const useIpshareData = defineStore('ipshareData', {
    state() {
        return {
            ipshareListBySupply: [] as Array<IPShare>,
            ipshareTradeList: {} as {[property: string]: Array<Trade>},
            allTradingList: [] as Array<Trade>
        }
    }
})

// blockchain related
export const useBlockchain = defineStore('blockchain', {
    state() {
        return {
            btcPrice: 0.0,
            blockNum: 0,   // on evm chain
            btcBlockNum: 0, // on btc chain
        }
    }
})
