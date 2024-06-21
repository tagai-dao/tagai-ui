import i18n from '@/lang'
import errCode from '@/errCode'
import { ElNotification } from 'element-plus'


const t = i18n.global.t

export const handleTransError = (e: any) => {
    if (!e) {
        console.log('Null error')
        return;
    }
    if (typeof(e) === "number") {
        return handleServerError(e)
    }

    if (e.message.indexOf("insufficient funds for intrinsic transaction cost") !== -1) {
        notify({message: 'Insufficient gas, please charge BTC to your Donut address', type: 'info', duration: 5000})
        return t('tip.insufficientFee')
    } else if (e.message.indexOf('User denied transaction signature') !== -1) {
        notify({message: 'User canceled the transaction', type: 'info', duration: 5000})
        return t('tip.userCanceled')
    } else if (e.message.indexOf('user rejected action') !== -1) {
        notify({message: 'User canceled the signature', type: 'info', duration: 5000})
        return t('tip.userCanceled')
    } else if (e.message.indexOf('User has ipshare') !== -1){
        notify({message: 'User has created IPShare', type: 'info'})
        return 'User has created IPShare'
    } else if (e.message.indexOf('IPShare already created') !== -1) {
        notify({message: 'IPShare already created', type: 'info'})
        return 'IPShare already created'
    } else if((e.message.indexOf('invalid nonce') !== -1) || (e.message.indexOf('invalid signature') !== -1)) {
        notify({message: 'Invalid signature', type: 'info'})
        return 'Invalid signature'
    } else if(e.message.indexOf('Cannot sell the last 10 share') !== -1) {
        notify({message: 'Cannot sell the last 10 shares', type: 'info'})
        return 'Cannot sell the last 10 shares'
    } else {
        notify({message: "Transaction fail!", type: 'error'})
        return t('tip.transFail')
    }
}

export const handleServerError = (code: number) => {
    // TODO - showing server error tips
    switch(code) {
        case errCode.DB_ERROR_CREATE_FAIL:
            notify({message: 'Create fail', type: 'error'})
            break;
        case errCode.DB_ERROR_READ_FAIL:
            notify({message: 'Get data fail', type: 'error'})
            break;
        case errCode.INSUFFICIENT_BALANCE:
            notify({message: 'Insufficient balance', type: 'info'})
            break;
        case errCode.PARAMS_INVALID:
            notify({message: 'Server error', type: 'error'})
            break;
        case errCode.ACCOUNT_MISMATCH:
            notify({message: 'Account mismatch, please chose the binded address', type: 'info'})
            break;
        case errCode.INVALID_ADDRESS_FORMAT:
            notify({message: 'Not supported address format', type: 'info'})
            break;
        case errCode.JWT_AUTH_FAIL:
        case errCode.SIWE_AUTH_FAIL:
        case errCode.BTC_AUTH_FAIL:
            notify({message: "Auththorize fail", type: 'error'})
            break;
        case errCode.SERVER_ERROR:
            notify({message: 'Server error', type: 'error'})
            break;
        case errCode.ASSET_CREATED_SHARE:
            notify({message: 'IPShare has been created', type: 'info'})
            break;
        case errCode.ASSET_ID_NOT_CREATED:
            notify({message: 'IPShare not exists', type: 'info'})
            break;
        case errCode.TWEET_NOT_FOUND:
            notify({message: 'The tweet has been deleted', type: 'info'})
            break;
        case errCode.TWITTER_ERROR:
            notify({message: 'Twitter api issue', type: 'info'})
            break;
        default:
            notify({message: 'Unknown error', type: 'error'})
            break;
    }
}

interface NotifyOptions {
    title?: string;
    message?: string;
    type?: 'success' | 'warning' | 'error' | 'info';
    duration?: number
}

export const notify = (options: Partial<NotifyOptions> = {}) => {
    const defaultTitle = 'Warning';
    const defaultMessage = 'This is a Warning message';
    const defaultType: NotifyOptions['type'] = 'warning';

    const { title = defaultTitle, message = defaultMessage, type = defaultType } = options;
    ElNotification({
        title,
        message,
        type
    });
}
