import {useLoginWithOAuth, useOAuthTokens, useWallets, usePrivy, useSignMessage, useCreateWallet} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect, useRef, useState} from "react";
import { bondEthByPrivyAccToken } from '@/apis/api.ts';
import { useAccountStore } from "@/stores/web3";
import {isNativePlatform} from "@/utils/native.ts";
import {usePrivyStore} from "@/stores/privy";

/** PrivyProvider 已配置 createOnLogin: 'all-users'，嵌入式钱包由 SDK 创建；此处仅在后端仍需绑定时调用 bond API */
export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()
    const { getAccessToken } = usePrivy();
    const { createWallet } = useCreateWallet();
    const { signMessage } = useSignMessage();
    const accStore = useAccountStore();
    const privyStore = usePrivyStore();
    const [ bondingAddress, setBondingAddress ] = useState(false);
    const walletsRef = useRef(wallets);
    walletsRef.current = wallets;

    /** 最近一次 Twitter OAuth + privyLogin 返回的 userInfo，用于钱包就绪后补绑 */
    const [oauthTwitterSession, setOauthTwitterSession] = useState(null);
    /** Email login modal unmounts after authSuccess, so its pending wallet work lives here. */
    const [pendingEmailWalletBinding, setPendingEmailWalletBinding] = useState(null);
    const emailWalletBindingInFlightRef = useRef(false);
    /** 本会话是否已处理过「钱包就绪后的绑定点」（避免 StrictMode / 重复 effect 二次提交） */
    const oauthTwitterBondConsumedRef = useRef(false);
    const nativeWalletSmokeConsumedRef = useRef(false);

    const findEmbeddedEthWallet = () =>
        walletsRef.current.find((w) =>
            w.type === 'ethereum' &&
            (w.walletClientType === 'privy' || w.connectorType === 'embedded')
        );

    useEffect(() => {
        const handleWalletBindingRequest = (request) => {
            if (!request?.identity || request?.accountType !== 1) return;
            privyStore.walletBinding = true;
            setPendingEmailWalletBinding(request);
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
        if (!pendingEmailWalletBinding || !ready || emailWalletBindingInFlightRef.current) {
            return;
        }

        emailWalletBindingInFlightRef.current = true;
        (async () => {
            try {
                let wallet = findEmbeddedEthWallet();
                if (!wallet) {
                    // Give createOnLogin a short opportunity to publish its
                    // result before invoking the explicit fallback, avoiding
                    // two concurrent wallet-creation requests.
                    await new Promise(resolve => window.setTimeout(resolve, 750));
                    wallet = findEmbeddedEthWallet();
                }
                if (!wallet) {
                    // createOnLogin normally handles this. Explicit creation is
                    // required for accounts whose automatic creation is delayed
                    // or was interrupted by the login modal closing.
                    wallet = await createWallet();
                }

                if (!wallet?.address) {
                    throw new Error('Privy did not return an embedded Ethereum wallet');
                }

                const provider = await wallet.getEthereumProvider();
                privyStore.ethersProvider = provider;
                emitter.emit('walletProvider', provider);

                const { identity, accountType, userInfo } = pendingEmailWalletBinding;
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
                console.error('Failed to create or bind email embedded wallet:', error);
                emitter.emit('walletError', error);
            } finally {
                privyStore.walletBinding = false;
                emailWalletBindingInFlightRef.current = false;
                setPendingEmailWalletBinding(null);
            }
        })();
    }, [pendingEmailWalletBinding, ready, wallets, getAccessToken, createWallet]);

    /**
     * createOnLogin 完成后 wallets 才出现；在此阶段按需 bond（替代原来的 createWallet + onSuccess）
     */
    useEffect(() => {
        const sessionInfo = oauthTwitterSession;
        if (!sessionInfo || oauthTwitterBondConsumedRef.current || !ready) {
            return;
        }

        const wallet = findEmbeddedEthWallet();
        if (!wallet) {
            return;
        }

        oauthTwitterBondConsumedRef.current = true;

        const twitterId = sessionInfo.twitterId;
        if (!/^\d+$/.test(twitterId ?? '')) {
            return;
        }

        const eligibleForPrivyBond = !sessionInfo.ethAddr || sessionInfo.walletType === 1;
        const backendAddr = sessionInfo.ethAddr ? String(sessionInfo.ethAddr).toLowerCase() : '';
        const needBond =
            eligibleForPrivyBond &&
            (!sessionInfo.ethAddr || backendAddr !== wallet.address.toLowerCase());

        if (!needBond) {
            privyStore.walletBinding = false;
            return;
        }

        // 先于 await，避免 getWalletProvider 在 bondingAddress 仍为 false 时抢跑
        setBondingAddress(true);
        (async () => {
            try {
                const privyAccessToken = await getAccessToken();
                if (!privyAccessToken) {
                    console.error('Failed to get Privy access token for bondEthByPrivyAccToken');
                    emitter.emit('authError', 'Failed to get Privy access token');
                    return;
                }
                await bondEthByPrivyAccToken(twitterId, wallet.address, privyAccessToken);
                accStore.setAccount({
                    ...accStore.getAccountInfo,
                    ethAddr: wallet.address,
                    walletType: 1,
                    accountType: 0
                });
            } catch (error) {
                console.error('Failed to bond twitter embedded wallet:', error);
                emitter.emit('walletError', error);
            } finally {
                privyStore.walletBinding = false;
                setBondingAddress(false);
            }
        })();
    }, [ready, wallets, getAccessToken, oauthTwitterSession]);
    useEffect(() => {
        if (!oauthTwitterSession) return undefined;

        const timer = window.setTimeout(() => {
            if (!oauthTwitterBondConsumedRef.current) {
                privyStore.walletBinding = false;
                emitter.emit(
                    'walletError',
                    new Error('Embedded wallet is still initializing. Please retry from Wallet.')
                );
            }
        }, 15000);

        return () => window.clearTimeout(timer);
    }, [oauthTwitterSession]);

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
                // This effect reruns when bondingAddress becomes false. Waiting
                // in-place would capture the old true value and loop forever.
                if (bondingAddress) return;
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
    }, [ready, wallets, bondingAddress, signMessage]);

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
    }, [state, loading])

    const {reauthorize} = useOAuthTokens({
        onOAuthTokenGrant: async ({oAuthTokens, user}) => {
            try {
                console.log(
                    'Twitter auth success',
                    oAuthTokens,
                    user
                );
                const privyAccessToken = await getAccessToken()
                if (!privyAccessToken) {
                    console.error('Failed to get Privy access token')
                    emitter.emit('authError', 'Failed to get Privy access token')
                    return
                }
                
                console.log('Calling privyLogin with:', {
                    privyAccessToken: privyAccessToken.substring(0, 20) + '...',
                    accessToken: oAuthTokens.accessToken?.substring(0, 20) + '...',
                    refreshToken: oAuthTokens.refreshToken?.substring(0, 20) + '...'
                })
                
                const userInfo = await privyLogin(privyAccessToken, oAuthTokens.accessToken, oAuthTokens.refreshToken)
                
                if (!userInfo) {
                    console.error('privyLogin returned null or undefined')
                    emitter.emit('authError', 'Login failed: No user info returned')
                    return
                }
                
                console.log('Login success, userInfo:', userInfo)
                // 嵌入式钱包由 Privy createOnLogin 创建；wallet 就绪后由 effect 决定是否 bondEthByPrivyAccToken
                oauthTwitterBondConsumedRef.current = false;
                privyStore.walletBinding = true;
                setOauthTwitterSession(userInfo);
                emitter.emit('authSuccess', userInfo)
            } catch (error) {
                console.error('Twitter OAuth token grant error:', error)
                emitter.emit('authError', error)
            }
        }
    });
    return (<></>)
}
