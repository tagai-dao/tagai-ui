import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/transactionConfirmation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { confirmTransaction, SubmittedTransactionError } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const hash = `0x${'a'.repeat(64)}`;

test('successful receipt stays successful for every wallet and token route', async () => {
    assert.equal(await confirmTransaction(hash, async () => ({ status: 'success' })), hash);
});
test('only an explicitly reverted receipt returns failure', async () => {
    assert.equal(await confirmTransaction(hash, async () => ({ status: 'reverted' })), null);
});
test('transient archive/RPC error followed by success does not fail the trade', async () => {
    let reads = 0;
    assert.equal(await confirmTransaction(hash, async () => {
        if (++reads === 1) throw new Error('Archive requests require a personal token');
        return { status: 'success' };
    }, 1000, 1), hash);
    assert.equal(reads, 2);
});
test('missing receipt is pending, then recovers', async () => {
    let reads = 0;
    assert.equal(await confirmTransaction(hash, async () => ++reads === 1 ? null : { status: 'success' }, 1000, 1), hash);
});
test('persistent RPC error preserves submitted hash instead of reporting failed transaction', async () => {
    await assert.rejects(confirmTransaction(hash, async () => { throw new Error('offline'); }, 20, 1), error => {
        assert.ok(error instanceof SubmittedTransactionError);
        assert.equal(error.transactionHash, hash);
        assert.match(error.message, /Do not submit it again/);
        return true;
    });
});
test('a hanging lookup has a bounded confirmation deadline', async () => {
    await assert.rejects(confirmTransaction(hash, () => new Promise(() => {}), 20), SubmittedTransactionError);
});
test('Privy explicitly uses configured product-chain RPCs, not a SDK default', () => {
    const privy = readFileSync(new URL('../src/utils/privy.ts', import.meta.url), 'utf8');
    for (const chain of ['BSC_CHAIN', 'ROBINHOOD_CHAIN']) {
        assert.ok(privy.includes(`privyWalletOverride: { http: [${chain}.rpc] }`));
    }
    const chains = readFileSync(new URL('../src/config/chains.ts', import.meta.url), 'utf8');
    assert.ok(!chains.includes('https://bsc-rpc.publicnode.com'));
    const wallets = readFileSync(new URL('../src/utils/wallets.ts', import.meta.url), 'utf8');
    assert.ok(!wallets.includes('wallet.waitForTransactionReceipt('));
    assert.ok(wallets.includes('wallet.getTransactionReceipt({ hash })'));
});
