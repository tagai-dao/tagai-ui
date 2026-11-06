import type { FeedTrade, Tweet } from '@/types'

export function feedTimestamp(value: string | number | Date | null | undefined): number {
  if (value === undefined || value === null || value === '') return 0
  if (value instanceof Date) return value.getTime()
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export function feedPageBoundary(values: Array<string | number | Date | null | undefined>) {
  return values.length ? Math.min(...values.map(feedTimestamp)) : 0
}

export function needsFeedPage(boundary: number, finished: boolean, otherBoundary: number, otherFinished: boolean) {
  return !finished && (otherFinished || boundary >= otherBoundary)
}

/** Only publish the time range covered by BOTH independently paginated sources.
 * Otherwise an old post sits below newer trades, then moves down on every page.
 * Exhausted sources have no boundary and release their remaining buffered rows.
 */
export function mergeCommunityFeed(posts: Tweet[], trades: FeedTrade[], boundary = 0) {
  const items: Array<{ type: 'post'; tweet: Tweet } | { type: 'trade'; trade: FeedTrade }> = [
    ...posts.map(tweet => ({ type: 'post' as const, tweet })),
    ...trades.map(trade => ({ type: 'trade' as const, trade })),
  ]
  const timestamp = (item: typeof items[number]) => item.type === 'post'
    ? feedTimestamp(item.tweet.tweetTime) : feedTimestamp(item.trade.timestamp)
  return items.filter(item => timestamp(item) >= boundary).sort((a, b) => timestamp(b) - timestamp(a))
}
