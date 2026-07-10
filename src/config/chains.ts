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
  /** 包装原生币（BSC=WBNB，RH=WETH） */
  wrappedNative: `0x${string}`
  /** DEX / 基础设施（RH 为 Uniswap；BSC 为 Pancake） */
  dex: {
    kind: 'pancake' | 'uniswap'
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
    importHelper: `0x${string}`
    tipTagSwapHook9: `0x${string}`
    hourlyTickCalculator: `0x${string}`
    nutboxCommittee: `0x${string}`
    ipshare3: `0x${string}`
    /** 社交账户余额合约；RH 未部署时为零地址，读余额时跳过 */
    coinPurse: `0x${string}`
  }
}

const BSC_RPC_URLS = [
  import.meta.env.VITE_BSC_RPC_URL,
  'https://bsc-dataseed.binance.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc.rpc.blxrbdn.com',
  'https://56.rpc.thirdweb.com',
].filter((url): url is string => Boolean(url))

const RH_RPC_URLS = [
  import.meta.env.VITE_ROBINHOOD_RPC_URL,
  'https://rpc.mainnet.chain.robinhood.com',
].filter((url): url is string => Boolean(url))

/** Multicall3 在多数 EVM（含 Arbitrum Orbit）上为同一地址 */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const ZERO = '0x0000000000000000000000000000000000000000' as const

export const BSC_CHAIN: ChainDeployment = {
  key: 'bsc',
  name: 'BSC',
  chainId: 56,
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
  wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  dex: {
    kind: 'pancake',
    permit2: '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768',
    universalRouter: '0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB',
    v4PoolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
    v4PositionManager: '0x55f4c8abA71A1e923edC303eb4fEfF14608cC226',
    v4Quoter: '0xd0737C9762912dD34c3271197E362Aa736Df0926',
  },
  contracts: {
    pump9: '0x327a473c763bcf0d60CCd6811F832332939110D5',
    tokenImplementation9: '0x69B1B0635220e5f16A36Ad44c3B2B1FB9ca65e16',
    importHelper: '0xF346A700830633bB27a46fC1e7eAAE49F593A4c6',
    tipTagSwapHook9: '0x78443e75aD3D70DAAab0De33d2D5Dea0cBae0cC1',
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
export const ROBINHOOD_CHAIN: ChainDeployment = {
  key: 'rh',
  name: 'Robinhood',
  chainId: 4663,
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
  // Uniswap UR constructor 确认的 WETH9
  wrappedNative: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  dex: {
    kind: 'uniswap',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    universalRouter: '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77',
    v4PoolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
    v4PositionManager: '0x58daec3116aae6D93017bAAea7749052E8a04fA7',
    // Quoter 地址待 Blockscout / Uniswap 文档确认后回填
    v4Quoter: ZERO,
  },
  contracts: {
    pump9: ZERO,
    tokenImplementation9: ZERO,
    importHelper: ZERO,
    tipTagSwapHook9: ZERO,
    hourlyTickCalculator: ZERO,
    nutboxCommittee: ZERO,
    ipshare3: ZERO,
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

/** 默认链：可用 VITE_DEFAULT_CHAIN_ID 覆盖；合约未部署前建议保持 56 */
export const DEFAULT_CHAIN_ID: ProductChainId = (() => {
  const fromEnv = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID)
  if (fromEnv === 56 || fromEnv === 4663) return fromEnv
  return 56
})()

export const getChainDeployment = (chainId: number): ChainDeployment => {
  const chain = CHAINS[chainId]
  if (!chain) throw new Error(`Unsupported product chainId: ${chainId}`)
  return chain
}

export const isProductChain = (chainId: number): chainId is ProductChainId =>
  PRODUCT_CHAIN_IDS.includes(chainId as ProductChainId)

/** TagAI 自有合约是否已在该链部署（非零地址） */
export const hasTagAiContracts = (chainId: number): boolean => {
  const { contracts } = getChainDeployment(chainId)
  return contracts.pump9 !== ZERO && contracts.ipshare3 !== ZERO
}
