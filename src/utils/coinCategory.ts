// Product grouping is independent of the ABI used to trade a token.
type CoinCategory = { token?: unknown; version?: unknown; isImport?: unknown; chainId?: unknown; chain_id?: unknown;
  pair?: unknown; listed?: unknown; listedBlock?: unknown; listedDayNumber?: unknown }

function isExternalAgentLaunch(community: CoinCategory, chainId: number) {
  return Number(community.chainId ?? community.chain_id ?? chainId) === 56
    && String(community.token ?? '').toLowerCase() === '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc'
    && (community.isImport === true || Number(community.isImport) === 1)
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
    && [15, 16].includes(Number(community.version))
    && community.isImport !== true && Number(community.isImport) !== 1)
}

export function isMemeEtf(community: { version?: unknown; isImport?: unknown }, chainId: number) {
  if (community.isImport === true || Number(community.isImport) === 1) return false
  return (chainId === 4663 ? [11, 14] : [13, 14]).includes(Number(community.version))
}
