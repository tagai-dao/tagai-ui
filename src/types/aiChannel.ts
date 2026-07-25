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
}

export type AiChannelDetail = {
  channel: Omit<AiChannel, 'rootAuthor' | 'summaryStatus'>
  messages: AiChannelMessage[]
}

export type AiChannelReplyInput = {
  twitterId: string
  content: string
  expectedLatestMessageId: string
  quotedTweetId?: string
  idempotencyKey: string
  curate?: boolean
}

export type AiChannelQuoteDraft = Pick<
  Tweet,
  'tweetId' | 'content' | 'twitterName' | 'twitterUsername' | 'profile' | 'tweetTime' | 'tick'
>
