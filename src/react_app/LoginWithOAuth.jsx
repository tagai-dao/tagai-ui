import {useLoginWithOAuth} from '@privy-io/react-auth';
import {useCallback, useEffect, useRef, useState} from "react";
import emitter from "@/utils/emitter.ts";
import {runNativeBrowserOAuth} from "@/utils/native.ts";

export default function LoginWithOAuth() {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const [ isLoading, setIsLoading] = useState(false);
    const reportedErrorRef = useRef('');

    const reportAuthError = useCallback((error) => {
        const errorKey = [
            error?.privyErrorCode,
            error?.data?.code,
            error?.message ?? String(error ?? '')
        ].filter(Boolean).join(':');

        if (!errorKey || reportedErrorRef.current === errorKey) return;

        reportedErrorRef.current = errorKey;
        emitter.emit('authError', error);
    }, []);

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            reportedErrorRef.current = '';
            window.localStorage.setItem('lastLoginTime', '0');
            await runNativeBrowserOAuth(() => initOAuth({ provider: 'twitter' }));
        } catch (err) {
            console.error(err);
            reportAuthError(err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        console.log('state', state.status)
        console.log('loading', loading)
        if(state.status==="error") {
            reportAuthError(state.error)
            setIsLoading(false);
        }
        if(state.status==="success") {
            setIsLoading(false);
        }
    }, [state, loading, reportAuthError])

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
