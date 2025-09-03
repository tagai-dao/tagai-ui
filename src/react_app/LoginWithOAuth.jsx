import {useLoginWithOAuth, useOAuthTokens} from '@privy-io/react-auth';
import {useEffect} from "react";
import emitter from "@/utils/emitter.ts";

export default function LoginWithOAuth() {
    const { state, loading, initOAuth } = useLoginWithOAuth();

    const handleLogin = async () => {
        try {
            await initOAuth({ provider: 'twitter' });
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
        if(state.status==="error") {
            emitter.emit('authError')
        }
    }, [state, loading])


    return (
        <button onClick={handleLogin} disabled={loading}
                className='h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2'>
            <span className='text-white text-h5'>Log in with Twitter new</span>
        </button>
    );
}