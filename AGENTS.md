# UI agent rules

All agents must follow the workspace and global AGENTS.md rules. Every batch of contract reads on every chain must use on-chain Multicall. Promise.all of individual reads, JSON-RPC arrays, and per-contract RPC fallbacks are prohibited. Pin dependent stages and chunks to one block, validate required child results, and verify the Multicall target and calls in tests.

RH V14 uses chain 4663, its own deployed contracts/ABIs and Uniswap V4 state layout. BSC V13/V14 and RH V9/V11 remain supported. Select trusted deployment addresses in frontend config, never from an API-selected executor. Scope quotes, registration queues and wallets by chain, and invalidate stale results on chain/account changes. RH trade-reward signing and AI deployment remain separate unfinished backend features; do not expose them as operational.
