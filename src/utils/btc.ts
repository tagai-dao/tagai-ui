
export type BtcWallet = {
    btcAddr: string,
    btcPubkey: string
}

export async function connectUnisat() {
    if (typeof window.unisat === 'undefined') {
        window.open('https://chromewebstore.google.com/detail/unisat-wallet/ppbibelpcjmhbdihakflkdcoccbgbkpo?hl=zh-CN&utm_source=ext_sidebar', '__blank');
        return false
    }

    try {
        const unisat = window.unisat;
        await unisat.switchNetwork('livenet')
        const accounts = await unisat.requestAccounts()
        const btcPubkey = await unisat.getPublicKey()
        return {
            btcAddr: accounts[0],
            btcPubkey
        } as BtcWallet
    } catch (error) {
        console.log('connect unisat fail', error);
        return false
    }
}

export async function signMessage(message: string) {
    const wallet = window.unisat
    return await wallet.signMessage(message);
}