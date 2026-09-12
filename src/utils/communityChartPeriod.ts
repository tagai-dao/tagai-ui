export const communityChartPeriods = [
  { key: 'm5', label: '5M', seconds: 300, interval: '5', internal: '5min' },
  { key: 'h1', label: '1H', seconds: 3600, interval: '60', internal: '1h' },
  { key: 'h24', label: '24H', seconds: 86400, interval: '1D', internal: '1d' },
] as const
export type CommunityChartPeriod = typeof communityChartPeriods[number]['key']
export function periodChange(rows: Array<{ timestamp: number; close: number }>, seconds: number, now = Date.now() / 1000): number | null {
  const valid = rows.filter(r => Number.isFinite(Number(r.timestamp)) && Number(r.timestamp) <= now && Number.isFinite(Number(r.close)) && Number(r.close) > 0)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  const baseline = valid.filter(r => Number(r.timestamp) <= now - seconds).at(-1)
  const last = valid.at(-1)
  if (!baseline || !last) return null
  return (Number(last.close) / Number(baseline.close) - 1) * 100
}
