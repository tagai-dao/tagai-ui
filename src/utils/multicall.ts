import { aggregate } from '@makerdao/multicall'
import { ChainConfig } from '@/config'

/** multicall 按 RPC 列表依次重试，避免公共节点超时导致整批失败 */
export const aggregateWithRpcFallback = async (calls: any[]) => {
  const urls = ChainConfig.rpcUrls?.length ? ChainConfig.rpcUrls : [ChainConfig.rpc]
  let lastError: unknown
  for (const rpcUrl of urls) {
    try {
      return await aggregate(calls, { ...ChainConfig.multiConfig, rpcUrl })
    } catch (error) {
      lastError = error
      console.warn('[multicall] RPC failed, trying next:', rpcUrl)
    }
  }
  throw lastError
}
