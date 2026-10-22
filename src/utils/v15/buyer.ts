import { parseAbi, type Address, type PublicClient } from 'viem'
import { getChainDeployment } from '@/config/chains'

export const handleAbi = parseAbi(['function handleOf(address account) view returns (string)'])
export const requiresBuyerHandle = (chainId: number, version: number) => chainId === 56 && [15, 16].includes(Number(version))
export function buyerHandleCall(account: Address) {
  const address = getChainDeployment(56).contracts.handleRegistry15
  if (!address) throw new Error('V15_HANDLE_UNAVAILABLE')
  return {address, abi: handleAbi, functionName: 'handleOf' as const, args: [account] as const}
}
export function assertBuyerHandle(handle: unknown) {
  if (typeof handle !== 'string') throw new Error('V15_HANDLE_UNAVAILABLE')
  if (handle.length === 0) throw new Error('V15_HANDLE_NOT_REGISTERED')
}

/** Read the connected address before an amount is entered; transaction quotes still recheck it. */
export async function readBuyerHandle(client: PublicClient, account: Address): Promise<boolean> {
  if (client.chain?.id !== 56) throw new Error('V15_HANDLE_UNAVAILABLE')
  const blockNumber = await client.getBlockNumber()
  const [handle] = await client.multicall({blockNumber, allowFailure: false, contracts: [buyerHandleCall(account)]})
  if (typeof handle !== 'string') throw new Error('V15_HANDLE_UNAVAILABLE')
  return handle.length > 0
}
