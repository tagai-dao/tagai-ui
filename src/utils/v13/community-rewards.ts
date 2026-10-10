import {useChainStore} from '@/stores/chain'
import { parseAbi, zeroAddress, type Address } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { getChainDeployment } from '@/config/chains'

const abi = parseAbi([
  'function nutboxCommunity() view returns(address)',
  'function feeRatio() view returns(uint16)',
  'function rewardCalculator() view returns(address)',
  'function calculateReward(address,uint256,uint256) view returns(uint256)',
  'function getHourlyRewards(address,uint256,uint256) view returns(uint256[])',
])

async function readRewardContext(token: Address) {
  const client = getReadOnlyClient(useChainStore().activeChainId), block = await client.getBlock()
  const community = await client.readContract({ address: token, abi, functionName: 'nutboxCommunity', blockNumber: block.number })
  if (community === zeroAddress) return undefined
  const [fee, calculator] = await client.multicall({blockNumber:block.number,allowFailure:false,contracts:['feeRatio','rewardCalculator'].map(functionName=>({address:community,abi,functionName}))}) as [number,Address]
  if (fee > 10000 || calculator.toLowerCase() !== getChainDeployment(useChainStore().activeChainId).contracts.hourlyTickCalculator.toLowerCase()) {
    throw new Error('V13_REWARD_CONFIG_UNAVAILABLE')
  }
  return { client, block, community, calculator, netRatio: BigInt(10000 - fee) }
}

/** Next 24 hourly ticks of community rewards, net of protocol fees, across all pools. */
export async function readCommunityDailyRewards(token: Address): Promise<bigint> {
  const context = await readRewardContext(token)
  if (!context) return 0n
  const { client, block, community, calculator, netRatio } = context
  const start = block.timestamp / 3600n * 3600n
  const gross = await client.readContract({ address: calculator, abi, functionName: 'calculateReward', args: [community, start, start + 86400n], blockNumber: block.number })
  return gross * netRatio / 10000n
}

/** Past seven UTC days (including today) plus tomorrow, using the current fee configuration. */
export async function readCommunityRewardSchedule(token: Address) {
  const context = await readRewardContext(token)
  if (!context) return undefined
  const { client, block, community, calculator, netRatio } = context
  const todayIndex = 6
  const start = block.timestamp / 86400n * 86400n - BigInt(todayIndex) * 86400n
  const gross = await client.readContract({ address: calculator, abi, functionName: 'getHourlyRewards',
    args: [community, start, 192n], blockNumber: block.number })
  if (gross.length !== 192) throw new Error('COMMUNITY_REWARD_SCHEDULE_INCOMPLETE')
  const hourlyRewards = gross.map(amount => amount * netRatio / 10000n)
  return {
    todayIndex,
    currentHour: Number(block.timestamp / 3600n % 24n),
    dayStarts: Array.from({ length: 8 }, (_, day) => Number(start) + day * 86400),
    dailyRewards: Array.from({ length: 8 }, (_, day) =>
      hourlyRewards.slice(day * 24, (day + 1) * 24).reduce((sum, amount) => sum + amount, 0n)),
    hourlyRewards,
  }
}
