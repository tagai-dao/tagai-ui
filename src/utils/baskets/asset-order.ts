// Keep the BSC ETH/BTC constituents last, regardless of API or catalog order.
const trailingAssets = [
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
]

export function sortBasketAssetOptions<T extends { address: string }>(assets: readonly T[]): T[] {
  const rank = (asset: T) => trailingAssets.indexOf(asset.address.toLowerCase()) + 1
  return [...assets].sort((a, b) => rank(a) - rank(b))
}
