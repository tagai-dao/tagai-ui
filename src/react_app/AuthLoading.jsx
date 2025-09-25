import {useLoginWithOAuth, useOAuthTokens, useWallets, useCreateWallet, usePrivy} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect, useState} from "react";
import { bondEthByPrivyAccToken } from '@/apis/api.ts';
import { sleep } from "@/utils/helper";
import { useAccountStore } from "@/stores/web3";

export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()
    const { getAccessToken } = usePrivy();
    const accStore = useAccountStore();
    const [ bondingAddress, setBondingAddress ] = useState(false);
    const { createWallet } = useCreateWallet({
        onSuccess: (async ({wallet}) => {
            // const provider = await wallet.getEthereumProvider()
            try {
                // 绑定地址
                setBondingAddress(true);
                const privyAccessToken = await getAccessToken();
                await bondEthByPrivyAccToken(accStore.getAccountInfo?.twitterId, wallet.address, privyAccessToken);
                accStore.setAccount({
                    ...accStore.getAccountInfo,
                    ethAddr: wallet.address,
                    walletType: 1,
                    accountType: 0
                })
            } catch (error) {
                emitter.emit('authError', error);
            }finally {
                setBondingAddress(false);
            }
        }),
        onError: (error) => {
            emitter.emit('authError', error);
        }
    })

    useEffect(() => {
        async function getWalletProvider() {
            if(ready) {
                console.log('wallets', wallets)
                if (wallets.length === 0) {
                    return;
                }
                console.log('wallets2', wallets)
                while(bondingAddress) {
                    await sleep(0.5)
                }
                const provider = await wallets.find((wallet) => wallet.walletClientType === 'privy').getEthereumProvider()
                emitter.emit('walletProvider', provider)

                console.log(provider)
            }

        }
        getWalletProvider()
    }, [ready, wallets]);

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
    }, [state, loading])

    const {reauthorize} = useOAuthTokens({
        onOAuthTokenGrant: async ({oAuthTokens, user}) => {
            console.log(
                'Twitter auth success',
                oAuthTokens,
                user
            );

            const userInfo = await privyLogin(oAuthTokens.accessToken, oAuthTokens.refreshToken)
            emitter.emit('authSuccess', userInfo)
            if (wallets.length === 0) {
                console.log('create new wallet')
                await createWallet()
            }
        }
    });
    return (<></>)
}