const BPS = 10_000

export const BASKET_FEE_MODEL = {
  MIN_BASKET_FEE_BPS: 100,
  MAX_BASKET_FEE_BPS: 300,
  AUCTION_SHARE_BPS: 1_000,
  FRONTEND_SHARE_BPS: 555,
  LAUNCHER_SHARE_BPS: 555,
  MAX_CREATOR_SHARE_BPS: 3_000,
} as const

export type FeeSplit = { burn: number; interface: number; launcher: number; creator: number; holders: number }

export const feeSplit = (creatorShareBps: number, hasInterface = true): FeeSplit => {
  const FEE = 1_000_000_000n
  const auction = FEE * BigInt(BASKET_FEE_MODEL.AUCTION_SHARE_BPS) / BigInt(BPS)
  const afterAuction = FEE - auction
  const frontend = afterAuction * BigInt(BASKET_FEE_MODEL.FRONTEND_SHARE_BPS) / BigInt(BPS)
  const launcherBase = afterAuction * BigInt(BASKET_FEE_MODEL.LAUNCHER_SHARE_BPS) / BigInt(BPS)
  const interfaceCut = hasInterface ? frontend : 0n
  const launcherCut = launcherBase + (hasInterface ? 0n : frontend)
  const remainder = afterAuction - frontend - launcherBase
  const creatorBps = BigInt(Math.max(0, Math.min(creatorShareBps, BASKET_FEE_MODEL.MAX_CREATOR_SHARE_BPS)))
  const creatorCut = remainder * creatorBps / BigInt(BPS)
  const holdersCut = remainder - creatorCut
  const toNumber = (value: bigint) => Number(value) / Number(FEE)
  return {
    burn: toNumber(auction),
    interface: toNumber(interfaceCut),
    launcher: toNumber(launcherCut),
    creator: toNumber(creatorCut),
    holders: toNumber(holdersCut),
  }
}
