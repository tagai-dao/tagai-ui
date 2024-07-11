import { defineStore } from 'pinia'
import type { IPShare, Account } from '@/types'
import { ref } from 'vue'

export enum EthWalletState {
    Disconnect,
    Connected,
    Connecting
}

// user related
export const useAccountStore = defineStore('account', {
    actions: {
        clear() {
            this.setAccount(null);
            this.ethBalance = 0
            this.ipshare = {}
            this.pubKey = ''
            this.ethWalletType = 'none' // metamask, okx, none
            this.ethConnectState = EthWalletState.Disconnect
            this.ethConnectAddress = ''
            localStorage.removeItem('jwtToken')
        }
    },
    state() {
        const account = ref<Account | null>(null);
        const setAccount = (acc: Account | null) => {
            account.value = acc;
            if (!acc) {
                localStorage.removeItem('accountInfo')
            }else {
                localStorage.setItem('accountInfo', JSON.stringify(acc))
            }
        }
        
        return {
            account,
            setAccount,
            ethBalance: 0,
            ipshare: {} as IPShare,
            pubKey: '',
            ethWalletType: '',
            ethConnectState: EthWalletState.Disconnect,
            ethConnectAddress: ''
        }
    },
    getters:{
        getAccountInfo: (state) => {
            let acc = state.account;
            if (!acc) {
                let accStr = localStorage.getItem('accountInfo')
                if (accStr){
                    acc = typeof(accStr) === 'string' ? JSON.parse(accStr) : accStr
                }
            }
            return acc
        }
    }
})

// global data
export const useIpshareData = defineStore('ipshareData', {
    state() {
        return {
            ipshareListBySupply: [] as Array<IPShare>
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
