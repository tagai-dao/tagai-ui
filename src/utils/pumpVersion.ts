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

/** DexScreener embed 路径：v7-v9 与 v10 导入币用 token 地址，v2/v3 导入币用 pair 合约地址 */
export const getDexScreenerEmbedPath = (community?: {
    version?: number | null
    isImport?: boolean | number | null
    dexVersion?: number | null
    token?: string
    pair?: string
} | null) => {
    if (!community) return ''
    if (community.isImport) {
        // dexVersion=4 时 pair 为 PCS poolId（bytes32），DexScreener 无法识别
        return community.dexVersion === 4 || isPcsV4Version(community.version)
            ? community.token
            : community.pair
    }
    return isPcsV4Version(community.version) ? community.token : community.pair
}
