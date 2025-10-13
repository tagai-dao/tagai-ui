// src/react_app/TransactionHandler.jsx
import { useMfa, usePrivy, useMfaEnrollment } from '@privy-io/react-auth';
import { useEffect } from 'react';
import emitter from '../utils/emitter.ts';

export default function PrivyMFAValidator() {
    const { init, promptMfa } = useMfa();
    const { user } = usePrivy();
    const { showMfaEnrollmentModal } = useMfaEnrollment();

    useEffect(() => {
        const handleValidateMFA = async () => {
            try {
                if (user && user.mfaMethods.length == 0) {
                    showMfaEnrollmentModal().then(() => {
                        window.localStorage.setItem('lastLoginTime', Date.now().toString());
                        emitter.emit('MFAValidated');
                    }).catch((error) => {
                        console.error('Failed to show MFA enrollment modal:', error);
                        emitter.emit('MFAValidationFailed', error);
                    })
                    return;
                }
                console.log('Sending transaction via Privy SDK...');
                
                const options = await init('passkey');

                console.log('options', options)

                // Submit will trigger the system's native passkey prompt
                await promptMfa();
                
                console.log('Transaction sent:');
                emitter.emit('MFAValidated');
            } catch (error) {
                console.error('Transaction failed:', error);
                emitter.emit('MFAValidationFailed', error);
            }
        };

        emitter.on('MFAValidationRequired', handleValidateMFA);

        return () => {
            emitter.off('MFAValidationRequired', handleValidateMFA);
        };
    });

    return null;
}