import { stringLength } from '@/utils/helper'

/** Twitter 单条推文总字数上限 */
export const TWITTER_TWEET_MAX_LENGTH = 280

export type PredictShareType = 'battle' | 'event'

/** 与 tagai-api `/predict/shareBlink` 拼接规则一致 */
export function buildPredictBlinkUrl(type: PredictShareType, marketAddress: string) {
  return `https://tagai.fun/predict/${type}/${marketAddress}`
}

/**
 * 用户可输入的正文上限。
 * 后端在有正文时会追加 `\n\n${blinkUrl}`，需从 280 中预留该后缀长度。
 */
export function getPredictShareTextMaxLength(type: PredictShareType, marketAddress: string) {
  const blinkSuffix = `\n\n${buildPredictBlinkUrl(type, marketAddress)}`
  return Math.max(0, TWITTER_TWEET_MAX_LENGTH - stringLength(blinkSuffix))
}

/** 按 Twitter 加权字数（与 CreateTweetModal 的 stringLength 一致）截断 */
export function truncateToMaxStringLength(str: string, maxLen: number) {
  if (stringLength(str) <= maxLen) return str
  let result = ''
  let len = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    const charLen = (c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f) ? 1 : 2
    if (len + charLen > maxLen) break
    result += str[i]
    len += charLen
  }
  return result
}
