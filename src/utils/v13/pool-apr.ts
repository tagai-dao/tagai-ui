import {encodeAbiParameters,keccak256,parseAbi,type Address} from 'viem'
import {getReadOnlyClient} from '@/utils/wallets'
import {getChainDeployment} from '@/config/chains'

const communityAbi=parseAbi(['function feeRatio() view returns(uint16)','function rewardCalculator() view returns(address)'])
const calculatorAbi=parseAbi(['function calculateReward(address,uint256,uint256) view returns(uint256)'])
// V13 Community.sol storage layout: private mapping(address => uint16) poolRatios.
// Zero is a valid reward allocation; never replace it with the asset weight.
const POOL_RATIOS_SLOT=10n
export type PoolRewards={hourly:bigint;daily:bigint;annual:bigint;ratio:number;block:bigint}
export const annualizeRewards=(hourly:bigint,daily:bigint)=>hourly*8760n>daily*365n?hourly*8760n:daily*365n
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
 const [grossHourly,grossDaily]=await Promise.all([3600n,86400n].map(span=>client.readContract({address:calculator,abi:calculatorAbi,functionName:'calculateReward',args:[community,head,head+span],blockNumber:block.number})))
 const net=(gross:bigint)=>gross*BigInt(10000-fee)/10000n*ratio/10000n
 const hourly=net(grossHourly),daily=net(grossDaily)
 return {hourly,daily,annual:annualizeRewards(hourly,daily),ratio:Number(ratio),block:block.number}
}

/** Larger of the next-hour and next-24h annualized rewards / staked LP value in T. */
export function poolAprBps(annual:bigint,reserveToken:bigint,supply:bigint,staked:bigint,active:boolean):bigint|undefined{
 if(reserveToken<=0n||supply<=0n||staked<=0n)return undefined
 if(!active)return 0n
 return annual*supply*10000n/(2n*reserveToken*staked)
}
