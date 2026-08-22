export type Address = `0x${string}`

export interface NutboxIndexBrokerPool {
  pool: Address
  factory: Address
  community: Address
  admin?: Address
  nftTemplate?: Address
  nftTemplateKind?: 'BURN' | 'STAKE' | string
  miningMode?: 'burn' | 'stake' | null
  communityToken: Address
  indexMiningToken?: Address
  renderer?: Address
  fundsReceiver?: Address
  amm: Address
  indexToken?: Address
  nutboxRouter?: Address
  name?: string
  symbol?: string
  communityTokenPrice?: string
  indexMiningActivationTokenAmount?: string
  nativePrice?: string
  maxSupply?: string
  referralBps?: number
  minimumIndexMiningWeight?: string
  levelThresholds?: string[]
  levelWeights?: string[]
  totalSupply?: string
  totalActiveIndexMiningWeight?: string
  queuedIndexRewards?: string
  inventoryCount?: string
  oldestTokenId?: string
  normalFeeBps?: number
  specificFeeBps?: number
  tokensPerNft?: string
  ammActive?: boolean | null
}

export interface NutboxPool {
  pool: Address
  community: Address
  name?: string
  status?: string
  ratio?: string | number
  poolType?: string
  poolFactory?: Address
  indexBroker?: NutboxIndexBrokerPool
}

export interface NutboxCommunityByTokenResponse {
  success: boolean
  community: Address
  cToken: Address
  pools: NutboxPool[]
}

export interface NutboxNftTransaction {
  id: string
  eventType: 'INDEX_BROKER_NFT_MINTED' | 'INDEX_BROKER_NFT_BOUGHT' | 'INDEX_BROKER_NFT_SOLD' | string
  tokenId: string
  account: Address
  amount: string
  secondaryAmount?: string
  tertiaryAmount?: string
  blockNumber: number
  blockTimestamp: number
  transactionHash: `0x${string}`
  logIndex: number
}

export interface NutboxTransactionPage {
  success: boolean
  list: NutboxNftTransaction[]
  hasMore: boolean
  nextCursor: { blockNumber: number; logIndex: number } | null
}

export interface NutboxRewardSummary {
  success: boolean
  injectedAmount: string
  distributedAmount: string
  totalBurnedMiningAmount: string
  windowStart: number
  windowEnd: number
}
