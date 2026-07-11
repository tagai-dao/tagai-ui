import React from 'react';
import {PrivyProvider, useOAuthTokens} from '@privy-io/react-auth';
import AuthLoading from "@/react_app/AuthLoading.jsx";
import {PrivyConfig} from "@/config.ts";
import {customBsc, customRobinhood} from "@/utils/privy.ts";
import {bscTestnet, sepolia} from 'viem/chains';
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
                // 产品链：BSC + Robinhood；测试网保留
                defaultChain: customBsc,
                supportedChains: [customBsc, customRobinhood, bscTestnet, sepolia]
            }}
        >
            <AuthLoading/>
            {props.children}
            <PrivyMFAValidator/>
        </PrivyProvider>
    )
}
export default ReactApp
