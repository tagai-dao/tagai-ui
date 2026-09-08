import { optimize } from './math';
import type { Metadata, Snapshot, Plan } from './types';
self.onmessage = (event: MessageEvent<{
    id: number;
    metadata: Metadata;
    snapshot: Snapshot;
    isBuy: boolean;
    amount: bigint;
    previous?: Plan;
}>) => {
    const r = event.data;
    try {
        self.postMessage({ id: r.id, plan: optimize(r.metadata, r.snapshot, r.isBuy, r.amount, r.previous) });
    }
    catch (e) {
        self.postMessage({ id: r.id, error: e instanceof Error ? e.message : 'V13_QUOTE_FAILED' });
    }
};
