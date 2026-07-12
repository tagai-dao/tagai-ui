/**
 * 费用模型常量（协议固定切片，仅用于展示）
 * 移植自 Spectrum fee-model.ts
 */
const BPS = 10_000

export const PROTOCOL_FEE_MODEL = {
  MIN_BASKET_FEE_BPS: 100,
  MAX_BASKET_FEE_BPS: 300,
  BURN_SHARE_BPS: 1_000,
  INTERFACE_SHARE_BPS: 555,
  LAUNCHER_SHARE_BPS: 555,
  MAX_CREATOR_SHARE_BPS: 3_000,
} as const

export type FeeSplit = {
  burn: number
  interface: number
  launcher: number
  creator: number
  holders: number
}

/** 费用瀑布（占 total fee 的比例），与链上 _distributeFee 顺序一致 */
export const feeSplit = (
  creatorShareBps: number,
  opts: { hasInterface: boolean; hasLauncher: boolean },
): FeeSplit => {
  const { BURN_SHARE_BPS, INTERFACE_SHARE_BPS, LAUNCHER_SHARE_BPS, MAX_CREATOR_SHARE_BPS } =
    PROTOCOL_FEE_MODEL
  const bps = BigInt(BPS)
  const FEE = 1_000_000_000_000_000_000n
  const afterBurn = (FEE * (bps - BigInt(BURN_SHARE_BPS))) / bps
  let remainder = afterBurn
  const interfaceCut = opts.hasInterface ? (afterBurn * BigInt(INTERFACE_SHARE_BPS)) / bps : 0n
  remainder -= interfaceCut
  const launcherCut = opts.hasLauncher ? (afterBurn * BigInt(LAUNCHER_SHARE_BPS)) / bps : 0n
  remainder -= launcherCut
  const creatorBps = BigInt(
    Math.max(0, Math.min(Math.round(creatorShareBps), MAX_CREATOR_SHARE_BPS)),
  )
  const creatorCut = (remainder * creatorBps) / bps
  const holdersCut = remainder - creatorCut
  const burnCut = FEE - interfaceCut - launcherCut - creatorCut - holdersCut
  const f = (x: bigint) => Number(x) / Number(FEE)
  return {
    burn: f(burnCut),
    interface: f(interfaceCut),
    launcher: f(launcherCut),
    creator: f(creatorCut),
    holders: f(holdersCut),
  }
}
