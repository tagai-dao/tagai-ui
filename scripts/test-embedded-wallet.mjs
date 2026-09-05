import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findConnectedEmbeddedWallet, waitForConnectedEmbeddedWallet, ensureConnectedEmbeddedWallet } from '../src/react_app/embeddedWallet.mjs';

const metadata = { type: 'ethereum', walletClientType: 'privy', address: '0xAbC' };
const connected = { ...metadata, getEthereumProvider: async () => ({}) };

test('new account creates a missing wallet and waits for its connected instance', async () => {
    let wallets = [];
    let creations = 0;
    const wallet = await ensureConnectedEmbeddedWallet(() => wallets, async () => {
        creations += 1;
        return metadata;
    }, {
        waitForAutomaticCreation: async () => {},
        wait: async () => { wallets = [connected]; },
        attempts: 2,
    });
    assert.equal(wallet, connected);
    assert.equal(creations, 1);
});

test('automatic creation and existing wallets do not trigger another creation', async () => {
    let wallets = [];
    const create = async () => { assert.fail('must reuse existing wallet'); };
    const options = { waitForAutomaticCreation: async () => { wallets = [connected]; } };
    assert.equal(await ensureConnectedEmbeddedWallet(() => wallets, create, options), connected);
    assert.equal(await ensureConnectedEmbeddedWallet(() => wallets, create, options), connected);
});

test('creation errors are preserved unless a connected wallet becomes available', async () => {
    const failure = new Error('wallet creation failed');
    const create = async () => { throw failure; };
    const options = { waitForAutomaticCreation: async () => {}, wait: async () => {}, attempts: 1 };
    await assert.rejects(ensureConnectedEmbeddedWallet(() => [], create, options), error => error === failure);
    let wallets = [];
    assert.equal(await ensureConnectedEmbeddedWallet(() => wallets, create, {
        ...options, wait: async () => { wallets = [connected]; },
    }), connected);
});

test('creation metadata cannot be used as a connected wallet', () => {
    assert.equal(findConnectedEmbeddedWallet([metadata]), undefined);
    assert.equal(findConnectedEmbeddedWallet([connected], '0xabc'), connected);
    assert.equal(findConnectedEmbeddedWallet([{ ...connected, walletClientType: 'metamask' }]), undefined);
});

test('waits for the created address instead of using another wallet', async () => {
    let wallets = [{ ...connected, address: '0xdef' }, metadata];
    const result = await waitForConnectedEmbeddedWallet(() => wallets, metadata.address, {
        attempts: 2,
        wait: async () => { wallets = [connected]; },
    });
    assert.equal(result, connected);
    assert.deepEqual(await result.getEthereumProvider(), {});
});

test('recovers when automatic creation publishes the connected wallet', async () => {
    let wallets = [];
    assert.equal(await waitForConnectedEmbeddedWallet(() => wallets, undefined, {
        attempts: 2, wait: async () => { wallets = [connected]; },
    }), connected);
});

test('times out when only metadata is available', async () => {
    await assert.rejects(waitForConnectedEmbeddedWallet(() => [metadata], metadata.address, {
        attempts: 2, wait: async () => {},
    }), /still initializing/);
});
