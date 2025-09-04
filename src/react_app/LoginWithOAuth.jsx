import {useLoginWithOAuth, useOAuthTokens, usePrivy } from '@privy-io/react-auth';
import {useEffect, useState} from "react";
import emitter from "@/utils/emitter.ts";

export default function LoginWithOAuth() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const { logout } = usePrivy();

    const [ isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            await logout();
            await initOAuth({ provider: 'twitter' });
        } catch (err) {
            console.error(err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
        if(state.status==="error") {
            emitter.emit('authError')
            setIsLoading(false);
        }
        if(state.status==="success") {
            setIsLoading(false);
        }
    }, [state, loading])

    return (
        <button onClick={handleLogin} disabled={isLoading}
                className='h-12 w-full bg-gradient-primary rounded-full flex justify-center items-center gap-2'>
            <span className='text-white text-h5'>Log in with Twitter</span>
            {isLoading && (
                // 加载动画，使用 Tailwind CSS 的 animate-spin
               <div className="animate-spin">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="31.416">
                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                    </circle>
                </svg>
               </div>
            )}
        </button>
    );
}