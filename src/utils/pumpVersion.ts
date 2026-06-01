/** PCS V4 上架后代币（pair 字段为 PoolKey JSON） */
export const isPcsV4Version = (version?: number | null) =>
    version === 7 || version === 8 || version === 9

/** Social 奖励走 nutboxSocialPool.claim（v8/v9/v10） */
export const usesNutboxSocialPool = (version?: number | null) =>
    version === 8 || version === 9 || version === 10

/** Pump 合约自身暴露 totalClaimedSocialRewards(token) 的版本（仅 v7） */
export const hasPumpTotalClaimedSocialRewards = (version?: number | null) =>
    version === 7

/** v9/v10 使用 HourlyTickCalculator 动态分发 */
export const isHourlyDistributionVersion = (version?: number | null) =>
    version === 9 || version === 10

/** v10 为导入代币，已在 DEX 上架，平台不展示交易功能 */
export const isImportedTokenVersion = (version?: number | null) =>
    version === 10
