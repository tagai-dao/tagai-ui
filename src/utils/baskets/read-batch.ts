import { getChainDeployment } from '@/config/chains'
import { getReadOnlyClient } from '@/utils/wallets'

/** Contract read stages/chunks share a caller-supplied block; no RPC fallback. */
export async function readBasketBatch(contracts: any[], chainId: number, blockNumber: bigint, allowFailure = false): Promise<any[]> {
  const client = getReadOnlyClient(chainId)
  if (client.chain && client.chain.id !== chainId) throw new Error('Basket read chain mismatch')
  const output: any[] = []
  for (let start = 0; start < contracts.length; start += 25) {
    output.push(...await client.multicall({
      multicallAddress: getChainDeployment(chainId).multiConfig.multicallAddress,
      blockNumber,
      batchSize: 0,
      allowFailure,
      contracts: contracts.slice(start, start + 25),
    }))
  }
  return output
}
