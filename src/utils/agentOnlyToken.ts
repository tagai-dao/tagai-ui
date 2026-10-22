/** Public display metadata only; never used as a wallet/transaction gate. */
export type AgentOnlyTokenMetadata = {
  chainId?: number | string | null
  chain_id?: number | string | null
  version?: number | string | null
  listed?: boolean | number | string | null
  listedBlock?: number | string | null
  listedDayNumber?: number | string | null
  isImport?: boolean | number | string | null
}

const enabled = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'

export function isAgentOnlyCurveToken(token: AgentOnlyTokenMetadata | null | undefined, fallbackChainId: number): boolean {
  if (!token) return false
  return Number(token.chainId ?? token.chain_id ?? fallbackChainId) === 56
    && [15, 16].includes(Number(token.version))
    && !enabled(token.isImport)
    && !enabled(token.listed)
    && !(Number(token.listedBlock) > 0)
    && !(Number(token.listedDayNumber) > 0)
}
