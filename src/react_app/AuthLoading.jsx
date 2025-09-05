import {useLoginWithOAuth, useOAuthTokens, useWallets, useCreateWallet} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect} from "react";
import { sleep } from "@/utils/helper";
import { useAccountStore } from "@/stores/web3";

export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()
    const accStore = useAccountStore();
    const { createWallet } = useCreateWallet({
        onSuccess: (async ({wallet}) => {
            const provider = await wallet.getEthereumProvider()
            emitter.emit('walletProvider', provider)
        }),
        onError: (error) => {
            console.log(error)
        }
    })

    useEffect(() => {
        async function getWalletProvider() {
            if(ready) {
                let count = 8
                // 没有推特登录的时候不会加载privy钱包
                while (count > 0) {
                    const logged = accStore.getAccountInfo?.twitterId
                    if (logged) {
                        break;
                    }
                    count--;
                    await sleep(1)
                }
                if (wallets.length === 0 || !wallets.find((wallet) => wallet.walletClientType === 'privy')) {
                   await createWallet()
                    return;
                }
                const provider = await wallets.find((wallet) => wallet.walletClientType === 'privy').getEthereumProvider()
                emitter.emit('walletProvider', provider)

                console.log(provider)
            }

        }
        getWalletProvider()
    }, [ready]);

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
    }, [state, loading])

    const {reauthorize} = useOAuthTokens({
        onOAuthTokenGrant: async ({oAuthTokens}) => {
            console.log(
                oAuthTokens.provider,
                oAuthTokens.accessToken,
                oAuthTokens.accessTokenExpiresInSeconds,
                oAuthTokens.refreshToken,
                oAuthTokens.refreshTokenExpiresInSeconds,
                oAuthTokens.scopes
            );
            const userInfo = await privyLogin(oAuthTokens.accessToken, oAuthTokens.refreshToken)
            emitter.emit('authSuccess', userInfo)
        }
    });
    return (<></>)
}