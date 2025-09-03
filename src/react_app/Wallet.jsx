import React from "react";
import {useOAuthTokens, usePrivy} from '@privy-io/react-auth';
import {useEffect, useState} from "react";

export default function Wallet() {
    const {ready, authenticated, user, exportWallet} = usePrivy();
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [hasEmbeddedWallet, setEmbeddedWallet] = useState(false)

    useEffect(() => {
        if(ready && authenticated) {
            setIsAuthenticated(ready && authenticated)
            const hasEmbeddedWallet = !!user.linkedAccounts.find(
                (account) =>
                    account.type === 'wallet' &&
                    account.walletClientType === 'privy' &&
                    account.chainType === 'ethereum'
            );
            setEmbeddedWallet(hasEmbeddedWallet)
        }
    }, [ready, authenticated])

    return (
        <button onClick={exportWallet} disabled={!isAuthenticated || !hasEmbeddedWallet}
                className='h-8 ml-3 bg-gradient-primary rounded-full px-3 text-white text-h5 hover:opacity-90 transition-all duration-200'>
            Export my wallet
        </button>
    );
}