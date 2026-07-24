import { isAddress, zeroAddress, type Address } from 'viem'
import { FeeAddress } from '@/config'

export const BASKET_CHAIN_ID = 4663 as const
export const BASKET_USDG_DECIMALS = 6
export const BASKET_DEFAULT_SLIPPAGE_BPS = 100
export const BASKET_MAX_SLIPPAGE_BPS = 500

export const BASKET_CONTRACTS = {
  registry: '0x1f997dEb6C8Ac7Bb4134Bc7c6bF23F623Cda25C6',
  routeRegistry: '0x1aE3E64F51CCDC87Ff05E8E8242890e7964FF297',
  feeAuction: '0xC2526404423ED03Ce8D2608F5b94300F0AafA1A2',
  tokenDeployer: '0x61221d38e626CDb8B27F755A9e0019d5aAae81EA',
  rebalanceExecutor: '0x773c71be8b5E3c0c49d9576211d06E2f316AaF4a',
  hook: '0xC6c999fa94199da470a17806F04De85036f02A88',
  swapRouter: '0xD96e197F139b78e9f74555701f699aA051E0a50e',
  feeBatchClaimer: '0x98F020aBB37cF90895A6e08aE430eCcDB369374b',
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  bidToken: '0x6419cE35e915Fd62199C472a41e34dB55b56b89d',
} as const satisfies Record<string, Address>

/** Canonical Uniswap V3 QuoterV2 on Robinhood Chain. */
export const BASKET_V3_QUOTER = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7' as const satisfies Address

const configuredFrontend = (import.meta.env.VITE_BASKET_FRONTEND_FEE_WALLET as string | undefined)?.trim()

/** Official TagAI frontend attribution. Zero address sends that share to the launcher. */
export const BASKET_FRONTEND_FEE_WALLET: Address = (() => {
  const candidate = configuredFrontend || FeeAddress
  return candidate && isAddress(candidate) ? candidate as Address : zeroAddress
})()

export type BasketPoolKey = {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export type BasketAssetPreset = {
  address: Address
  symbol: string
  name: string
  logoUrl?: string
  category: 'platform' | 'stock'
  route: {
    venue: 0 | 1 | 2
    v4Pool: BasketPoolKey
    v3Fee: number
  }
}

const EMPTY_V4_POOL: BasketPoolKey = {
  currency0: zeroAddress,
  currency1: zeroAddress,
  fee: 0,
  tickSpacing: 0,
  hooks: zeroAddress,
}

const v4Asset = (
  address: Address,
  symbol: string,
  name: string,
  fee: number,
  tickSpacing: number,
  hooks: Address = zeroAddress,
  options: Pick<BasketAssetPreset, 'category' | 'logoUrl'> = { category: 'stock' },
): BasketAssetPreset => ({
  address,
  symbol,
  name,
  ...options,
  route: {
    venue: 0,
    v4Pool: { currency0: zeroAddress, currency1: address, fee, tickSpacing, hooks },
    v3Fee: 0,
  },
})

const stockAsset = (
  address: Address,
  symbol: string,
  name: string,
  fee: number,
  tickSpacing: number,
  logoExtension = 'png',
) => v4Asset(address, symbol, name, fee, tickSpacing, zeroAddress, {
  category: 'stock',
  logoUrl: `/images/basket-assets/${symbol.toLowerCase()}.${logoExtension}`,
})

const v3StockAsset = (
  address: Address,
  symbol: string,
  name: string,
  fee: number,
  logoExtension = 'png',
): BasketAssetPreset => ({
  address,
  symbol,
  name,
  category: 'stock',
  logoUrl: `/images/basket-assets/${symbol.toLowerCase()}.${logoExtension}`,
  route: { venue: 1, v4Pool: EMPTY_V4_POOL, v3Fee: fee },
})

const wethAsset = (): BasketAssetPreset => ({
  address: BASKET_CONTRACTS.weth,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  category: 'platform',
  logoUrl: '/images/basket-assets/weth.svg',
  route: { venue: 2, v4Pool: EMPTY_V4_POOL, v3Fee: 0 },
})

/**
 * Curated creation assets. Routes are deliberately pinned instead of selected at runtime.
 * WETH uses the protocol's direct reserve route; stock tokens use a pinned V3 or V4 route.
 */
export const BASKET_ASSET_PRESETS: BasketAssetPreset[] = [
  v4Asset(
    '0x6419cE35e915Fd62199C472a41e34dB55b56b89d', 'TagAgent', 'TagAgent', 0, 60,
    '0x5e8e2D77ce0d2e04BA058bbcECC13C7C8aDB20Cc',
    { category: 'platform', logoUrl: '/images/basket-assets/tagagent.jpg' },
  ),
  wethAsset(),
  stockAsset('0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', 'NVDA', 'NVIDIA', 10_000, 200),
  stockAsset('0xe93237C50D904957Cf27E7B1133b510C669c2e74', 'MSFT', 'Microsoft', 10_000, 200),
  stockAsset('0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', 'AAPL', 'Apple', 10_000, 200),
  stockAsset('0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', 'GOOGL', 'Alphabet Class A', 50_000, 1_000),
  stockAsset('0x12f190a9F9d7D37a250758b26824B97CE941bF54', 'AMZN', 'Amazon', 50_000, 1_000),
  stockAsset('0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', 'META', 'Meta Platforms', 50_000, 1_000),
  stockAsset('0x156E175DD063a8cE274C50654eF40e0032b3fbcF', 'AVGO', 'Broadcom', 10_000, 200),
  v3StockAsset('0x322F0929c4625eD5bAd873c95208D54E1c003b2d', 'TSLA', 'Tesla', 3_000),
  stockAsset('0x58FfE4a942d3885bAa22D7520691F611EF09e7AA', 'TSM', 'Taiwan Semiconductor', 10_000, 200),
  stockAsset('0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', 'SPY', 'SPDR S&P 500 ETF', 9_500, 190),
  stockAsset('0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', 'QQQ', 'Invesco QQQ', 10_000, 200),
  stockAsset('0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5', 'XOM', 'ExxonMobil', 10_000, 200),
  stockAsset('0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8', 'NFLX', 'Netflix', 50_000, 1_000),
  stockAsset('0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2', 'COST', 'Costco', 10_000, 200),
  stockAsset('0xb0992820E760d836549ba69BC7598b4af75dEE03', 'ORCL', 'Oracle', 50_000, 1_000),
  stockAsset('0x86923f96303D656E4aa86D9d42D1e57ad2023fdC', 'AMD', 'AMD', 50_000, 1_000),
  stockAsset('0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A', 'PLTR', 'Palantir Technologies', 50_000, 1_000),
  stockAsset('0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA', 'ASML', 'ASML Holding', 10_000, 200),
  stockAsset('0x6330D8C3178a418788dF01a47479c0ce7CCF450b', 'COIN', 'Coinbase', 10_000, 200),
  stockAsset('0xc72b96e0E48ecd4DC75E1e45396e26300BC39681', 'INTC', 'Intel', 50_000, 1_000),
  stockAsset('0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD', 'MU', 'Micron Technology', 10_000, 200),
  stockAsset('0x36046893810a7E7fCE501229d57dc3FC8c8716d0', 'AMAT', 'Applied Materials', 10_000, 200),
  stockAsset('0x0C3260aF4B8f13a69c4c2dFb84fD667890CDFa14', 'NOW', 'ServiceNow', 10_000, 200),
  stockAsset('0x98E75885157C80992A8D41b696D8c9C6Fb30A926', 'SOFI', 'SoFi Technologies', 10_000, 200),
  stockAsset('0x1b0E319c6A659F002271B69dB8A7df2F911c153E', 'GME', 'GameStop', 50_000, 1_000),
  stockAsset('0x25C288E6D899b9BC30160965aD9644c67e73bE0C', 'F', 'Ford Motor', 10_000, 200),
  stockAsset('0x558378E000D634A36593E338eBacdd6207640EfE', 'IONQ', 'IonQ', 10_000, 200),
  stockAsset('0x3b14C39E89D60D627b42a1A4CA45b5bb45Fc12e2', 'RKLB', 'Rocket Lab', 50_000, 1_000),
  stockAsset('0xb8DBf92F9741c9ac1c32115E78581f23509916FD', 'APLD', 'Applied Digital', 10_000, 200),
  stockAsset('0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa', 'SPCX', 'SpaceX', 10_000, 200, 'svg'),
]

export const BASKET_HUB_POOL: BasketPoolKey = {
  currency0: zeroAddress,
  currency1: BASKET_CONTRACTS.usdg,
  fee: 500,
  tickSpacing: 10,
  hooks: zeroAddress,
}

export const BASKET_PROTOCOL_REPO = 'https://github.com/tagai-dao/robinhood-basket-contract'
