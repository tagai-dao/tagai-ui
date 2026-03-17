# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TagAI (tagai.fun) is a social fair launch and trading platform built on BSC (BNB Smart Chain). It combines social features (tweets, curation, tipping, mindshare tracking) with DeFi (token bonding curves, PancakeSwap V4 integration, prediction markets via FPMM, IP shares).

## Build & Dev Commands

- `npm run dev` — Start dev server (Vite, binds to 0.0.0.0)
- `npm run build` — Type-check + production build (runs `vue-tsc` then `vite build`)
- `npm run build-only` — Production build without type checking
- `npm run type-check` — Run `vue-tsc --build --force`
- `npm run lint` — ESLint with auto-fix across Vue/TS/JS files
- `npm run preview` — Preview production build

## Architecture

### Vue + React Hybrid (Veaury)

The app is primarily **Vue 3** but embeds **React components** via [veaury](https://github.com/nicepkg/veaury). React is used specifically for Privy authentication (`src/react_app/`), since Privy's SDK is React-only. The veaury plugin replaces the standard vue/react Vite plugins. Use `applyPureReactInVue()` to wrap React components for use in Vue templates.

### Key Directories

- `src/apis/` — HTTP layer: `axios.ts` (configured client with auth interceptor, retry), `api.ts` (all backend API calls against `BACKEND_API_URL`)
- `src/stores/` — Pinia stores: `web3.ts` (account, wallet state, token holdings), `common.ts` (global modals, app state), `privy.ts`, `wallet.ts`, `tweets.ts`, `community.ts`, `curation.ts`, `clanker.ts`
- `src/composables/` — Vue composables: `useAccount`, `useTweet`, `useCreateTweet`, `usePost`, `usePredict`, `useUploadImg`, `useTools`, etc.
- `src/utils/` — Business logic utilities: `pump.ts` (bonding curve/token trading), `contract.ts` (smart contract interactions), `fpmm.ts` (prediction market logic), `ipshare.ts` (IP share contracts), `wallets.ts` (wallet plugin init), `web3.ts` (chain utils), `abis.ts` (contract ABIs), `notify.ts` (toast notifications), `pcsV4Swap.ts` (PancakeSwap V4), `helper.ts` (general helpers)
- `src/views/` — Page-level components matching routes
- `src/components/` — Shared components organized by domain: `common/`, `home/`, `login/`, `profile/`, `tweets/`
- `src/layout/` — App shell: `Layout.vue` (main layout with modal system), `TopBar.vue`, `TabBar.vue`, `Sidebar.vue`
- `src/react_app/` — React components for Privy auth (PrivyProvider wrapper, login flows, embedded wallet)
- `src/types/` — TypeScript type definitions (all domain types: Account, Tweet, Community, IPShare, predictions, etc.)
- `src/config.ts` — All smart contract addresses, chain config, fee constants, token supply config
- `src/lang/` — i18n (vue-i18n): `en.json` and `zh.json`

### Global Modal System

Modals are managed via `useModalStore` (Pinia) with `GlobalModalType` enum. Components in Layout.vue conditionally render modals (CreateCoin, Login, BondEth, PredictTrade, etc.) based on `modalStore.modalType`.

### Authentication Flow

1. User authenticates via Privy (React component) — supports Twitter OAuth and email
2. On success, account info is stored in `useAccountStore` and persisted to localStorage
3. Axios interceptor attaches `AccessToken` header to all API requests
4. Routes with `meta.gotoHome` require authentication (enforced in router guard)

### Smart Contract Integration

Uses `viem` for blockchain interactions. Contract addresses and ABIs are in `src/config.ts` and `src/utils/abis.ts`. Multiple pump contract versions exist (PumpContract1-7) representing iterative deployments. The latest is PumpContract7 (PCS V4 hook).

### Auto-imports

`unplugin-auto-import` and `unplugin-vue-components` are configured for Element Plus and Vant component resolution, plus Iconify icons (ep collection). Components and composables from these libraries don't need explicit imports.

### Responsive Design

Tailwind breakpoint `web: 804px` separates mobile from desktop layouts. The app uses a mobile-first approach.

## Code Conventions

- Use Vue 3 Composition API with `<script setup lang="ts">` syntax
- Use TypeScript; prefer `type` over `interface`
- State management with Pinia stores
- Path aliases: `@` and `~@` both resolve to `src/`
- Event bus via `mitt` (`src/utils/emitter.ts`) for cross-component events (e.g., `login`)
- Custom Tailwind colors defined in `tailwind.config.js` (orange-normal, grey-*, green-*, red-*, etc.)
- Font sizes use custom scale (xs=10px, sm=12px, base=14px, lg=16px, etc.)

## Environment

- Env vars prefixed with `VITE_APP_` (Vite convention)
- Key env vars: `VITE_APP_PRIVY_APP_ID`, `VITE_APP_PRIVY_CLIENT_ID`, `VITE_APP_PRIVY_REDIRECT_URI`
- Backend API: configured in `src/config.ts` as `BACKEND_API_URL`
- Target chain: BSC mainnet (chainId 56)
- Build target: ES2022
- PWA enabled via `vite-plugin-pwa` with injectManifest strategy
