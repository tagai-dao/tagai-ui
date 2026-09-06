# Home / Token / Wallet loading fixes

Companion API branch: `fix/loading-market-wallet` (based on `origin/bsc`).
UI base includes merged NFT status PR #153.

## Changes

- Home Feed publishes posts and trade rows independently; RPC enrichment is background-only. It cannot copy trade identities/amounts from another trade in the same token. Stale refreshes and pagination results are guarded.
- Native USD price and imported-community requests are coalesced by chain while in flight, with isolated response objects. Explicit chain headers survive retries.
- Imported cards use API metrics when present, avoiding a redundant per-browser RPC fan-out. Optional price-source failure does not discard other sources or already-visible rows. Gecko metadata fetch is bounded to 8 seconds per batch.
- Token lists display API rows before optional pricing. RH stock classification does not block the first API-backed list on router RPC checks. Visible stock lists refresh at most once a minute.
- Market-cap visibility no longer gates the 24h label. Missing data is shown as unavailable, not fabricated zero.
- Basket initial loading ends only after the complete ranked list is ready. API performance snapshots and RPC valuation run concurrently; snapshots remain a fallback if RPC fails. Existing rows remain during manual refresh.
- Wallet USD valuation is reactive to balance, native price and holdings; native-only wallets no longer return early. Token decimals and imported balance address casing are respected. Native RPC errors retain the last successful balance.
- NFT contract reads use bounded JSON-RPC HTTP batches; background refreshes do not overlap and pause in hidden tabs. A failed block-height read does not discard pool data. Reward summaries and APR quotes cannot block the market or artwork. Failed critical reads show retry/unavailable instead of a zero-price market, and preserve previously loaded data. Mint/AMM actions re-read their native fees before the existing transaction simulation.

## Manual acceptance (after both deployments)

On both `/bsc` and `/rh`, test cold load, warm load, source switching and throttled/failed requests. Check:

1. Feed posts render even while the trade endpoint or RPC is pending. X/FOMO/GMGN/Pump membership and Buy/Sell records remain correct.
2. Token/Stocks market-cap and 24h data reflect the API; unavailable providers remain `—`. No unhandled rejection from background ticker or native-price refresh.
3. Basket leading cards are present in their final positions on first display; they do not move up from zero-AUM shells a few seconds later.
4. Native-only BNB/ETH wallets show balance × current native USD price. Later balance/price changes update the value without reopening Wallet. Include non-18-decimal token holdings.
5. Open HBTC Play → NFT and the BSC NFT market. Test block RPC failure, slow rewards/APR calls, repeated refresh and chain switching. Verify header prices and preview; first-load failure must offer Retry, not a zero-price trading form. Test transaction simulation with a connected wallet before approving production rollout.

Unit tests and build checks do not replace logged-in mobile or production network verification. No server deployment or wallet transaction is included in this local change.
