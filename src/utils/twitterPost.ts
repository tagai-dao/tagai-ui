/** 发帖跳转 Twitter 前补齐平台标签与社区标签 */
const TAGAI_MENTION_RE = /@TagAIDAO/i
const TAGAI_HASHTAG_RE = /#TagAI/i

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 是否已包含 @TagAIDAO 或 #TagAI */
export const hasTagAiMarker = (text: string) =>
  TAGAI_MENTION_RE.test(text) || TAGAI_HASHTAG_RE.test(text)

/** 是否已包含社区标签 #tick */
export const hasCommunityTick = (text: string, tick?: string) => {
  if (!tick) return true
  const escaped = escapeRegExp(tick)
  return new RegExp(`#${escaped}(?:\\b|$)`, 'i').test(text)
}

/**
 * 补齐缺失的 #TagAI 与社区 #tick 标签
 * - 无 @TagAIDAO / #TagAI 时追加 #TagAI
 * - 无社区标签时追加 #tick
 */
export const prepareTwitterPostText = (text: string, tick?: string) => {
  let result = text.trimEnd()
  const tagsToAppend: string[] = []

  if (!hasTagAiMarker(result)) {
    tagsToAppend.push('#TagAI')
  }
  if (tick && !hasCommunityTick(result, tick)) {
    tagsToAppend.push(`#${tick}`)
  }
  if (tagsToAppend.length > 0) {
    result = `${result} ${tagsToAppend.join(' ')}`
  }
  return result
}

export type TwitterIntentOptions = {
  text: string
  tick?: string
  /** commerce blink 链接，追加在正文末尾 */
  commerceUrl?: string
  replyToTweetId?: string
  quoteTweetUsername?: string
  quoteTweetId?: string
}

/** accountType === 0 为绑定真实 Twitter 的账号，需自行去推特发帖 */
export const isNativeTwitterAccount = (accountType?: number | null) =>
  accountType === 0

const appendCommerceUrl = (text: string, commerceUrl?: string) => {
  if (!commerceUrl) return text
  const trimmed = text.trimEnd()
  return trimmed ? `${trimmed}\n\n${commerceUrl}` : commerceUrl
}

/** 平台 API 发帖时拼接正文（含标签与 commerce 链接） */
export const buildPlatformPostText = (text: string, options?: { tick?: string; commerceUrl?: string }) =>
  appendCommerceUrl(prepareTwitterPostText(text, options?.tick), options?.commerceUrl)

/** 是否为真实 Twitter 推文 ID（纯数字且长度足够） */
export const isRealTwitterTweetId = (tweetId?: string | null) =>
  !!tweetId && /^\d{15,}$/.test(tweetId)

/** 打开 Twitter 转推页 */
export const openTwitterRetweetIntent = (tweetId: string) => {
  window.open(`https://x.com/intent/retweet?tweet_id=${tweetId}`, '_blank')
}

/** 打开 Twitter 发帖页（新推 / 回复 / 引用） */
export const openTwitterIntent = (options: TwitterIntentOptions) => {
  let text = prepareTwitterPostText(options.text, options.tick)
  text = appendCommerceUrl(text, options.commerceUrl)
  let url: string

  if (options.replyToTweetId) {
    url = `https://x.com/intent/tweet?in_reply_to=${options.replyToTweetId}&text=${encodeURIComponent(text)}`
  } else if (options.quoteTweetId && options.quoteTweetUsername) {
    url = `https://x.com/intent/tweet?url=${encodeURIComponent(`https://x.com/${options.quoteTweetUsername}/status/${options.quoteTweetId}`)}&text=${encodeURIComponent(text)}`
  } else {
    url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
  }

  window.open(url, '_blank')
}
