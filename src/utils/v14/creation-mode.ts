/** Creation policy is fixed by the deployed Pump, never a mutable Token setting. */
export function creationVersionForMode(chainId: number, binanceWalletOnly = false): 14 | 15 {
  if (typeof binanceWalletOnly !== 'boolean' || ![56, 4663].includes(chainId)
      || (chainId !== 56 && binanceWalletOnly)) throw new Error('Unsupported creation mode')
  return binanceWalletOnly ? 15 : 14
}
