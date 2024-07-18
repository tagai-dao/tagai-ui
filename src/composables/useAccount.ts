import {computed, reactive, ref, withDefaults, defineProps} from "vue";
import {stringLength} from "@/utils/helper";
import { useAccountStore } from "@/stores/web3";
import emptyProfile from '@/assets/icons/icon-default-avatar.svg'
import { twitterRefreshAccessToken, twitterLogout } from '@/apis/api'

export const useAccount = () => {
    const accountMismatch = computed(() => {
        const accStore = useAccountStore()
        if (!accStore.ethConnectAddress) {
            return false
        }
        return accStore.getAccountInfo?.ethAddr != accStore.ethConnectAddress
    })

    const replaceEmptyProfile = (e: any) => {
        e.target.src = emptyProfile
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

    const logout = () => {
        twitterLogout(useAccountStore().getAccountInfo.twitterId).catch()
        useAccountStore().setAccount(null);
    }

    return {
        accountMismatch,
        replaceEmptyProfile,
        checkoutAccessToken,
        logout
    }
}