import {parseAbi,zeroAddress,type Address,type PublicClient} from 'viem'
import tokenAbi from './Token13.json'
import rhTokenAbi from '../v14/RHTokenV14.json'
import type {Abi} from 'viem'
import type {Component} from './pools'

const communityAbi=parseAbi(['function createdPools(uint256) view returns(address)','function getCommunityToken() view returns(address)'])
const poolAbi=parseAbi(['function stakeToken() view returns(address)','function community() view returns(address)'])
export type MiningPools={community:Address;components:Component[]}

/** Recover only verifiable pool associations, not API-only index/buyback metadata. */
export async function readMiningPools(client:PublicClient,token:Address):Promise<MiningPools>{
 const blockNumber=await client.getBlockNumber()
 const abi=(client.chain?.id===4663?rhTokenAbi:tokenAbi) as Abi
 const [community,count]=await client.multicall({blockNumber,allowFailure:false,contracts:[
  {address:token,abi,functionName:'nutboxCommunity'},
  {address:token,abi,functionName:'componentCount'},
 ]}) as [Address,bigint]
 if(community===zeroAddress||count<1n||count>4n)throw new Error('V13_POOL_MISMATCH')
 const communityToken=await client.readContract({address:community,abi:communityAbi,functionName:'getCommunityToken',blockNumber})
 if(communityToken.toLowerCase()!==token.toLowerCase())throw new Error('V13_POOL_MISMATCH')
 const associations=await client.multicall({blockNumber,allowFailure:false,contracts:Array.from({length:Number(count)},(_,position)=>[
  {address:token,abi,functionName:'componentAt',args:[BigInt(position)]},
  {address:community,abi:communityAbi,functionName:'createdPools',args:[BigInt(position)]},
 ]).flat()})
 const components=Array.from({length:Number(count)},(_,position)=>{
  const [asset,weight,pair]=associations[position*2] as [Address,number,Address],pool=associations[position*2+1] as Address
  if([asset,pair,pool].some(a=>a===zeroAddress))throw new Error('V13_POOL_MISMATCH')
  return {asset,pair,staking_pool:pool,position,target_weight:Number(weight),asset_decimals:null,pool_status:null}
 })
 const bindings=await client.multicall({blockNumber,allowFailure:false,contracts:components.flatMap(c=>[
  {address:c.staking_pool,abi:poolAbi,functionName:'stakeToken'},
  {address:c.staking_pool,abi:poolAbi,functionName:'community'},
 ])})
 components.forEach((c,i)=>{
  if(String(bindings[i*2]).toLowerCase()!==c.pair.toLowerCase()||String(bindings[i*2+1]).toLowerCase()!==community.toLowerCase())throw new Error('V13_POOL_MISMATCH')
 })
 if(new Set(components.map(c=>c.staking_pool.toLowerCase())).size!==components.length)throw new Error('V13_POOL_MISMATCH')
 return {community,components}
}
