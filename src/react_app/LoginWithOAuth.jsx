import {useLoginWithOAuth} from '@privy-io/react-auth';
import {useCallback, useEffect, useRef, useState} from "react";
import emitter from "@/utils/emitter.ts";
import {runNativeBrowserOAuth} from "@/utils/native.ts";
import {Capacitor, registerPlugin} from '@capacitor/core';
import {clearBlinkLoginReturn, saveBlinkLoginReturn} from '@/utils/blinkLoginReturn.ts';

export default function LoginWithOAuth({returnPath, label = 'Log in with Twitter', compact = false}) {
    const { state, loading, initOAuth } = useLoginWithOAuth();
    const [ isLoading, setIsLoading] = useState(false);
    const reportedErrorRef = useRef('');
    const startedRef = useRef(false);

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

    useEffect(() => {
        if (Capacitor.getPlatform() !== 'android') return;
        let disposed = false;
        const handles = [];
        const keep = (handle) => disposed ? handle.remove() : handles.push(handle);
        import('@capacitor/app').then(({App}) => App.addListener('appStateChange', ({isActive}) => {
            // Closing Chrome without authorizing must not leave the login button disabled.
            if (isActive) setIsLoading(false);
        })).then(keep);
        registerPlugin('NativeOAuth').addListener('openFailed', () => {
            reportAuthError(new Error('Unable to open authorization. Install or enable Chrome and try again.'));
            setIsLoading(false);
        }).then(keep);
        return () => { disposed = true; handles.forEach(handle => handle.remove()); };
    }, [reportAuthError]);

    const handleLogin = async () => {
        try {
            setIsLoading(true);
            startedRef.current = true;
            reportedErrorRef.current = '';
            // A fresh ordinary login supersedes a cancelled Blinks attempt.
            // Do not clear on component mount: native OAuth remounts on return.
            if (!returnPath) clearBlinkLoginReturn();
            if (returnPath && !saveBlinkLoginReturn(returnPath)) {
                throw new Error('Unable to save the Blinks return page. Allow site storage and try again.');
            }
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
        if(state.status==="error" && startedRef.current) {
            reportAuthError(state.error)
            setIsLoading(false);
        }
        if(state.status==="success") {
            setIsLoading(false);
        }
    }, [state, loading, reportAuthError])

    return (
        <button type="button" onClick={handleLogin} disabled={isLoading}
                className='min-h-12 w-full px-3 py-2 bg-gradient-primary rounded-full flex justify-center items-center gap-2 disabled:opacity-50'>
            <span className={compact ? 'text-white text-sm leading-tight' : 'text-white text-h5'}>{label}</span>
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
