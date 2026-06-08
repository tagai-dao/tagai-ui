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

const appendCommerceUrl = (text: string, commerceUrl?: string) => {
  if (!commerceUrl) return text
  const trimmed = text.trimEnd()
  return trimmed ? `${trimmed}\n\n${commerceUrl}` : commerceUrl
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
