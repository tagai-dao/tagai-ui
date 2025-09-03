import React from 'react';
import {PrivyProvider, useOAuthTokens} from '@privy-io/react-auth';
import AuthLoading from "@/react_app/AuthLoading.jsx";
import {PrivyConfig} from "@/config.ts";

function ReactApp(props) {
    return (
        <PrivyProvider
            appId={PrivyConfig.appId}
            clientId={PrivyConfig.clientId}
            config={{
                // Create embedded wallets for users who don't have a wallet
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'users-without-wallets'
                    }
                }
            }}
        >
            <AuthLoading/>
            {props.children}
        </PrivyProvider>
    )
}
export default ReactApp