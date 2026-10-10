# UI agent rules

All agents must follow the workspace and global AGENTS.md rules. Every batch of contract reads on every chain must use on-chain Multicall. Promise.all of individual reads, JSON-RPC arrays, and per-contract RPC fallbacks are prohibited. Pin dependent stages and chunks to one block, validate required child results, and verify the Multicall target and calls in tests.

RH V14 uses chain 4663, its own deployed contracts/ABIs and Uniswap V4 state layout. BSC V13/V14 and RH V9/V11 remain supported. Select trusted deployment addresses in frontend config, never from an API-selected executor. Scope quotes, registration queues and wallets by chain, and invalidate stale results on chain/account changes. RH trade-reward signing and AI deployment remain separate unfinished backend features; do not expose them as operational.

Independent RH Basket V3 creation uses its USDG stock pool catalogue, separate from Pump V14. Verify pool depth, canonical factory/state and Hook permissions; label the actual quote currency and preserve it with the full PoolKey in drafts. All multi-leg quotes and validations use fixed-block Multicall stages. See docs/RH_BASKET_USDG.md for discovery, validation and deployment records.
