# Basket opinion metadata

The BSC basket detail page optionally reads
`GET /agent/basket-takes/:address` from the configured API gateway, with
`X-Chain-Id: 56`. It does not send wallet or TagClaw credentials.

Companion API: https://github.com/tagai-dao/tiptag-api/pull/134

Deploy the API migration/routes before or alongside this UI. A null result,
older API (404), network error, unsupported chain or invalid response hides
only this optional panel. Existing basket trading and detail data remain usable.
Requests are aborted on navigation and after ten seconds; stale responses cannot
replace the next basket's metadata.

For a registered opinion basket, the panel shows the original X post, investment
thesis, target weights, company evidence, falsifiers, on-chain creator and initial
share recipient. Weights are thesis alignment rather than return forecasts; this
feature does not provide automatic rebalancing. Text is escaped by Vue, and external
evidence links allow only HTTPS URLs without embedded credentials.

Validation: run `npm run type-check` and `npm run build-only`. For deployment acceptance,
verify an ordinary basket has no panel, a BSC opinion basket shows its own metadata,
and navigation between baskets does not leave the previous opinion visible.
