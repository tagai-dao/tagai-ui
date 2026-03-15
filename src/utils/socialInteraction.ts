/**
 * 社交交互工具
 * VP (Voting Power) 系统和捐赠功能
 * 从 Donut 迁移
 */

import { useAccountStore } from '@/stores/web3'

// ======================== VP 配置 ========================

/**
 * VP 消耗配置
 */
export const VP_CONSUME = Object.freeze({
    QUOTE: 15,      // 引用推文消耗 15 VP
    RETWEET: 10,    // 转发消耗 10 VP
    LIKE: 3,        // 点赞消耗 3 VP
    REPLY: 5,       // 回复消耗 5 VP
})

/**
 * 最大 VP 值
 */
export const MAX_VP = 300

/**
 * VP 恢复周期 (天数)
 * 每 5 天完全恢复 VP
 */
export const VP_RECOVER_DAY = 5

// ======================== VP 管理函数 ========================

/**
 * 计算当前 VP
 * VP 会随时间自动恢复
 * @param lastVP 上次记录的 VP
 * @param lastUpdateTime 上次更新时间戳
 * @returns 当前 VP 值
 */
export const calculateCurrentVP = (lastVP: number, lastUpdateTime: number): number => {
    const now = Date.now()
    const timeDiff = now - lastUpdateTime

    // VP 恢复速度: MAX_VP / (VP_RECOVER_DAY * 24 * 60 * 60 * 1000)
    const recoveredVP = (timeDiff * MAX_VP) / (86400000 * VP_RECOVER_DAY)

    let currentVP = parseFloat((lastVP + recoveredVP).toFixed(2))

    // VP 不能超过最大值
    if (currentVP > MAX_VP) {
        currentVP = MAX_VP
    }

    return currentVP
}

/**
 * 检查是否有足够的 VP
 * @param requiredVP 需要的 VP
 * @param currentVP 当前 VP (可选,会自动计算)
 * @returns 是否有足够的 VP
 */
export const hasEnoughVP = (requiredVP: number, currentVP?: number): boolean => {
    if (currentVP === undefined) {
        const accountStore = useAccountStore()
        const account = accountStore.account
        if (!account || !account.lastUpdateVpStamp) {
            return false
        }
        currentVP = calculateCurrentVP(account.vp || 0, account.lastUpdateVpStamp)
    }

    return currentVP >= requiredVP
}

/**
 * 消耗 VP
 * @param amount 消耗的 VP 数量
 * @returns 是否成功消耗
 */
export const consumeVP = (amount: number): boolean => {
    const accountStore = useAccountStore()
    const account = accountStore.account

    if (!account || !account.lastUpdateVpStamp) {
        return false
    }

    const currentVP = calculateCurrentVP(account.vp || 0, account.lastUpdateVpStamp)

    if (currentVP < amount) {
        return false
    }

    // 更新 VP
    accountStore.account = {
        ...account,
        vp: currentVP - amount,
        lastUpdateVpStamp: Date.now()
    }

    return true
}

/**
 * 返还 VP (操作失败时)
 * @param amount 返还的 VP 数量
 */
export const refundVP = (amount: number): void => {
    const accountStore = useAccountStore()
    const account = accountStore.account

    if (!account) {
        return
    }

    accountStore.account = {
        ...account,
        vp: (account.vp || 0) + amount,
        lastUpdateVpStamp: Date.now()
    }
}

/**
 * 获取 VP 百分比
 * @param vp VP 值 (可选,会自动计算当前 VP)
 * @returns VP 百分比 (0-100)
 */
export const getVPPercentage = (vp?: number): number => {
    if (vp === undefined) {
        const accountStore = useAccountStore()
        const account = accountStore.account
        if (!account || !account.lastUpdateVpStamp) {
            return 0
        }
        vp = calculateCurrentVP(account.vp || 0, account.lastUpdateVpStamp)
    }

    return parseFloat(((vp * 100) / MAX_VP).toFixed(2))
}

// ======================== 社交交互辅助函数 ========================

/**
 * 检查策展周期是否过期
 * @param tweetDayNumber 推文的日期编号
 * @param curationCycle 策展周期 (天数)
 * @returns 是否过期
 */
export const curationIsExpired = (tweetDayNumber: number, curationCycle: number): boolean => {
    const todayNumber = Math.floor(Date.now() / 86400000)
    return (parseInt(curationCycle.toString()) + tweetDayNumber) <= todayNumber
}

/**
 * 检查该操作是否需要消耗 VP
 * @param tweet 推文对象
 * @param curationCycle 策展周期
 * @param currentUserTwitterId 当前用户的 Twitter ID
 * @returns 是否需要消耗 VP
 */
export const needVP = (
    tweet: any,
    curationCycle: number,
    currentUserTwitterId: string
): boolean => {
    // 策展周期已过期,不需要 VP
    if (curationIsExpired(tweet.dayNumber, curationCycle)) {
        return false
    }

    // 自己的推文,不需要 VP
    if (tweet.twitterId === currentUserTwitterId) {
        return false
    }

    return true
}

// ======================== 捐赠相关类型 ========================

export interface DonateParams {
    tweetId: string
    targetTwitterId: string
    subject: string
    ethAmount: number
    twitterId: string
    fomoRound?: number
    transHash: string
}

export interface SellShareParams {
    twitterId: string
    subject: string
    ethAmount: number
    ipshareAmount: number
    transHash: string
}
