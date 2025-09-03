import React from "react";
import {useOAuthTokens, usePrivy} from '@privy-io/react-auth';
import {useEffect} from "react";
import {privyLogin} from "@/apis/api.ts";
import emitter from "@/utils/emitter.ts";

export default function Wallet() {
    const {ready, authenticated, user, exportWallet} = usePrivy();
    // Check that your user is authenticated
    const isAuthenticated = ready && authenticated;
    // Check that your user has an embedded wallet
    const hasEmbeddedWallet = !!user.linkedAccounts.find(
        (account) =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.chainType === 'ethereum'
    );

    return (
        <button onClick={exportWallet} disabled={!isAuthenticated || !hasEmbeddedWallet}
                className='h-8 ml-3 bg-gradient-primary rounded-full px-3 text-white text-h5 hover:opacity-90 transition-all duration-200'>
            Export my wallet
        </button>
    );
}