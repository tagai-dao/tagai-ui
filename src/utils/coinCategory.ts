// Product grouping is independent of the ABI used to trade a token.
export function isAgentLaunch(community: { version?: unknown; isImport?: unknown; chainId?: unknown; chain_id?: unknown }, chainId: number) {
  return Number(community.chainId ?? community.chain_id ?? chainId) === 56
    && [15, 16].includes(Number(community.version))
    && community.isImport !== true && Number(community.isImport) !== 1
}

export function isMemeEtf(community: { version?: unknown; isImport?: unknown }, chainId: number) {
  if (community.isImport === true || Number(community.isImport) === 1) return false
  return (chainId === 4663 ? [11, 14] : [13, 14]).includes(Number(community.version))
}
