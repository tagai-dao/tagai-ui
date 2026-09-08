/** UI uses 0.1% of the total fee; the contract uses bps of the distributable share. */
export function creatorPercentToBps(percent: number) {
  const snapped = Math.min(24, Math.max(0, Math.round(percent * 10) / 10))
  return Math.min(3000, Math.round(snapped * 10_000 / 80.01))
}

/** Percent of the total fee, before settlement rounding and recipient redirects. */
export function creationFeeAllocation(creatorBps: number) {
  const platform = 10
  const frontend = 90 * 555 / 10_000
  const launcher = frontend
  const distributable = 100 - platform - frontend - launcher
  const creator = distributable * Math.min(3000, Math.max(0, creatorBps)) / 10_000
  return { platform, creator, holders: distributable - creator, frontend, launcher }
}

/** Illustrative value before conversion to WBNB; mirrors BasketToken._distributeFee. */
export function creationFeeExample(feeBps: number, creatorBps: number) {
  const fee = 100 * feeBps / 10_000
  const allocation = creationFeeAllocation(creatorBps)
  return { fee, creator: fee * allocation.creator / 100, distributable: fee * (allocation.creator + allocation.holders) / 100 }
}
