export type CandleTime = { timestamp: number; pending?: boolean }

export function curveRefreshFrom(rows: CandleTime[]) {
  if (!rows.length) return 0
  const latest = Number(rows[rows.length - 1].timestamp)
  // Reports may arrive after another user's newer trade; also retain the
  // earliest unresolved minute until it has been replaced or removed.
  return Math.max(0, Math.min(latest - 600,
    ...rows.filter(row => row.pending).map(row => Number(row.timestamp))))
}

export function replaceCandleTail<T extends CandleTime>(current: T[], incoming: T[], from: number): T[] {
  return [...current.filter(row => Number(row.timestamp) < from), ...incoming]
}
