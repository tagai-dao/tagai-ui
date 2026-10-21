import { parseAbi, type Address } from 'viem'
import { getChainDeployment } from '@/config/chains'

export const handleAbi = parseAbi(['function handleOf(address account) view returns (string)'])
export const requiresBuyerHandle = (chainId: number, version: number) => chainId === 56 && Number(version) === 15
export function buyerHandleCall(account: Address) {
  const address = getChainDeployment(56).contracts.handleRegistry15
  if (!address) throw new Error('V15_HANDLE_UNAVAILABLE')
  return {address, abi: handleAbi, functionName: 'handleOf' as const, args: [account] as const}
}
export function assertBuyerHandle(handle: unknown) {
  if (typeof handle !== 'string') throw new Error('V15_HANDLE_UNAVAILABLE')
  if (handle.length === 0) throw new Error('V15_HANDLE_NOT_REGISTERED')
}
