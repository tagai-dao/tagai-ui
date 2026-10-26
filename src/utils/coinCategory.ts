// Product grouping is independent of the ABI used to trade a token.
type CoinCategory = { token?: unknown; version?: unknown; isImport?: unknown; chainId?: unknown; chain_id?: unknown;
  pair?: unknown; listed?: unknown; listedBlock?: unknown; listedDayNumber?: unknown; launchProtocol?: unknown }

// Explicit product membership, scoped by chain and full contract, not ticker.
const externalAgentTokens = new Set([
  '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc', // .ai
  '0x0c6302401aa5325c2e36f170f52c00b1d220b405', // GANG
])

function isExternalAgentLaunch(community: CoinCategory, chainId: number) {
  return Number(community.chainId ?? community.chain_id ?? chainId) === 56
    && (externalAgentTokens.has(String(community.token ?? '').toLowerCase())
      || ['flap-id-agent-curve', 'four-agent-id'].includes(String(community.launchProtocol)))
    && (community.isImport === true || Number(community.isImport) === 1)
}

/** Launchpad provenance is distinct from Agent Launch product membership. */
export function getLaunchPlatform(community: CoinCategory, chainId: number): 'tagai' | 'gang' | 'flap' | 'four' | null {
  if (Number(community.chainId ?? community.chain_id ?? chainId) !== 56) return null
  if (community.launchProtocol === 'flap-id-agent-curve'
    && (community.isImport === true || Number(community.isImport) === 1)) return 'flap'
  if (community.launchProtocol === 'four-agent-id'
    && (community.isImport === true || Number(community.isImport) === 1)) return 'four'
  const token = String(community.token ?? '').toLowerCase()
  if (token === '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc') return null // independent .ai token
  if (token === '0x0c6302401aa5325c2e36f170f52c00b1d220b405') return 'gang'
  return [15, 16, 17].includes(Number(community.version))
    && community.isImport !== true && Number(community.isImport) !== 1 ? 'tagai' : null
}

export function isGraduatedToken(community: CoinCategory, chainId = 56) {
  // Imported routes are API-validated DEX pools, not TagAI bonding curves.
  const importedDex = isExternalAgentLaunch(community, chainId)
    && /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(String(community.pair ?? ''))
    && !/^0x0+$/i.test(String(community.pair))
  return community.listed === true || community.listed === 1 || community.listed === '1' || community.listed === 'true'
    || Number(community.listedBlock) > 0 || Number(community.listedDayNumber) > 0
    || importedDex
}

export function isAgentLaunch(community: CoinCategory, chainId: number) {
  return isExternalAgentLaunch(community, chainId) || (Number(community.chainId ?? community.chain_id ?? chainId) === 56
    && [15, 16, 17].includes(Number(community.version))
    && community.isImport !== true && Number(community.isImport) !== 1)
}

export function isMemeEtf(community: { version?: unknown; isImport?: unknown }, chainId: number) {
  if (community.isImport === true || Number(community.isImport) === 1) return false
  return (chainId === 4663 ? [11, 14] : [13, 14]).includes(Number(community.version))
}
