export function findConnectedEmbeddedWallet(wallets, address) {
    return wallets.find(wallet =>
        wallet.type === 'ethereum' &&
        (wallet.walletClientType === 'privy' || wallet.connectorType === 'embedded') &&
        typeof wallet.getEthereumProvider === 'function' &&
        (!address || wallet.address?.toLowerCase() === address.toLowerCase())
    );
}

export async function ensureConnectedEmbeddedWallet(getWallets, createWallet, options = {}) {
    let wallet = findConnectedEmbeddedWallet(getWallets());
    if (wallet) return wallet;
    await (options.waitForAutomaticCreation || (() => new Promise(resolve => setTimeout(resolve, 750))))();
    wallet = findConnectedEmbeddedWallet(getWallets());
    if (wallet) return wallet;
    let createdWallet;
    let creationError;
    try {
        createdWallet = await createWallet();
    } catch (error) {
        creationError = error;
    }
    try {
        return await waitForConnectedEmbeddedWallet(getWallets, createdWallet?.address, options);
    } catch (error) {
        throw creationError || error;
    }
}

// createWallet returns account metadata, not a ConnectedWallet. Wait for
// useWallets to publish the matching provider-capable object instead.
export async function waitForConnectedEmbeddedWallet(getWallets, address, {
    attempts = 60,
    wait = () => new Promise(resolve => setTimeout(resolve, 250)),
} = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const wallet = findConnectedEmbeddedWallet(getWallets(), address);
        if (wallet) return wallet;
        await wait();
    }
    const wallet = findConnectedEmbeddedWallet(getWallets(), address);
    if (wallet) return wallet;
    throw new Error('Embedded wallet is still initializing. Please retry from Wallet.');
}
