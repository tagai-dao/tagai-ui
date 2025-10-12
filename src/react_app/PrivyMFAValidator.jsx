// src/react_app/TransactionHandler.jsx
import { useMfa } from '@privy-io/react-auth';
import { useEffect } from 'react';
import emitter from '../utils/emitter.ts';

export default function PrivyMFAValidator() {
    const { init, promptMfa } = useMfa();

    useEffect(() => {
        const handleValidateMFA = async () => {
            try {
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