/** PCS V4 上架后代币（pair 字段为 PoolKey JSON） */
export const isPcsV4Version = (version?: number | null) =>
    version === 7 || version === 8 || version === 9

/** Social 奖励走 nutboxSocialPool.claim（v8/v9） */
export const usesNutboxSocialPool = (version?: number | null) =>
    version === 8 || version === 9

/** Pump 合约自身暴露 totalClaimedSocialRewards(token) 的版本（仅 v7） */
export const hasPumpTotalClaimedSocialRewards = (version?: number | null) =>
    version === 7

/** v9 使用 HourlyTickCalculator 动态分发 */
export const isHourlyDistributionVersion = (version?: number | null) =>
    version === 9
