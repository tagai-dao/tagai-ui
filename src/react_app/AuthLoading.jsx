import {useLoginWithOAuth, useOAuthTokens, useWallets} from "@privy-io/react-auth";
import {privyLogin} from "../apis/api.ts";
import emitter from "../utils/emitter.ts";
import {useEffect} from "react";

export default function AuthLoading() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const {wallets, ready} = useWallets()

    useEffect(() => {
        async function getWalletProvider() {
            if(ready) {
                console.log(ready, wallets)
                const provider = await wallets[0].getEthereumProvider()
                emitter.emit('walletProvider', provider)
                console.log(provider)
            }

        }
        getWalletProvider()
    }, [ready]);

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
    }, [state, loading])

    const {reauthorize} = useOAuthTokens({
        onOAuthTokenGrant: async ({oAuthTokens}) => {
            console.log(
                oAuthTokens.provider,
                oAuthTokens.accessToken,
                oAuthTokens.accessTokenExpiresInSeconds,
                oAuthTokens.refreshToken,
                oAuthTokens.refreshTokenExpiresInSeconds,
                oAuthTokens.scopes
            );
            const userInfo = await privyLogin(oAuthTokens.accessToken, oAuthTokens.refreshToken)
            emitter.emit('authSuccess', userInfo)
        }
    });
    return (<></>)
}