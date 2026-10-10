import { parseAbi, isAddress, type Address, type Hex } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { getChainDeployment } from '@/config/chains'
import { useChainStore } from '@/stores/chain'
import { useAccountStore } from '@/stores/web3'
import { writeContract } from '@/utils/contract'
const poolAbi=parseAbi(['function factory() view returns(address)','function community() view returns(address)',
  'function claim(uint256,uint256,uint256,bytes) payable'])
const communityAbi=parseAbi(['function getCommunityToken() view returns(address)','function getCommittee() view returns(address)'])
const committeeAbi=parseAbi(['function getPoolOperationFee() view returns(uint256)'])
export async function claimTradeReward(order:{pool:Address;token:Address;recipient:Address;orderId:string;amountRaw:string;deadline:number;signature:Hex;chainId?:number},chainId:number) {
  const chain=useChainStore(), account=useAccountStore(), deployment=getChainDeployment(chainId)
  const guard=()=>{
    if(chain.activeChainId!==chainId || account.ethConnectAddress?.toLowerCase()!==order.recipient.toLowerCase()
      || (order.chainId!=null&&order.chainId!==chainId)) throw new Error('TRADE_CURATION_WALLET_CHANGED')
  }
  guard()
  if(![order.pool,order.token,order.recipient].every(a=>isAddress(a)) || BigInt(order.amountRaw)<=0n || !Number.isSafeInteger(order.deadline)) throw new Error('INVALID_TRADE_CLAIM')
  const client=getReadOnlyClient(chainId), blockNumber=await client.getBlockNumber()
  const read=(contracts:any[])=>client.multicall({contracts,multicallAddress:deployment.multiConfig.multicallAddress,blockNumber,batchSize:0,allowFailure:false} as any) as Promise<any[]>
  const [factory,community]=await read([{address:order.pool,abi:poolAbi,functionName:'factory'},{address:order.pool,abi:poolAbi,functionName:'community'}])
  if(factory.toLowerCase()!==deployment.contracts.tradeCurationFactory?.toLowerCase()) throw new Error('POOL_CONFIGURATION_MISMATCH')
  const [token,committee]=await read([{address:community,abi:communityAbi,functionName:'getCommunityToken'},{address:community,abi:communityAbi,functionName:'getCommittee'}])
  if(token.toLowerCase()!==order.token.toLowerCase()) throw new Error('POOL_CONFIGURATION_MISMATCH')
  const [value]=await read([{address:committee,abi:committeeAbi,functionName:'getPoolOperationFee'}])
  guard()
  return writeContract({contractName:'NutboxSocialCurationPool',abi:poolAbi,functionName:'claim',address:order.pool,
    args:[BigInt(order.orderId),BigInt(order.amountRaw),BigInt(order.deadline),order.signature],value,beforeWrite:guard})
}
