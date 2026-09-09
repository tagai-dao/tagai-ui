import { parseAbi, zeroAddress, type Address } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { getChainDeployment } from '@/config/chains'

const abi = parseAbi([
  'function nutboxCommunity() view returns(address)',
  'function feeRatio() view returns(uint16)',
  'function rewardCalculator() view returns(address)',
  'function calculateReward(address,uint256,uint256) view returns(uint256)',
])

/** Next 24 hourly ticks of community rewards, net of protocol fees, across all LP pools. */
export async function readCommunityDailyRewards(token: Address): Promise<bigint> {
  const client = getReadOnlyClient(56), block = await client.getBlock()
  const community = await client.readContract({ address: token, abi, functionName: 'nutboxCommunity', blockNumber: block.number })
  if (community === zeroAddress) return 0n
  const [fee, calculator] = await Promise.all([
    client.readContract({ address: community, abi, functionName: 'feeRatio', blockNumber: block.number }),
    client.readContract({ address: community, abi, functionName: 'rewardCalculator', blockNumber: block.number }),
  ])
  if (fee > 10000 || calculator.toLowerCase() !== getChainDeployment(56).contracts.hourlyTickCalculator.toLowerCase()) {
    throw new Error('V13_REWARD_CONFIG_UNAVAILABLE')
  }
  const start = block.timestamp / 3600n * 3600n
  const gross = await client.readContract({ address: calculator, abi, functionName: 'calculateReward', args: [community, start, start + 86400n], blockNumber: block.number })
  return gross * BigInt(10000 - fee) / 10000n
}
