import {useLoginWithOAuth, useOAuthTokens, useWallets, usePrivy, useSignMessage, useCreateWallet} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect, useRef, useState} from "react";
import { bondEthByPrivyAccToken } from '@/apis/api.ts';
import { useAccountStore } from "@/stores/web3";
import {isNativePlatform} from "@/utils/native.ts";
import {usePrivyStore} from "@/stores/privy";
import {findConnectedEmbeddedWallet, ensureConnectedEmbeddedWallet} from './embeddedWallet.mjs';

/** PrivyProvider 已配置 createOnLogin: 'all-users'，嵌入式钱包由 SDK 创建；此处仅在后端仍需绑定时调用 bond API */
export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()
    const { getAccessToken } = usePrivy();
    const { createWallet } = useCreateWallet();
    const { signMessage } = useSignMessage();
    const accStore = useAccountStore();
    const privyStore = usePrivyStore();
    const walletsRef = useRef(wallets);
    walletsRef.current = wallets;

    /** Both login methods use this persistent wallet creation/binding coordinator. */
    const [pendingWalletBinding, setPendingWalletBinding] = useState(null);
    const walletBindingInFlightRef = useRef(false);
    const nativeWalletSmokeConsumedRef = useRef(false);

    const findEmbeddedEthWallet = () =>
        findConnectedEmbeddedWallet(walletsRef.current);

    useEffect(() => {
        const handleWalletBindingRequest = (request) => {
            if (!request?.identity || ![0, 1].includes(request.accountType)) return;
            privyStore.walletBinding = true;
            setPendingWalletBinding(request);
        };

        emitter.on('privyWalletBindingRequested', handleWalletBindingRequest);
        return () => emitter.off('privyWalletBindingRequested', handleWalletBindingRequest);
    }, []);

    /**
     * Email login is rendered inside a modal, but wallet creation can complete
     * after that modal closes. Keep the whole create -> provider -> verified
     * backend binding sequence in this persistent component.
     */
    useEffect(() => {
        if (!pendingWalletBinding || !ready || walletBindingInFlightRef.current) {
            return;
        }

        walletBindingInFlightRef.current = true;
        (async () => {
            try {
                const wallet = await ensureConnectedEmbeddedWallet(
                    () => walletsRef.current, createWallet,
                );

                if (!wallet?.address) {
                    throw new Error('Privy did not return an embedded Ethereum wallet');
                }

                const provider = await wallet.getEthereumProvider();
                privyStore.ethersProvider = provider;
                emitter.emit('walletProvider', provider);

                const { identity, accountType, userInfo } = pendingWalletBinding;
                const backendAddr = userInfo?.ethAddr
                    ? String(userInfo.ethAddr).toLowerCase()
                    : '';
                const needsBinding = backendAddr !== wallet.address.toLowerCase();

                if (needsBinding) {
                    const privyAccessToken = await getAccessToken();
                    if (!privyAccessToken) {
                        throw new Error('Failed to get Privy access token for wallet binding');
                    }

                    // Privy's client wallet can be ready shortly before the
                    // Admin API linked_accounts view. Retry that propagation
                    // window while keeping the binding server-verified.
                    let bindingError;
                    for (let attempt = 0; attempt < 5; attempt += 1) {
                        try {
                            await bondEthByPrivyAccToken(identity, wallet.address, privyAccessToken);
                            bindingError = null;
                            break;
                        } catch (error) {
                            bindingError = error;
                            if (attempt < 4) {
                                await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)));
                            }
                        }
                    }
                    if (bindingError) throw bindingError;
                }

                accStore.setAccount({
                    ...accStore.getAccountInfo,
                    ethAddr: wallet.address,
                    walletType: 1,
                    accountType,
                });
                await privyStore.initWallet();
            } catch (error) {
                console.error('Failed to create or bind embedded wallet:', error);
                emitter.emit('walletError', error);
            } finally {
                privyStore.walletBinding = false;
                walletBindingInFlightRef.current = false;
                setPendingWalletBinding(null);
            }
        })();
    }, [pendingWalletBinding, ready, wallets, getAccessToken, createWallet]);

    // useEffect(() => {
    //     async function checkMfa() {
    //         if (user && user.mfaMethods.length === 0) {
    //             console.log('no mfa')
    //             let count = 0;
    //             while(count < 10 && !accStore.twitterId) {
    //                 await sleep(0.5)
    //                 count++
    //             }
    //             if (accStore.getWalletType == 'privy') {
    //                 showMfaEnrollmentModal().then(() => {
    //                     window.localStorage.setItem('lastLoginTime', Date.now().toString());
    //                 })
    //             }
    //         }
    //         console.log('user', user)
    //     }
    //     checkMfa()
    // }, [user])

    useEffect(() => {
        async function getWalletProvider() {
            if(ready) {
                console.log('wallets', wallets)
                if (wallets.length === 0) {
                    return;
                }
                console.log('wallets2', wallets)
                // The binding coordinator owns provider setup while a login is pending.
                if (pendingWalletBinding) return;
                const wallet = findEmbeddedEthWallet()

                if (!wallet) {
                    return;
                }
                try {
                    const provider = await wallet.getEthereumProvider()
                    // Persist provider state directly as well as emitting the legacy
                    // event, so Vue initialization cannot miss a one-shot event.
                    privyStore.ethersProvider = provider
                    emitter.emit('walletProvider', provider)

                    if (isNativePlatform() && !nativeWalletSmokeConsumedRef.current) {
                        nativeWalletSmokeConsumedRef.current = true;
                        try {
                            const chainId = await provider.request({ method: 'eth_chainId' });
                            const { signature } = await signMessage(
                                { message: `TagAI embedded wallet smoke: ${wallet.address}` },
                                { address: wallet.address }
                            );
                            emitter.emit('walletSmoke', {
                                address: wallet.address,
                                chainId,
                                signature
                            });
                            console.log('Native embedded wallet smoke passed', {
                                address: wallet.address,
                                chainId,
                                signature
                            });
                        } catch (error) {
                            nativeWalletSmokeConsumedRef.current = false;
                            console.error('Native embedded wallet smoke failed:', error);
                        }
                    }

                    console.log(provider)
                } catch (error) {
                    privyStore.walletBinding = false
                    console.error('Failed to initialize embedded wallet provider:', error)
                    emitter.emit('walletError', error)
                }
            }

        }
        getWalletProvider()
    }, [ready, wallets, pendingWalletBinding, signMessage]);

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
    }, [state, loading])

    const {reauthorize} = useOAuthTokens({
        onOAuthTokenGrant: async ({oAuthTokens, user}) => {
            try {
                const privyAccessToken = await getAccessToken()
                if (!privyAccessToken) {
                    console.error('Failed to get Privy access token')
                    emitter.emit('authError', 'Failed to get Privy access token')
                    return
                }
                
                const userInfo = await privyLogin(privyAccessToken, oAuthTokens.accessToken, oAuthTokens.refreshToken)
                
                if (!userInfo) {
                    console.error('privyLogin returned null or undefined')
                    emitter.emit('authError', 'Login failed: No user info returned')
                    return
                }
                
                // 嵌入式钱包由 Privy createOnLogin 创建；wallet 就绪后由 effect 决定是否 bondEthByPrivyAccToken
                if (!userInfo.ethAddr || Number(userInfo.walletType) === 1) {
                    if (!/^\d+$/.test(String(userInfo.twitterId ?? ''))) {
                        throw new Error('Twitter login returned an invalid account identity');
                    }
                    privyStore.walletBinding = true;
                    setPendingWalletBinding({
                        identity: String(userInfo.twitterId),
                        accountType: 0,
                        userInfo,
                    });
                }
                emitter.emit('authSuccess', userInfo)
            } catch (error) {
                console.error('Twitter OAuth token grant error:', error)
                emitter.emit('authError', error)
            }
        }
    });
    return (<></>)
}
