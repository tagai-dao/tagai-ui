import bscAssets from '@/utils/v13/creation-assets.json'
import rhAssets from '@/utils/v14/rh-creation-assets.json'
import rhDisplayAssets from '@/utils/v14/rh-display-stock-assets.json'

// Company artwork is selected by a reviewed chain/contract identity, never by
// a community's editable ticker or logo. Display-only stocks do not affect
// creation eligibility, approved constituents, or trading routes.
const logosByChain = new Map<number, Map<string, string>>([
  [56, new Map(bscAssets
    .filter(a => a.assetType === 'stock' || a.assetType === 'etf' || a.symbol === 'RDDTB')
    .map(a => [a.address.toLowerCase(), a.logoUrl]))],
  [4663, new Map([...rhAssets, ...rhDisplayAssets].map(a => [a.address.toLowerCase(), a.logoUrl]))],
])

export function stockCompanyLogo(chainId: number, token?: string | null): string | undefined {
  return token ? logosByChain.get(chainId)?.get(token.toLowerCase()) : undefined
}
