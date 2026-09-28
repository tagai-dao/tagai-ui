type CandlePrice = { open: number; high: number; low: number; close: number }

/** Keep six significant digits for small USD prices. KLineCharts also uses
 * price precision to set the minimum Y-axis range, not just label formatting.
 */
export function klinePricePrecision(rows: CandlePrice[]): number {
  let smallest = Infinity
  for (const row of rows) {
    for (const value of [row.open, row.high, row.low, row.close]) {
      if (Number.isFinite(value) && value > 0) smallest = Math.min(smallest, value)
    }
  }
  return Number.isFinite(smallest)
    ? Math.min(20, Math.max(6, 5 - Math.floor(Math.log10(smallest))))
    : 6
}
