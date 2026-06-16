/** /tiptag/pool-tvl 响应体 */
export type PoolTvlData = {
  reserveToken0: string
  reserveToken1: string
}

export type PoolTvlResponse = {
  c: number
  d: PoolTvlData
}

export type ClPositionSummary = {
  tokenId: bigint
  tickLower: number
  tickUpper: number
  liquidity: bigint
  amount0: bigint
  amount1: bigint
  inRange: boolean
}

export type PriceRangePreset = 'full' | '5' | '10' | 'manual'

/** The Graph position 实体（/tiptag/cl-positions） */
export type ClPositionIndexItem = {
  id: string
  tokenId: string
  owner: string
  origin: string
  createdAtTimestamp: string
}

export type ClPositionsIndexResponse = {
  c: number
  d: {
    positions: ClPositionIndexItem[]
  }
}
