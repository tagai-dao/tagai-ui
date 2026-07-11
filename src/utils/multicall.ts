import { aggregate } from '@makerdao/multicall'
import { useChainStore } from '@/stores/chain'

/** multicall 按 RPC 列表依次重试，避免公共节点超时导致整批失败 */
export const aggregateWithRpcFallback = async (calls: any[]) => {
  if (calls.length === 0) {
    return { results: { original: {}, transformed: {} } }
  }

  // ChainConfig 是兼容旧代码的 BSC 静态配置，不能用于运行时多链请求。
  // 必须从当前产品链读取 RPC 与 Multicall 地址，避免把 RH 合约发到 BSC RPC。
  const deployment = useChainStore().deployment
  const urls = deployment.rpcUrls?.length ? deployment.rpcUrls : [deployment.rpc]
  let lastError: unknown
  for (const rpcUrl of urls) {
    try {
      return await aggregate(calls, { ...deployment.multiConfig, rpcUrl })
    } catch (error) {
      lastError = error
      console.warn('[multicall] RPC failed, trying next:', rpcUrl)
    }
  }
  throw lastError
}
