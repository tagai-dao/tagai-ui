import React from 'react';
import {PrivyProvider, useOAuthTokens} from '@privy-io/react-auth';
import AuthLoading from "@/react_app/AuthLoading.jsx";
import {PrivyConfig} from "@/config.ts";
import {customBsc, supportedChains} from "@/utils/privy.ts";
import {bscTestnet, sepolia} from 'viem/chains';
import PrivyMFAValidator from "@/react_app/PrivyMFAValidator.jsx";
import {isNativePlatform, NATIVE_OAUTH_REDIRECT_URL} from "@/utils/native.ts";

function ReactApp(props) {
    // Privy 仅接受 http(s) redirect：回跳先到托管跳板页，再由其深链转发回 App（tagai://auth-callback）
    const customOAuthRedirectUrl = isNativePlatform() ? NATIVE_OAUTH_REDIRECT_URL : undefined;

    return (
        <PrivyProvider
            appId={PrivyConfig.appId}
            clientId={PrivyConfig.clientId}
            config={{
                // Create embedded wallets for users who don't have a wallet
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'all-users'
                    }
                },
                // Include all supported chains: mainnet and testnets
                supportedChains: [customBsc, bscTestnet, sepolia],
                customOAuthRedirectUrl
            }}
        >
            <AuthLoading/>
            {props.children}
            <PrivyMFAValidator/>
        </PrivyProvider>
    )
}
export default ReactApp
