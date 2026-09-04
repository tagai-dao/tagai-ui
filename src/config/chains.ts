/**
 * 多链部署元数据（Phase 0）
 * - BSC：现网完整配置
 * - Robinhood：链元数据已就绪；TagAI 自有合约地址等你部署后回填（占位 0x0）
 */

export type ChainDeployment = {
  /** 内部短名，对应 server CHAIN_NAME / 表前缀习惯 */
  key: 'bsc' | 'rh'
  name: string
  chainId: number
  /** 当前链新创建社区代币使用的 Pump 版本。 */
  latestPumpVersion: 9 | 11
  symbol: string
  decimals: number
  browser: string
  rpc: string
  rpcUrls: string[]
  /** 原生币展示（钱包 addChain / UI） */
  nativeCurrency: {
    name: string
    symbol: string
    icon: string
    decimals: number
  }
  multiConfig: {
    rpcUrl: string
    multicallAddress: `0x${string}`
    interval: number
  }
  features: {
    prediction: boolean
    /** 是否开放聚合预测市场主入口；关闭后仍可从社区进入预测市场。 */
    predictionMainEntry: boolean
    auPay: boolean
    /** 新版 ImportHelper：导入时创建 IPShare，并记录 importerOf(token) */
    enhancedImportHelper: boolean
  }
  /** 包装原生币（BSC=WBNB，RH=WETH） */
  wrappedNative: `0x${string}`
  /** DEX / 基础设施（RH 为 Uniswap；BSC 为 Pancake） */
  dex: {
    kind: 'pancake' | 'uniswap'
    v2Router: `0x${string}`
    v2Factory: `0x${string}`
    v3Router: `0x${string}`
    v3Factory: `0x${string}`
    /** V3 SmartRouter；ImportedTokenSwapWrapper 使用不带 deadline 的 exactInputSingle。 */
    v3SmartRouter: `0x${string}`
    /** V3 QuoterV2；用于按真实流动性计算成交输出，而不是仅使用池现价。 */
    v3Quoter: `0x${string}`
    permit2: `0x${string}`
    universalRouter: `0x${string}`
    /** V4 PoolManager；BSC=PCS CLPoolManager，RH=Uniswap V4 PoolManager */
    v4PoolManager: `0x${string}`
    v4PositionManager: `0x${string}`
    /** Quoter：RH 待确认后回填 */
    v4Quoter: `0x${string}`
  }
  /**
   * TagAI 自有合约。RH 在 Phase 1 部署前均为零地址占位。
   * Phase 2+ 业务代码应通过 getChainConfig(chainId).contracts 读取。
   */
  contracts: {
    pump9: `0x${string}`
    tokenImplementation9: `0x${string}`
    pump11: `0x${string}`
    tokenImplementation11: `0x${string}`
    importHelper: `0x${string}`
    importedTokenSwapWrapper: `0x${string}`
    tagAiSwapWrapper: `0x${string}`
    /** RH V9/V10 imported-token wrapper kept for historical pools. */
    legacyTagAiSwapWrapper: `0x${string}`
    tipTagSwapHook9: `0x${string}`
    tipTagSwapHook11: `0x${string}`
    hourlyTickCalculator: `0x${string}`
    nutboxCommittee: `0x${string}`
    ipshare3: `0x${string}`
    /** 社交账户余额合约；RH 未部署时为零地址，读余额时跳过 */
    coinPurse: `0x${string}`
  }
}

const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc.rpc.blxrbdn.com',
  'https://56.rpc.thirdweb.com',
]

const RH_RPC_URLS = [
  'https://rpc.mainnet.chain.robinhood.com',
]

/** Multicall3 在多数 EVM（含 Arbitrum Orbit）上为同一地址 */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const ZERO = '0x0000000000000000000000000000000000000000' as const

export const BSC_CHAIN: ChainDeployment = {
  key: 'bsc',
  name: 'BSC',
  chainId: 56,
  latestPumpVersion: 11,
  symbol: 'BNB',
  decimals: 18,
  browser: 'https://bscscan.com/',
  rpc: BSC_RPC_URLS[0] ?? 'https://bsc-dataseed.binance.org',
  rpcUrls: BSC_RPC_URLS.length ? BSC_RPC_URLS : ['https://bsc-dataseed.binance.org'],
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    icon: 'https://assets-cdn.trustwallet.com/blockchains/smartchain/info/logo.png',
    decimals: 18,
  },
  multiConfig: {
    rpcUrl: BSC_RPC_URLS[0] ?? 'https://bsc-dataseed.binance.org',
    multicallAddress: MULTICALL3,
    interval: 3000,
  },
  // BSC ImportHelper 创建固定 HourlyTickCalculator 社区；不创建 IPShare 或 importerOf。
  features: { prediction: true, predictionMainEntry: false, auPay: true, enhancedImportHelper: false },
  wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  dex: {
    kind: 'pancake',
    v2Router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    v2Factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    // Legacy SwapRouter keeps the deadline-bearing exactInputSingle ABI used by
    // TagAI's deployed BSC wrapper. Pancake SmartRouter (0x13f4...) omits it.
    v3Router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
    v3Factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
    v3SmartRouter: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
    v3Quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
    permit2: '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768',
    universalRouter: '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB',
    v4PoolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
    v4PositionManager: '0x55f4c8abA71A1e923edC303eb4fEfF14608cC226',
    v4Quoter: '0xd0737C9762912dD34c3271197E362Aa736Df0926',
  },
  contracts: {
    pump9: '0x327a473c763bcf0d60CCd6811F832332939110D5',
    tokenImplementation9: '0x69B1B0635220e5f16A36Ad44c3B2B1FB9ca65e16',
    pump11: '0x8fEF5b4c0f761a0cc447800e3019B089ac306F28',
    tokenImplementation11: '0xfD40C112F39D372786265a032C546D05Feec4D66',
    importHelper: '0xcCB0f9a9db22cCC29fDd315180F89747118ec296',
    importedTokenSwapWrapper: '0xDfFc699FB095a693708E3c15e6F0a224cbbCc98F',
    tagAiSwapWrapper: '0x0000000000000000000000000000000000000000',
    legacyTagAiSwapWrapper: '0x0000000000000000000000000000000000000000',
    tipTagSwapHook9: '0x78443e75aD3D70DAAab0De33d2D5Dea0cBae0cC1',
    tipTagSwapHook11: '0x9E38747072F326b4e614EfF6FdCA8529db090cc1',
    hourlyTickCalculator: '0x6cCEC02E7D371FED954D7D16eCb7F2f57cccF54d',
    nutboxCommittee: '0xe10F967DD356504EDB731612789D0D0f0ba2929f',
    ipshare3: '0x95450AaD4Cc195e03BB4791B7f6f04aC6D9BA922',
    coinPurse: '0x6C818c610F3D9db65f5e0c0838f3F68600b80C85',
  },
}

/**
 * Robinhood Chain（Arbitrum Orbit L2，gas=ETH，DEX=Uniswap）
 * @see https://docs.robinhood.com/chain/connecting
 * Uniswap 地址来自 Uniswap contracts 部署记录；TagAI 合约待 Phase 1 回填
 */
/** PoolKey fee remains zero; TipTagSwapHook charges this fee inside the hook. */
export const ROBINHOOD_TIPTAG_HOOK_FEE_PIPS = 6_000

export const ROBINHOOD_CHAIN: ChainDeployment = {
  key: 'rh',
  name: 'Robinhood',
  chainId: 4663,
  latestPumpVersion: 11,
  symbol: 'ETH',
  decimals: 18,
  browser: 'https://robinhoodchain.blockscout.com/',
  rpc: RH_RPC_URLS[0] ?? 'https://rpc.mainnet.chain.robinhood.com',
  rpcUrls: RH_RPC_URLS.length ? RH_RPC_URLS : ['https://rpc.mainnet.chain.robinhood.com'],
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    icon: 'https://assets-cdn.trustwallet.com/blockchains/ethereum/info/logo.png',
    decimals: 18,
  },
  multiConfig: {
    rpcUrl: RH_RPC_URLS[0] ?? 'https://rpc.mainnet.chain.robinhood.com',
    multicallAddress: MULTICALL3,
    interval: 3000,
  },
  features: { prediction: false, predictionMainEntry: false, auPay: false, enhancedImportHelper: true },
  // Uniswap UR constructor 确认的 WETH9
  wrappedNative: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  dex: {
    kind: 'uniswap',
    v2Router: '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba',
    v2Factory: '0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f',
    v3Router: '0xCaf681a66D020601342297493863E78C959E5cb2',
    v3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
    v3SmartRouter: '0xCaf681a66D020601342297493863E78C959E5cb2',
    v3Quoter: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',
    v4PoolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    v4PositionManager: '0x58daec3116aae6D93017bAAea7749052E8a04fA7',
    v4Quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94',
  },
  contracts: {
    pump9: '0x6C75E165E52E9c1661a75041650be2D919eE02A1',
    tokenImplementation9: '0x95c62F6A3AC1A3b7D08d866eeBDc74700aB954D6',
    pump11: '0x7686CbaF2dFc7000eb9b0D6DE81E48c1211d2655',
    tokenImplementation11: '0xcE00643B77695AD9A7a4EaBdC5b479cA0c22C016',
    importHelper: '0xD0baaF8D314b0C6AB6bebd24ddbC86157c9c7b09',
    importedTokenSwapWrapper: '0x53e65DE68A0eB7f3662579F44Eb9849Ae5cA44ab',
    tagAiSwapWrapper: '0x53e65DE68A0eB7f3662579F44Eb9849Ae5cA44ab',
    legacyTagAiSwapWrapper: '0xa12d998bff956c1034f863a4cd30f4403b6b2b4f',
    tipTagSwapHook9: '0x5e8e2D77ce0d2e04BA058bbcECC13C7C8aDB20Cc',
    tipTagSwapHook11: '0x841dcAD307A4444dC9E65F5709B2DC5e054C20cC',
    hourlyTickCalculator: '0x3DC52C69C3C8be568372E16d50E9F3FEc796610c',
    nutboxCommittee: '0x7B0ddC305C32AAEbabc0FE372a4460e9903e95D0',
    ipshare3: '0x8A7b0d80FA92699CE3e5bB2c8fE404D6733796d1',
    coinPurse: ZERO,
  },
}

export const CHAINS: Record<number, ChainDeployment> = {
  [BSC_CHAIN.chainId]: BSC_CHAIN,
  [ROBINHOOD_CHAIN.chainId]: ROBINHOOD_CHAIN,
}

/** TagAI 产品支持的链（钱包 / Privy / 切链 UI） */
export const PRODUCT_CHAIN_IDS = [56, 4663] as const

export type ProductChainId = (typeof PRODUCT_CHAIN_IDS)[number]

/** 单前端默认进入 BSC；用户可通过 ChainSwitcher 切换并持久化选择。 */
export const DEFAULT_CHAIN_ID: ProductChainId = 56

export const getChainDeployment = (chainId: number): ChainDeployment => {
  const chain = CHAINS[chainId]
  if (!chain) throw new Error(`Unsupported product chainId: ${chainId}`)
  return chain
}

export const isProductChain = (chainId: number): chainId is ProductChainId =>
  PRODUCT_CHAIN_IDS.includes(chainId as ProductChainId)

export const getChainSlug = (chainId: number): ChainDeployment['key'] =>
  getChainDeployment(chainId).key

export const getChainIdFromSlug = (slug: unknown): ProductChainId | null => {
  const normalized = String(slug ?? '').toLowerCase()
  const deployment = Object.values(CHAINS).find((chain) => chain.key === normalized)
  return deployment && isProductChain(deployment.chainId) ? deployment.chainId : null
}

export const getChainPath = (chainId: number, path = ''): string => {
  const suffix = path && path !== '/' ? `/${String(path).replace(/^\/+/, '')}` : ''
  return `/${getChainSlug(chainId)}${suffix}`
}

/** TagAI 自有合约是否已在该链部署（非零地址） */
export const hasTagAiContracts = (chainId: number): boolean => {
  const { contracts, latestPumpVersion } = getChainDeployment(chainId)
  const activePump = latestPumpVersion === 11 ? contracts.pump11 : contracts.pump9
  return activePump !== ZERO && contracts.ipshare3 !== ZERO
}
