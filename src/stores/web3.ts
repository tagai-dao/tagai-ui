import { defineStore } from 'pinia'
import type { IPShare, Account, TokenHoldingList, Tweet, Community, SocialMessage, FarcasterUser } from '@/types'
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
            this.tokenHoldingList = [];// ref<TokenHoldingList[]>([])
            this.tweetsList = [];
            this.blinksList = [];
            this.createdTokenList = [];
            this.ethBalance = 0
            this.ipshare = {}
            this.pubKey = ''
            this.ethWalletType = 'none' // metamask, okx, none
            this.ethConnectState = EthWalletState.Disconnect
            this.ethConnectAddress = '',
            this.unreadMessageCount = 0,
            this.socialMessages = [],
            this.farcasterUser = null
        }
    },
    state() {
        const account = ref<Account | null>(null);
        let tokenHoldingList = ref<TokenHoldingList[]>([]);
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
            tokenHoldingList,
            tweetsList: [] as Tweet[],
            blinksList: [] as Tweet[],
            createdTokenList: [] as Community[],
            setAccount,
            ethBalance: 0,
            ipshare: {} as IPShare,
            pubKey: '',
            ethWalletType: '',
            ethConnectState: EthWalletState.Disconnect,
            ethConnectAddress: '',
            unreadMessageCount: 0,
            socialMessages: [] as SocialMessage[],
            farcasterUser: null as FarcasterUser | null,
            chainId: 0
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
            return acc as Account
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
            ethPrice: 0.0,
            blockNum: 0,   // on evm chain
            btcBlockNum: 0, // on btc chain
        }
    }
})
