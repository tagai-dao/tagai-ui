import { getChainDeployment } from '@/config/chains';
import { get } from '@/apis/axios';
import { API_BASE_URL } from '@/config/api';
import { getReadOnlyClient, getWalletClient, setup } from '@/utils/wallets';
import { useChainStore } from '@/stores/chain';
import { useAccountStore } from '@/stores/web3';
import { parseAbi, isAddress, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import tradeAbi from './TradeRouter.json';
import { loadSnapshot } from './snapshot';
import { QuoteError, type Metadata, type Snapshot, type Plan, type Leg } from './types';
const ERC20 = parseAbi(['function allowance(address,address) view returns(uint256)', 'function approve(address,uint256) returns(bool)']);
export type Quote = {
    metadata: Metadata;
    snapshot: Snapshot;
    plan: Plan;
};
export function createQuoteSession() {
    let metadata: Metadata | undefined, snapshot: Snapshot | undefined, previous: Plan | undefined, worker: Worker | undefined;
    let generation = 0;
    let rejectPending: ((reason: Error) => void) | undefined;
    let metadataPending: {
        key: string;
        promise: Promise<Metadata>;
    } | undefined, snapshotPending: {
        key: string;
        promise: Promise<Snapshot>;
    } | undefined;
    const cancel = () => { generation++; worker?.terminate(); worker = undefined; rejectPending?.(new QuoteError('V13_QUOTE_CANCELLED')); rejectPending = undefined; };
    const reset = () => { cancel(); metadata = undefined; snapshot = undefined; previous = undefined; metadataPending = undefined; snapshotPending = undefined; };
    async function quote(token: Address, isBuy: boolean, amount: bigint): Promise<Quote> {
        cancel();
        const id = generation;
        if (metadata && metadata.token.toLowerCase() !== token.toLowerCase()) {
            metadata = undefined;
            snapshot = undefined;
            previous = undefined;
        }
        if (!metadata || Date.now() - metadata.generatedAt > (metadata.listed ? 60000 : 3000)) {
            const key = token.toLowerCase();
            if (metadataPending?.key !== key)
                metadataPending = { key, promise: (async () => {
                        let r: any;
                        try {
                            r = await get(`${API_BASE_URL}/pump/v13/metadata/${token}`, {}, {
                                headers: { 'X-Chain-Id': '56' }, timeout: 10_000, 'axios-retry': { retries: 0 },
                            });
                        } catch {
                            throw new QuoteError('V13_METADATA_UNAVAILABLE');
                        }
                        if (r?.c !== 0 || !r?.d || r.d.token.toLowerCase() !== key)
                            throw new QuoteError('V13_METADATA_UNAVAILABLE');
                        return { ...r.d, executor: getChainDeployment(56).contracts.tradeRouter13 ?? null } as Metadata;
                    })() };
            const pending = metadataPending;
            let value: Metadata;
            try {
                value = await pending.promise;
            }
            catch (e) {
                if (metadataPending === pending)
                    metadataPending = undefined;
                throw e;
            }
            if (id !== generation)
                throw new QuoteError('V13_QUOTE_CANCELLED');
            metadata = value;
            snapshot = undefined;
            if (metadataPending === pending)
                metadataPending = undefined;
        }
        if (id !== generation)
            throw new QuoteError('V13_QUOTE_CANCELLED');
        if (!snapshot || Date.now() - snapshot.fetchedAt > 10000) {
            const client = getReadOnlyClient(56);
            const key = metadata.configHash;
            if (!snapshotPending || snapshotPending.key !== key)
                snapshotPending = { key, promise: ((m: Metadata) => client.getGasPrice().then(gas => loadSnapshot(client, m, gas)))(metadata) };
            const pending = snapshotPending;
            let value: Snapshot;
            try {
                value = await pending.promise;
            }
            catch (e) {
                if (snapshotPending === pending)
                    snapshotPending = undefined;
                throw e;
            }
            if (id !== generation)
                throw new QuoteError('V13_QUOTE_CANCELLED');
            snapshot = value;
            if (snapshotPending === pending)
                snapshotPending = undefined;
        }
        if (id !== generation)
            throw new QuoteError('V13_QUOTE_CANCELLED');
        const m = metadata, s = snapshot;
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        const plan = await new Promise<Plan>((resolve, reject) => {
            rejectPending = reject;
            worker!.onmessage = e => { if (e.data.id !== id)
                return; rejectPending = undefined; e.data.error ? reject(new QuoteError(e.data.error)) : resolve(e.data.plan); };
            worker!.onerror = () => reject(new QuoteError('V13_QUOTE_FAILED'));
            worker!.postMessage({ id, metadata: m, snapshot: s, isBuy, amount, previous });
        });
        worker?.terminate();
        worker = undefined;
        if (id !== generation)
            throw new QuoteError('V13_QUOTE_CANCELLED');
        previous = plan;
        return { metadata: m, snapshot: s, plan };
    }
    return { quote, cancel, reset };
}
export function buildTrade(q: Quote, subject: Address, recipient: Address, slippageBps: number) {
    if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000)
        throw new QuoteError('V13_INVALID_SLIPPAGE');
    const minimum = (n: bigint) => { const value = n * BigInt(10000 - slippageBps) / 10000n; return value > 0n ? value : 1n; };
    const p = q.plan;
    const legs: Leg[] = p.legs.map(l => ({ routeIndex: l.index, amountIn: l.amount, minIntermediateOut: l.index === 0 ? 0n : minimum(l.intermediate),
        minAmountOut: minimum(l.output), routeHash: q.snapshot.hashes[`${l.index}:${p.isBuy}`] }));
    const deadline = BigInt(q.snapshot.timestamp + 120);
    const args = p.isBuy ? [q.metadata.token, legs, minimum(p.amountOut), deadline, recipient, subject]
        : [q.metadata.token, p.amountIn, legs, minimum(p.amountOut), deadline, recipient, subject];
    return { address: q.metadata.executor!, abi: tradeAbi as Abi, functionName: p.isBuy ? 'buy' : 'sell', args, value: p.isBuy ? p.amountIn : 0n };
}
export async function executeQuote(q: Quote, subject: Address, slippageBps: number): Promise<Hex> {
    const account = useAccountStore().ethConnectAddress as Address;
    const guard = () => {
        if (!isAddress(account ?? ''))
            throw new QuoteError('V13_ACCOUNT_CHANGED');
        if (useChainStore().activeChainId !== 56 || useAccountStore().ethConnectAddress?.toLowerCase() !== account.toLowerCase())
            throw new QuoteError('V13_ACCOUNT_CHANGED');
        if (Date.now() - q.snapshot.fetchedAt > 60000)
            throw new QuoteError('V13_QUOTE_EXPIRED');
        if (!q.snapshot.executable || !q.metadata.executor || q.metadata.executor === zeroAddress
            || q.metadata.executor.toLowerCase() !== getChainDeployment(56).contracts.tradeRouter13?.toLowerCase())
            throw new QuoteError('V13_EXECUTOR_UNAVAILABLE');
    };
    guard();
    const client = getReadOnlyClient(56), wallet = getWalletClient();
    if (!wallet)
        throw new QuoteError('V13_ACCOUNT_CHANGED');
    if (useAccountStore().getWalletType !== 'privy')
        await setup();
    guard();
    const send = async (tx: any): Promise<Hex> => {
        guard();
        const { request } = await client.simulateContract({ ...tx, account } as any);
        const gas = await client.estimateContractGas({ ...tx, account } as any);
        guard();
        const hash = await wallet.writeContract({ ...request, account, chain: client.chain, gas: gas * 120n / 100n } as any);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success')
            throw new QuoteError('V13_TRANSACTION_FAILED');
        return hash;
    };
    if (!q.plan.isBuy) {
        const allowance = await client.readContract({ address: q.metadata.token, abi: ERC20, functionName: 'allowance', args: [account, q.metadata.executor!] });
        if (allowance < q.plan.amountIn) {
            guard();
            await send({ address: q.metadata.token, abi: ERC20, functionName: 'approve', args: [q.metadata.executor!, q.plan.amountIn] });
        }
    }
    guard();
    const tx = buildTrade(q, subject, account, slippageBps);
    return send(tx);
}
