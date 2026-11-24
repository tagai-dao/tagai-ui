/** Bound long-lived charts and replace overlapping incremental timestamps. */
export function boundedCandles<T extends { timestamp: number }>(rows: T[], limit = 10000): T[] {
  const byTime = new Map<number, T>()
  for (const row of rows) {
    const timestamp = Number(row.timestamp)
    if (Number.isFinite(timestamp)) byTime.set(timestamp, row)
  }
  return [...byTime.values()].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).slice(-limit)
}
