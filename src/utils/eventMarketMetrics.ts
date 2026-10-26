export type EventMarketMetrics = {
  eventPriceUsd?: number | null
  eventMarketCapUsd?: number | null
  eventPriceChange24h?: number | null
  eventPriceTimestamp?: number | null
  eventNativeUsd?: number | null
}
type Event = { token?: string; tweetTime?: unknown; timestamp?: unknown; transHash?: string; logIndex?: string | number } & EventMarketMetrics
type Query = { token: string; timestamp: number; transHash?: string; logIndex?: number }
export function eventTimestamp(value: unknown): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric > 1e12 ? numeric / 1000 : numeric)
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0
}

export async function attachEventMarketMetrics<T extends Event>(rows: T[], chainId: number,
  read: (events: Query[], chainId: number) => Promise<any[]>) {
  const copy = rows.map(row => ({ ...row, eventPriceUsd: null, eventMarketCapUsd: null,
    eventPriceChange24h: null, eventPriceTimestamp: null, eventNativeUsd: null })) as T[]
  const events = new Map<string, Query>()
  const transaction = (row: Event) => /^0x[a-f0-9]{64}$/i.test(row.transHash || '') ? row.transHash!.toLowerCase() : ''
  const keyFor = (row: Event) => `${row.token?.toLowerCase()}:${eventTimestamp(row.tweetTime ?? row.timestamp)}:${transaction(row)}:${row.logIndex ?? ''}`
  for (const row of rows) {
    const timestamp = eventTimestamp(row.tweetTime ?? row.timestamp)
    if (/^0x[a-f0-9]{40}$/i.test(row.token || '') && timestamp > 86400) {
      const transHash = transaction(row)
      events.set(keyFor(row), { token: row.token!.toLowerCase(), timestamp,
        ...(transHash ? { transHash, ...(row.logIndex != null ? { logIndex: Number(row.logIndex) } : {}) } : {}) })
    }
  }
  const metrics = new Map<string, EventMarketMetrics>()
  const unique = [...events.values()]
  for (let i = 0; i < unique.length; i += 30) {
    try {
      const result = await read(unique.slice(i, i + 30), chainId)
      for (const metric of result || []) {
        const key = keyFor(metric)
        if (events.has(key)) metrics.set(key, metric)
      }
    } catch { /* Missing history is not today's quote and must not block the feed. */ }
  }
  for (const row of copy) {
    const metric = metrics.get(keyFor(row))
    if (!metric) continue
    for (const field of ['eventPriceUsd', 'eventMarketCapUsd', 'eventPriceChange24h', 'eventPriceTimestamp', 'eventNativeUsd'] as const) {
      const value = metric[field]
      row[field] = value != null && Number.isFinite(Number(value)) ? Number(value) : null
    }
  }
  return copy
}
