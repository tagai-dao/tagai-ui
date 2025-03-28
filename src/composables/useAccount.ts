import { computed } from "vue";
import { useAccountStore } from "@/stores/web3";
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'
import { twitterRefreshAccessToken, getVPOP, needLogin,
    getNewMessageCount, getMessages as gm, readAllMessage
 } from '@/apis/api'
import { MAX_OP, MAX_VP, OP_RECOVER_DAY, VP_RECOVER_DAY } from '@/config'
import errCode from "@/errCode";
import { formatDate } from '@/utils/helper'
import { useModalStore } from "@/stores/common";
import { GlobalModalType } from "@/types";
import { ethers } from "ethers";
import { getBalance } from '@/utils/web3'

export const useAccount = () => {
    const accountMismatch = computed(() => {
        const accStore = useAccountStore()
        if (!accStore.ethConnectAddress) {
            return false
        }
        return accStore.getAccountInfo?.ethAddr != accStore.ethConnectAddress
    })

    const profile = computed(() => {
        const account = useAccountStore().getAccountInfo
        return account.profile?.replace('normal', '200x200')
    })

    const replaceEmptyProfile = (e: any) => {
        e.target.src = emptyProfile
    }

    const gotoTwitter = () => {
        window.open('https://x.com/' + useAccountStore().getAccountInfo.twitterUsername, '__blank')
    }

    const refreshToken = async () => {
        const acc = useAccountStore().getAccountInfo;
        if (acc?.twitterId) {
            const token: any = await twitterRefreshAccessToken(acc.twitterId)
            useAccountStore().setAccount({
                ...acc,
                ...token
            })
            return token;
        }else {
            return false
        }
    }

    const updateVPOP = async () => {
        const account = useAccountStore().getAccountInfo
        if (account && account.twitterId) {
            getVPOP(account.twitterId).then((vpop: any) => {
                useAccountStore().setAccount({
                    ...account,
                    ...vpop
                })
            }).catch((e: any) => {
                if (e === errCode.InvalidAccessToken) {
                    logout()
                }
            })
        }
    }

    const updateUnreadMessageCount = async () => {
        const account = useAccountStore().getAccountInfo
        if (account?.twitterId) {
            getNewMessageCount(account.twitterId, account.lastReadMessageTime).then((count: any) => {
                useAccountStore().unreadMessageCount = count ?? 0;
            }).catch((e: any) => {
                if (e === errCode.InvalidAccessToken) {
                    logout()
                }
            })
        }
    }

    const getMessages = async () => {
        const account = useAccountStore().getAccountInfo
        if (account?.twitterId) {
            gm(account.twitterId).then((messages: any) => {
                useAccountStore().socialMessages = messages;
            }).catch((e: any) => {
                if (e === errCode.InvalidAccessToken) {
                    logout()
                }
            })
        }
    }

    const setMessageReaded = async () => {
        const account = useAccountStore().getAccountInfo
        if (account?.twitterId) {
            readAllMessage(account.twitterId).then((messages: any) => {
                useAccountStore().setAccount({
                    ...account,
                    lastReadMessageTime: formatDate()
                })
            }).catch((e: any) => {
                console.log(444, e)
                if (e === errCode.InvalidAccessToken) {
                    logout()
                }
            })
        }
    }

    const vp = computed(() => {
        const vpInfo = useAccountStore().getAccountInfo
        if ((!vpInfo.vp && vpInfo.vp !== 0) || !vpInfo.lastUpdateVpStamp) return vpInfo.vp ?? 0;
        let vp = (vpInfo.vp! + (Date.now() - vpInfo.lastUpdateVpStamp!) * MAX_VP / (86400000 * VP_RECOVER_DAY))
        return vp > MAX_VP ? MAX_VP : vp
    })

    const op = computed(() => {
        const opInfo = useAccountStore().getAccountInfo
        if ((!opInfo.op && opInfo.op !== 0) || !opInfo.lastUpdateOpStamp) return opInfo.op ?? 0;
        let op = (opInfo.op! + (Date.now() - opInfo.lastUpdateOpStamp!) * MAX_OP / (86400000 * OP_RECOVER_DAY))
        return op > MAX_OP ? MAX_OP : op
    })

    const updateUserVpLocal = (vpConsume: number) => {
        if (vpConsume == 0) return true;
        const account = useAccountStore().getAccountInfo;
        if (vp.value >= vpConsume) {
            useAccountStore().setAccount({
                ...account,
                vp: account.vp! - vpConsume
            })
            return true
        }
        return false;
    }

    const udpateUserOPLocal = (opConsume: number) => {
        if (opConsume == 0) return;
        const account = useAccountStore().getAccountInfo;
        if (op.value >= opConsume) {
            useAccountStore().setAccount({
                ...account,
                op: account.op! - opConsume
            })
            return true;
        }
        return false;
    }

    const addBackVp = (vpConsume: number) => {
        if (vpConsume == 0) return;
        const account = useAccountStore().getAccountInfo;
        useAccountStore().setAccount({
            ...account,
            vp: account.vp! + vpConsume
        })
    }

    const addBackOp = (opConsume: number) => {
        if (opConsume == 0) return;
        const account = useAccountStore().getAccountInfo;
        useAccountStore().setAccount({
            ...account,
            op: account.op! + opConsume
        })
    }

    const checkLogin = async () => {
        const accStore = useAccountStore();
        const acc = accStore.getAccountInfo;
        if (acc && acc.accessToken) {
            try {
                await needLogin(acc.twitterId)
                return true;
            } catch (error) {
                if (error === errCode.InvalidAccessToken) {
                    logout()
                    useModalStore().setModalVisible(true, GlobalModalType.Login);
                    return;
                }
                throw error;
            }
        }else {
            useModalStore().setModalVisible(true, GlobalModalType.Login);
        }
    }

    const checkoutAccessToken = async () => {
        const accStore = useAccountStore();
        const acc = accStore.getAccountInfo;
        if (acc && acc.accessToken) {
            const { expiresAt } = acc;
            if (typeof(expiresAt) !== 'number') {
                logout();
                return;
            }
            if (expiresAt - new Date().getTime() < 600000) {
                // refresh token 
                try {
                    const token = await refreshToken();
                    if (token) {
                        accStore.setAccount({
                            ...acc,
                            accessToken: token.accessToken,
                            expiresAt: token.expiresAt
                        })
                        return token.accessToken;
                    }else {
                        logout()
                        return false
                    }
                }catch(e) {
                    logout()
                    return false
                }
            }
            return acc.accessToken
        }else {
            // need auth again
            logout();
            return false
        }
    }

    const updateBalance = () => {
        if (ethers.isAddress(useAccountStore().getAccountInfo.ethAddr)) {
            getBalance(useAccountStore().getAccountInfo.ethAddr!).then(balance => {
                // @ts-ignore
                useAccountStore().ethBalance = balance.toString() / 1e18
            }).catch()
        }
    }

    const logout = () => {
        // twitterLogout(useAccountStore().getAccountInfo.twitterId).catch()
        useAccountStore().clear();
    }

    return {
        accountMismatch,
        replaceEmptyProfile,
        updateUnreadMessageCount,
        getMessages,
        setMessageReaded,
        profile,
        gotoTwitter,
        checkoutAccessToken,
        updateVPOP,
        updateUserVpLocal,
        udpateUserOPLocal,
        vp,
        op,
        addBackOp,
        addBackVp,
        checkLogin,
        updateBalance,
        logout
    }
}