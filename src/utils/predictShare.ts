import { stringLength } from '@/utils/helper'
import { COMMERCE_SITE_URL } from '@/config'

/** Twitter 单条推文总字数上限 */
export const TWITTER_TWEET_MAX_LENGTH = 280

export type PredictShareType = 'battle' | 'event'

/** commerceId 长度不固定，分享前用估算值预留后缀空间 */
const COMMERCE_URL_ESTIMATE = `${COMMERCE_SITE_URL}${'x'.repeat(22)}`

export function buildCommerceBlinkUrl(commerceId: string) {
  return `${COMMERCE_SITE_URL}${commerceId}`
}

/**
 * 用户可输入的正文上限。
 * 发帖时会追加 `\n\n${commerceUrl}`，需从 280 中预留该后缀长度。
 */
export function getCommerceShareTextMaxLength(commerceUrl?: string) {
  const blinkSuffix = `\n\n${commerceUrl || COMMERCE_URL_ESTIMATE}`
  return Math.max(0, TWITTER_TWEET_MAX_LENGTH - stringLength(blinkSuffix))
}

/** @deprecated 使用 getCommerceShareTextMaxLength */
export function getPredictShareTextMaxLength(_type: PredictShareType, _marketAddress: string) {
  return getCommerceShareTextMaxLength()
}

/** @deprecated 使用 buildCommerceBlinkUrl */
export function buildPredictBlinkUrl(_type: PredictShareType, _marketAddress: string) {
  return COMMERCE_URL_ESTIMATE
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
