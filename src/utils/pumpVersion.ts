/** MySQL / JSON 可能返回字符串，统一转为数字再比较 */
export const normalizePumpVersion = (version?: number | string | null) => {
    const v = Number(version)
    return Number.isFinite(v) ? v : 0
}

/** PCS V4 上架后代币（pair 字段为 PoolKey JSON） */
export const isPcsV4Version = (version?: number | string | null) => {
    const v = normalizePumpVersion(version)
    return v === 7 || v === 8 || v === 9
}

/** Social 奖励走 nutboxSocialPool.claim（v8/v9/v10） */
export const usesNutboxSocialPool = (version?: number | string | null) => {
    const v = normalizePumpVersion(version)
    return v === 8 || v === 9 || v === 10
}

/** Pump 合约自身暴露 totalClaimedSocialRewards(token) 的版本（仅 v7） */
export const hasPumpTotalClaimedSocialRewards = (version?: number | null) =>
    version === 7

/** v9/v10 使用 HourlyTickCalculator 动态分发 */
export const isHourlyDistributionVersion = (version?: number | string | null) => {
    const v = normalizePumpVersion(version)
    return v === 9 || v === 10
}

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

/** v10 为导入代币，已在 DEX 上架，平台不展示交易功能 */
export const isImportedTokenVersion = (version?: number | string | null) =>
    normalizePumpVersion(version) === 10

type ListedV4Community = {
    listed?: boolean
    version?: number | null
    dexVersion?: number | null
    pair?: string | null
}

/**
 * 上市后是否走 PCS V4 询价/交易。
 * 覆盖：Pump v7-v9（pair 为 PoolKey JSON）、导入币 v10+dexVersion=4（pair 为 poolId bytes32）。
 */
export const usesListedV4Quote = (community?: ListedV4Community | null): boolean => {
    if (!community?.listed || !community.pair?.trim()) return false
    if (isPcsV4Version(community.version)) return true
    if (community.version === 10 && community.dexVersion === 4) return true
    // pair 为 bytes32 poolId（0x + 64 hex），非 Uniswap V2 pair 地址（0x + 40 hex）
    const trimmed = community.pair.trim()
    return trimmed.startsWith('0x') && trimmed.length === 66
}
