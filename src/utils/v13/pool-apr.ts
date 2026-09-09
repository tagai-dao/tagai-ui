import {encodeAbiParameters,keccak256,parseAbi,type Address} from 'viem'
import {getReadOnlyClient} from '@/utils/wallets'
import {getChainDeployment} from '@/config/chains'

const communityAbi=parseAbi(['function feeRatio() view returns(uint16)','function rewardCalculator() view returns(address)'])
const calculatorAbi=parseAbi(['function calculateReward(address,uint256,uint256) view returns(uint256)'])
// V13 Community.sol storage layout: private mapping(address => uint16) poolRatios.
// Zero is a valid reward allocation; never replace it with the asset weight.
const POOL_RATIOS_SLOT=10n
export type PoolRewards={daily:bigint;ratio:number;block:bigint}
export async function readPoolRewards(community:Address,pool:Address):Promise<PoolRewards>{
 const client=getReadOnlyClient(56),block=await client.getBlock()
 const slot=keccak256(encodeAbiParameters([{type:'address'},{type:'uint256'}],[pool,POOL_RATIOS_SLOT]))
 const [fee,calculator,raw]=await Promise.all([
  client.readContract({address:community,abi:communityAbi,functionName:'feeRatio',blockNumber:block.number}),
  client.readContract({address:community,abi:communityAbi,functionName:'rewardCalculator',blockNumber:block.number}),
  client.getStorageAt({address:community,slot,blockNumber:block.number})
 ])
 if(!raw||BigInt(raw)>10000n||fee>10000)throw new Error('V13_REWARD_RATIO_UNAVAILABLE')
 if(calculator.toLowerCase()!==getChainDeployment(56).contracts.hourlyTickCalculator.toLowerCase())throw new Error('V13_REWARD_CALCULATOR_UNSUPPORTED')
 const ratio=BigInt(raw),head=block.timestamp/3600n*3600n
 const gross=await client.readContract({address:calculator,abi:calculatorAbi,functionName:'calculateReward',args:[community,head,head+86400n],blockNumber:block.number})
 return {daily:gross*BigInt(10000-fee)/10000n*ratio/10000n,ratio:Number(ratio),block:block.number}
}

/** Annualized next-24h rewards / staked LP value in T. Both pair sides have equal spot value. */
export function poolAprBps(daily:bigint,reserveToken:bigint,supply:bigint,staked:bigint,active:boolean):bigint|undefined{
 if(reserveToken<=0n||supply<=0n||staked<=0n)return undefined
 if(!active)return 0n
 return daily*365n*supply*10000n/(2n*reserveToken*staked)
}
