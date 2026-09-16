type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

/** Verify the actual provider network, not the chain cached in a UI/client. */
export async function ensureWalletChain(provider: Provider, chainId: number, chainParameters: object) {
  const read = async () => Number(await provider.request({ method: 'eth_chainId' }))
  if (await read() === chainId) return
  const switchNetwork = () => provider.request({
    method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }],
  })
  try {
    await switchNetwork()
  } catch (error: any) {
    // viem can wrap provider errors in UnknownRpcError / RpcRequestError.
    let cause = error
    let unknownChain = false
    for (let depth = 0; cause && depth < 6; depth++, cause = cause.cause) {
      if (Number(cause.code) === 4001 || Number(cause.code) === -32002) throw error
      if (Number(cause.code) === 4902) unknownChain = true
    }
    if (!unknownChain) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [chainParameters] })
    // Adding a chain does not guarantee the wallet switched to it.
    await switchNetwork()
  }
  if (await read() !== chainId) throw new Error('Wallet network did not switch. Please select the target network and retry.')
}
