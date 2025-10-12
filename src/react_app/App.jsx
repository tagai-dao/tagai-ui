import React from 'react';
import {PrivyProvider, useOAuthTokens} from '@privy-io/react-auth';
import AuthLoading from "@/react_app/AuthLoading.jsx";
import {PrivyConfig} from "@/config.ts";
import {customBsc} from "@/utils/privy.ts";
import PrivyMFAValidator from "@/react_app/PrivyMFAValidator.jsx";

function ReactApp(props) {
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
                supportedChains: [customBsc]
            }}
        >
            <AuthLoading/>
            {props.children}
            <PrivyMFAValidator/>
        </PrivyProvider>
    )
}
export default ReactApp