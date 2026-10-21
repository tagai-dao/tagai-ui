// Product grouping is independent of the ABI used to trade a token.
export function isMemeEtf(community: { version?: unknown; isImport?: unknown }, chainId: number) {
  if (community.isImport === true || Number(community.isImport) === 1) return false
  return (chainId === 4663 ? [11, 14] : [13, 14, 15]).includes(Number(community.version))
}
