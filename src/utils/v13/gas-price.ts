import type { PublicClient } from 'viem';
const cache = new WeakMap<PublicClient, { value?: bigint; at: number; pending?: Promise<bigint> }>();
// Used for route ranking, not the wallet's eventual transaction fee. Never hard-code a fee.
export function quoteGasPrice(client: PublicClient): Promise<bigint> {
    let entry = cache.get(client);
    if (!entry) { entry = { at: 0 }; cache.set(client, entry); }
    if (entry.value !== undefined && Date.now() - entry.at < 60000) return Promise.resolve(entry.value);
    if (!entry.pending) {
        const target = entry;
        target.pending = client.getGasPrice().then(value => { target.value = value; target.at = Date.now(); return value; })
            .finally(() => { target.pending = undefined; });
    }
    return entry.pending!;
}
