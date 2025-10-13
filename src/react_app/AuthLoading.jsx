import {useLoginWithOAuth, useOAuthTokens, useWallets, useCreateWallet, usePrivy, useMfaEnrollment} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect, useState} from "react";
import { bondEthByPrivyAccToken } from '@/apis/api.ts';
import { sleep } from "@/utils/helper";
import { useAccountStore } from "@/stores/web3";

export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()
    const { getAccessToken, user } = usePrivy();
    const accStore = useAccountStore();
    const [ bondingAddress, setBondingAddress ] = useState(false);
    const { showMfaEnrollmentModal } = useMfaEnrollment();
    const { createWallet } = useCreateWallet({
        onSuccess: (async ({wallet}) => {
            // const provider = await wallet.getEthereumProvider()
            try {
                // 判断twitterId是不是纯数字字符串
                if (!/^\d+$/.test(accStore.getAccountInfo?.twitterId)) {
                    console.log('Not twitter account, ignore')
                    return;
                }
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
                console.error('Failed to bond twitter embedded wallet:', error);
                emitter.emit('authError', error);
            }finally {
                setBondingAddress(false);
            }
        }),
        onError: (error) => {
            console.error('Failed to create twitter embedded wallet:', error);
            if (error == 'embedded_wallet_already_exists') {
                console.log('Faild to crate twitter wallet')
                return;
            }
            console.log(222)
            emitter.emit('authError', error);
        }
    })

    useEffect(() => {
        async function checkMfa() {
            if (user && user.mfaMethods.length === 0) {
                console.log('no mfa')
                let count = 0;
                while(count < 10 && !accStore.twitterId) {
                    await sleep(0.5)
                    count++
                }
                if (accStore.getWalletType == 'privy') {
                    showMfaEnrollmentModal().then(() => {
                        window.localStorage.setItem('lastLoginTime', Date.now().toString());
                    })
                }
            }
            console.log('user', user)
        }
        checkMfa()
    }, [user])

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
                const wallet = wallets.find((wallet) => wallet.walletClientType === 'privy' && wallet.type === 'ethereum' && wallet.connectorType === 'embedded')

                if (!wallet) {
                    return;
                }
                const provider = await wallet.getEthereumProvider()
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
            const privyAccessToken = await getAccessToken()
            const userInfo = await privyLogin(privyAccessToken, oAuthTokens.accessToken, oAuthTokens.refreshToken)
            emitter.emit('authSuccess', userInfo)

            const wallet = wallets?.find((wallet) => wallet.walletClientType === 'privy' && wallet.type === 'ethereum' && wallet.connectorType === 'embedded')

            if (!wallet && 
                (
                !userInfo.ethAddr
                || userInfo.walletType === 1
                )) {
                console.log('create new twitter wallet')
                await createWallet()
            }else {
                console.log('no need to create new twitter wallet')
            }
        }
    });
    return (<></>)
}