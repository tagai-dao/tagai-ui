type TokenIdentity = {
  tick?: unknown; token?: unknown; isImport?: unknown; launchProtocol?: unknown;
  chainId?: unknown; chain_id?: unknown;
}

// These two imported symbols were sanitized to "ai" for the unique community tick.
// Restore their exact symbol only in presentation; routes keep using the stored tick.
const originalSymbols: Record<string, string> = {
  '0xbdfcd595f1d8d2d9b8c7e9754e2636cf29fd7777': '.ai',
  '0x3437febd7b451a2293787fb84fcdf2f9c9797777': '.ai',
}

export function tokenDisplayName(community: TokenIdentity, activeChainId: number) {
  const tick = String(community.tick ?? '')
  const unchanged = { name: tick, suffix: '' }
  if (Number(community.chainId ?? community.chain_id ?? activeChainId) !== 56
    || community.launchProtocol !== 'flap-id-agent-curve'
    || !(community.isImport === true || Number(community.isImport) === 1)) return unchanged
  const token = String(community.token ?? '').toLowerCase()
  const parts = /^(.+)_([a-f0-9]{4,8})$/i.exec(tick)
  if (!/^0x[a-f0-9]{40}$/.test(token) || !parts || !token.endsWith(parts[2]!.toLowerCase())) return unchanged
  return { name: originalSymbols[token] || parts[1]!, suffix: `@${parts[2]}` }
}
