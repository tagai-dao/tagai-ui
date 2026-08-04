import { isAddress, zeroAddress, type Address, type Hex } from 'viem'
import { FeeAddress } from '@/config'

export const BASKET_CHAIN_IDS = [56, 4663] as const
export type BasketChainId = (typeof BASKET_CHAIN_IDS)[number]
export const BASKET_DEFAULT_SLIPPAGE_BPS = 100
export const BASKET_MAX_SLIPPAGE_BPS = 500

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
  /** Normalized display/validation field. Pancake stores it inside parameters. */
  tickSpacing: number
  hooks: Address
  /** Pancake Infinity-only PoolKey fields. */
  poolManager?: Address
  parameters?: Hex
}

export type BasketAssetPreset = {
  address: Address
  symbol: string
  name: string
  logoUrl?: string
  category: 'platform' | 'stock'
  route: {
    venue: 0 | 1 | 2
    /** BSC only: 0 = WBNB, 1 = settlement token (USDT). */
    quoteToken?: 0 | 1
    v4Pool: BasketPoolKey
    v3Fee: number
  }
}

export type BasketContracts = {
  registry: Address
  routeRegistry: Address
  feeAuction: Address
  tokenDeployer: Address
  rebalanceExecutor: Address
  hook: Address
  swapRouter: Address
  feeBatchClaimer: Address
  poolManager: Address
  settlementToken: Address
  wrappedNative: Address
  bidToken: Address
}

export type BasketDeployment = {
  chainId: BasketChainId
  dexKind: 'pancake' | 'uniswap'
  networkLabel: 'BSC' | 'HOOD'
  settlementSymbol: 'USDT' | 'USDG'
  settlementDecimals: number
  wrappedNativeSymbol: 'WBNB' | 'WETH'
  nativeSymbol: 'BNB' | 'ETH'
  contracts: BasketContracts
  hubPool: BasketPoolKey
  v3Quoter: Address
  assetPresets: BasketAssetPreset[]
  protocolRepo: string
}

const emptyPool = (pancakePoolManager?: Address): BasketPoolKey => ({
  currency0: zeroAddress,
  currency1: zeroAddress,
  fee: 0,
  tickSpacing: 0,
  hooks: zeroAddress,
  ...(pancakePoolManager ? { poolManager: zeroAddress, parameters: `0x${'0'.repeat(64)}` as Hex } : {}),
})

const rhContracts = {
  registry: '0x1f997dEb6C8Ac7Bb4134Bc7c6bF23F623Cda25C6',
  routeRegistry: '0x1aE3E64F51CCDC87Ff05E8E8242890e7964FF297',
  feeAuction: '0xC2526404423ED03Ce8D2608F5b94300F0AafA1A2',
  tokenDeployer: '0x61221d38e626CDb8B27F755A9e0019d5aAae81EA',
  rebalanceExecutor: '0x773c71be8b5E3c0c49d9576211d06E2f316AaF4a',
  hook: '0xC6c999fa94199da470a17806F04De85036f02A88',
  swapRouter: '0xD96e197F139b78e9f74555701f699aA051E0a50e',
  feeBatchClaimer: '0x98F020aBB37cF90895A6e08aE430eCcDB369374b',
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  settlementToken: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  wrappedNative: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  bidToken: '0x6419cE35e915Fd62199C472a41e34dB55b56b89d',
} as const satisfies BasketContracts

const rhV4Asset = (
  address: Address,
  symbol: string,
  name: string,
  fee: number,
  tickSpacing: number,
  hooks: Address = zeroAddress,
  options: Pick<BasketAssetPreset, 'category' | 'logoUrl'> = { category: 'stock' },
): BasketAssetPreset => ({
  address, symbol, name, ...options,
  route: {
    venue: 0,
    v4Pool: { currency0: zeroAddress, currency1: address, fee, tickSpacing, hooks },
    v3Fee: 0,
  },
})

const rhStock = (address: Address, symbol: string, name: string, fee: number, tickSpacing: number, ext = 'png') =>
  rhV4Asset(address, symbol, name, fee, tickSpacing, zeroAddress, {
    category: 'stock', logoUrl: `/images/basket-assets/${symbol.toLowerCase()}.${ext}`,
  })

const rhAssets: BasketAssetPreset[] = [
  rhV4Asset(
    '0x6419cE35e915Fd62199C472a41e34dB55b56b89d', 'TagAgent', 'TagAgent', 0, 60,
    '0x5e8e2D77ce0d2e04BA058bbcECC13C7C8aDB20Cc',
    { category: 'platform', logoUrl: '/images/basket-assets/tagagent.jpg' },
  ),
  {
    address: rhContracts.wrappedNative, symbol: 'WETH', name: 'Wrapped Ether', category: 'platform',
    logoUrl: '/images/basket-assets/weth.svg',
    route: { venue: 2, v4Pool: emptyPool(), v3Fee: 0 },
  },
  rhStock('0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', 'NVDA', 'NVIDIA', 10_000, 200),
  rhStock('0xe93237C50D904957Cf27E7B1133b510C669c2e74', 'MSFT', 'Microsoft', 10_000, 200),
  rhStock('0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', 'GOOGL', 'Alphabet Class A', 50_000, 1_000),
  rhStock('0x12f190a9F9d7D37a250758b26824B97CE941bF54', 'AMZN', 'Amazon', 50_000, 1_000),
  rhStock('0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', 'META', 'Meta Platforms', 50_000, 1_000),
  rhStock('0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8', 'NFLX', 'Netflix', 50_000, 1_000),
  rhStock('0xb0992820E760d836549ba69BC7598b4af75dEE03', 'ORCL', 'Oracle', 50_000, 1_000),
  rhStock('0x86923f96303D656E4aa86D9d42D1e57ad2023fdC', 'AMD', 'AMD', 50_000, 1_000),
  rhStock('0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A', 'PLTR', 'Palantir Technologies', 50_000, 1_000),
  rhStock('0xc72b96e0E48ecd4DC75E1e45396e26300BC39681', 'INTC', 'Intel', 50_000, 1_000),
  rhStock('0x1b0E319c6A659F002271B69dB8A7df2F911c153E', 'GME', 'GameStop', 50_000, 1_000),
  rhStock('0x3b14C39E89D60D627b42a1A4CA45b5bb45Fc12e2', 'RKLB', 'Rocket Lab', 50_000, 1_000),
  rhStock('0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa', 'SPCX', 'SpaceX', 10_000, 200, 'svg'),
]

const bscContracts = {
  registry: '0x5B45ad2c3A2B8b8989579162C4faE2D64598Cefe',
  routeRegistry: '0xB086FC19925A9Af5371eb7Aba3c2c404eA471596',
  feeAuction: '0x5070CA9Ec62b47e2AEb9AcfE40B7Ec40cAFeB375',
  tokenDeployer: '0xA2Afc3b86881ef6c6ac27332d480E16eC2bC64Fd',
  rebalanceExecutor: '0xc13058d1601297ae5dd9459f1dbB9cd612e3ab9a',
  hook: '0xdbaEBc8620718590172Ff8D80145f7e3Ca80beA0',
  swapRouter: '0x4c3a94f166d3046F10D002FDDe426E9C0b6C703e',
  feeBatchClaimer: '0xeC80Ebb84b18A393ED8Aa3c627E812bD3DaaA9A4',
  poolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
  settlementToken: '0x55d398326f99059fF775485246999027B3197955',
  wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  bidToken: '0x32ef878D527d860339818571E8DA17005110f04E',
} as const satisfies BasketContracts

export const BSC_USDC: Address = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
export const BSC_USD1: Address = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d'

const bscEmptyPool = emptyPool(bscContracts.poolManager)
const bscV3Asset = (
  address: Address,
  symbol: string,
  name: string,
  quoteToken: 0 | 1,
  v3Fee: number,
  logoUrl?: string,
): BasketAssetPreset => ({
  address,
  symbol,
  name,
  category: 'stock',
  logoUrl,
  route: { venue: 1, quoteToken, v4Pool: bscEmptyPool, v3Fee },
})

const bscAssets: BasketAssetPreset[] = [
  {
    address: bscContracts.wrappedNative, symbol: 'WBNB', name: 'Wrapped BNB', category: 'platform',
    logoUrl: '/images/basket-assets/wbnb.svg',
    route: { venue: 2, quoteToken: 0, v4Pool: bscEmptyPool, v3Fee: 0 },
  },
  {
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', name: 'Binance-Peg Ethereum',
    category: 'platform', logoUrl: '/images/basket-assets/eth.svg',
    route: { venue: 1, quoteToken: 0, v4Pool: bscEmptyPool, v3Fee: 500 },
  },
  {
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', symbol: 'BTC', name: 'Binance-Peg Bitcoin',
    category: 'platform', logoUrl: '/images/basket-assets/btc.svg',
    route: { venue: 1, quoteToken: 0, v4Pool: bscEmptyPool, v3Fee: 500 },
  },
  bscV3Asset(
    '0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618c4', 'AAPLon', 'Apple (Ondo)', 1, 2_500,
    '/images/basket-assets/aapl.png',
  ),
  bscV3Asset(
    '0xA9eE28C80f960B889dFbd1902055218cBa016F75', 'NVDAon', 'NVIDIA (Ondo)', 1, 10_000,
    '/images/basket-assets/nvda.png',
  ),
  bscV3Asset(
    '0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436', 'NVDAB', 'NVIDIA (bStocks)', 1, 2_500,
    '/images/basket-assets/nvda.png',
  ),
  bscV3Asset(
    '0x091FC7778e6932d4009B087B191D1EE3bac5729A', 'GOOGLon', 'Alphabet (Ondo)', 1, 10_000,
    '/images/basket-assets/googl.png',
  ),
  bscV3Asset(
    '0xdABb9afF4cf02f26D2014e4cA9f94aC6fe6572a3', 'GMEon', 'GameStop (Ondo)', 1, 2_500,
    '/images/basket-assets/gme.png',
  ),
  bscV3Asset(
    '0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1', 'SPCXB', 'SpaceX', 1, 2_500,
    '/images/basket-assets/spcx.svg',
  ),
  bscV3Asset(
    '0x205812CdBed920aFf76C6580abD681a46D11efc7', 'QQQB', 'Invesco QQQ (bStocks)', 1, 100,
    '/images/basket-assets/qqq.png',
  ),
]

export const BASKET_DEPLOYMENTS: Record<BasketChainId, BasketDeployment> = {
  56: {
    chainId: 56,
    dexKind: 'pancake',
    networkLabel: 'BSC',
    settlementSymbol: 'USDT',
    settlementDecimals: 18,
    wrappedNativeSymbol: 'WBNB',
    nativeSymbol: 'BNB',
    contracts: bscContracts,
    hubPool: {
      currency0: zeroAddress,
      currency1: bscContracts.settlementToken,
      hooks: zeroAddress,
      poolManager: bscContracts.poolManager,
      fee: 67,
      tickSpacing: 1,
      parameters: `0x${'0'.repeat(58)}010000` as Hex,
    },
    // Canonical PancakeSwap V3 QuoterV2 on BNB Chain.
    v3Quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    assetPresets: bscAssets,
    protocolRepo: '',
  },
  4663: {
    chainId: 4663,
    dexKind: 'uniswap',
    networkLabel: 'HOOD',
    settlementSymbol: 'USDG',
    settlementDecimals: 6,
    wrappedNativeSymbol: 'WETH',
    nativeSymbol: 'ETH',
    contracts: rhContracts,
    hubPool: {
      currency0: zeroAddress,
      currency1: rhContracts.settlementToken,
      fee: 500,
      tickSpacing: 10,
      hooks: zeroAddress,
    },
    v3Quoter: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    assetPresets: rhAssets,
    protocolRepo: 'https://github.com/tagai-dao/robinhood-basket-contract',
  },
}

export const isBasketChain = (chainId: number): chainId is BasketChainId =>
  BASKET_CHAIN_IDS.includes(chainId as BasketChainId)

export const getBasketDeployment = (chainId: number): BasketDeployment => {
  if (!isBasketChain(chainId)) throw new Error(`Basket is not deployed on chain ${chainId}`)
  return BASKET_DEPLOYMENTS[chainId]
}

/** BSC USD routing/settlement assets may be used between swaps, but never as basket constituents. */
export const isBscBasketLegAssetBlocked = (asset: string, chainId: number): boolean => {
  if (chainId !== 56) return false
  const deployment = BASKET_DEPLOYMENTS[56]
  const normalized = asset.toLowerCase()
  return [
    deployment.contracts.settlementToken,
    BSC_USDC,
    BSC_USD1,
  ].some((address) => address.toLowerCase() === normalized)
}

export const isUsdBasketLegSymbol = (symbol: string): boolean => {
  const normalized = symbol.trim().toUpperCase()
  return normalized.includes('USD') || normalized === 'DAI'
}

export const toContractPoolKey = (pool: BasketPoolKey, chainId: number) => {
  if (chainId === 56) {
    if (!pool.poolManager || !pool.parameters) throw new Error('Incomplete Pancake Infinity PoolKey')
    return {
      currency0: pool.currency0,
      currency1: pool.currency1,
      hooks: pool.hooks,
      poolManager: pool.poolManager,
      fee: pool.fee,
      parameters: pool.parameters,
    }
  }
  return {
    currency0: pool.currency0,
    currency1: pool.currency1,
    fee: pool.fee,
    tickSpacing: pool.tickSpacing,
    hooks: pool.hooks,
  }
}
