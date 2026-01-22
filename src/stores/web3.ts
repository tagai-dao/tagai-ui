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
            if (this.getAccountInfo?.twitterId) {
                this.ethWalletType = 'none' // metamask, okx, privy, none
                this.ethConnectState = EthWalletState.Disconnect
                this.ethConnectAddress = '';
            }
            this.setAccount(null);
            this.tokenHoldingList = [];// ref<TokenHoldingList[]>([])
            this.tweetsList = [];
            this.blinksList = [];
            this.createdTokenList = [];
            this.ethBalance = 0
            this.socialBalance = 0
            this.holdingValue = 0;
            this.ipshare = {}
            this.pubKey = ''
            this.unreadMessageCount = 0;
            this.socialMessages = []
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
            holdingValue: 0,
            socialBalance: 0,
            transactionLimit: 0,
            dailyLimit: 0,
            ipshare: {} as IPShare,
            pubKey: '',
            ethWalletType: '',
            ethConnectState: EthWalletState.Connecting,
            ethConnectAddress: '',
            unreadMessageCount: 0,
            socialMessages: [] as SocialMessage[],
            farcasterUser: null as FarcasterUser | null,
            chainId: 0
        }
    },
    getters:{
        getAccountInfo(state) {
            let acc = state.account;
            if (!acc) {
                let accStr = localStorage.getItem('accountInfo')
                if (accStr){
                    acc = typeof(accStr) === 'string' ? JSON.parse(accStr) : accStr
                }
            }
            return acc as Account
        },
        getWalletType(state) {
            const account = this.getAccountInfo;
            if (!account) {
                return 'none';
            }else {
                if (account.walletType === 1) {
                    return 'privy';
                }else {
                    return 'metamask';
                }
            }
        }
    }
})

// global data
export const useIpshareData = defineStore('ipshareData', {
    state() {
        return {
            ipshareListBySupply: [] as Array<IPShare>,
            // IPShare 资产数据 (从 Donut 迁移)
            ipshareBalances: {} as Record<string, number>,      // 用户持有的 IPShare { address: balance }
            ipshareSupplies: {} as Record<string, number>,      // IPShare 供应量 { address: supply }
            stakeInfos: {} as Record<string, any>,              // 质押信息 { address: StakeInfo }
            totalStakedIPshares: {} as Record<string, number>,  // 总质押量 { address: totalStaked }
            pendingIPshareProfits: {} as Record<string, number>, // 待领取收益 { address: profit }
            keyFundRatios: {} as Record<string, number>,         // 密钥基金比例 { address: ratio }
            kolsInfo: {} as Record<string, number>               // KOL 费用信息 { address: fee } (参考 Donut)
        }
    },
    actions: {
        /**
         * 保存 IPShare 持有量
         */
        saveIPshareBalances(balances: Record<string, number>) {
            this.ipshareBalances = {
                ...this.ipshareBalances,
                ...balances
            }
        },

        /**
         * 保存 IPShare 供应量
         */
        saveIPshareSupplies(supplies: Record<string, number>) {
            this.ipshareSupplies = {
                ...this.ipshareSupplies,
                ...supplies
            }
        },

        /**
         * 保存质押信息
         */
        saveStakeInfos(infos: Record<string, any>) {
            this.stakeInfos = {
                ...this.stakeInfos,
                ...infos
            }
        },

        /**
         * 保存总质押量
         */
        saveTotalStakedIPshares(totals: Record<string, number>) {
            this.totalStakedIPshares = {
                ...this.totalStakedIPshares,
                ...totals
            }
        },

        /**
         * 保存待领取收益
         */
        savePendingIPshareProfits(profits: Record<string, number>) {
            this.pendingIPshareProfits = {
                ...this.pendingIPshareProfits,
                ...profits
            }
        },

        /**
         * 保存密钥基金比例
         */
        saveKeyFundRatios(ratios: Record<string, number>) {
            this.keyFundRatios = {
                ...this.keyFundRatios,
                ...ratios
            }
        },

        /**
         * 保存 KOL 费用信息（参考 Donut 实现）
         */
        saveKolsInfo(kolsInfo: Record<string, number>) {
            this.kolsInfo = {
                ...this.kolsInfo,
                ...kolsInfo
            }
        },

        /**
         * 清空所有数据
         */
        clear() {
            this.ipshareBalances = {}
            this.ipshareSupplies = {}
            this.stakeInfos = {}
            this.totalStakedIPshares = {}
            this.pendingIPshareProfits = {}
            this.keyFundRatios = {}
            this.kolsInfo = {}
            this.ipshareListBySupply = []
        }
    },
    getters: {
        /**
         * 获取指定 IPShare 的持有量
         */
        getIPshareBalance: (state) => (address: string): number => {
            return state.ipshareBalances[address] || 0
        },

        /**
         * 获取指定 IPShare 的供应量
         */
        getIPshareSupply: (state) => (address: string): number => {
            return state.ipshareSupplies[address] || 0
        },

        /**
         * 获取指定 IPShare 的质押信息
         */
        getStakeInfo: (state) => (address: string): any => {
            return state.stakeInfos[address] || null
        },

        /**
         * 获取指定 IPShare 的待领取收益
         */
        getPendingProfit: (state) => (address: string): number => {
            return state.pendingIPshareProfits[address] || 0
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
