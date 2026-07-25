import type { Tweet } from '@/types'

export type AiChannelAuthor = {
  twitterId?: string | null
  name: string
  username: string
  profile: string
  accountType?: number | null
  xUsername?: string
  tagAiUsername?: string
}

export type AiChannel = {
  id: number
  tick: string
  rootTweetId: string
  agentTwitterId: string
  chainId: number
  summary: string
  summaryStatus: number
  lastMessageId: string
  lastActivityAt: string
  messageCount: number
  rootAuthor: AiChannelAuthor
  agent: AiChannelAuthor
}

export type AiChannelPage = {
  items: AiChannel[]
  nextCursor: string | null
}

export type AiChannelQuotedTweet = {
  tweetId: string
  content: string
  createdAt?: string
  author: AiChannelAuthor
  xUrl?: string | null
}

export type AiChannelReactionType = 'like' | 'love' | 'laugh'

export type AiChannelReaction = {
  type: AiChannelReactionType
  count: number
  reactedByMe: boolean
}

export type AiChannelMessage = {
  id: string
  rawId: string
  channelId: number
  source: 'x' | 'steem'
  type: 'root' | 'mention' | 'agent_reply' | 'user_reply'
  parentId?: string | null
  author: AiChannelAuthor
  content: string
  pageInfo?: string | null
  videoLink?: string | null
  createdAt: string
  xUrl?: string | null
  quotedTweet?: AiChannelQuotedTweet | null
  publishState?: number | null
  publishError?: string | null
  reactions: AiChannelReaction[]
}

export type AiChannelDetail = {
  channel: Omit<AiChannel, 'rootAuthor' | 'summaryStatus'>
  messages: AiChannelMessage[]
}

export type AiChannelReplyInput = {
  twitterId: string
  content: string
  expectedLatestMessageId: string
  parentMessageId?: string
  quotedTweetId?: string
  idempotencyKey: string
  curate?: boolean
}

export type AiChannelReactionInput = {
  twitterId: string
  messageId: string
  reaction: AiChannelReactionType
  active: boolean
}

export type AiChannelReplyResult = {
  id: string
  rawId: string
  channelId: number
  parentId: string
  content: string
  publishState: number
  channelVisible: boolean
  agentReplyEligible: boolean
  agentEligibilityReason?: string | null
  agentEligibilityRequestId?: string | null
  idempotentReplay: boolean
}

export type AiChannelQuoteDraft = Pick<
  Tweet,
  'tweetId' | 'content' | 'twitterName' | 'twitterUsername' | 'profile' | 'tweetTime' | 'tick'
>
