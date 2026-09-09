import {parseAbi,zeroAddress,type Address,type PublicClient} from 'viem'
import tokenAbi from './Token13.json'
import type {Component} from './pools'

const communityAbi=parseAbi(['function createdPools(uint256) view returns(address)','function getCommunityToken() view returns(address)'])
const poolAbi=parseAbi(['function stakeToken() view returns(address)','function community() view returns(address)'])
export type MiningPools={community:Address;components:Component[]}

/** Recover only verifiable pool associations, not API-only index/buyback metadata. */
export async function readMiningPools(client:PublicClient,token:Address):Promise<MiningPools>{
 const blockNumber=await client.getBlockNumber()
 const [community,count]=await Promise.all([
  client.readContract({address:token,abi:tokenAbi,functionName:'nutboxCommunity',blockNumber}) as Promise<Address>,
  client.readContract({address:token,abi:tokenAbi,functionName:'componentCount',blockNumber}) as Promise<bigint>,
 ])
 if(community===zeroAddress||count<1n||count>4n)throw new Error('V13_POOL_MISMATCH')
 const communityToken=await client.readContract({address:community,abi:communityAbi,functionName:'getCommunityToken',blockNumber})
 if(communityToken.toLowerCase()!==token.toLowerCase())throw new Error('V13_POOL_MISMATCH')
 // Pump creates component pools in order; createdPools is append-only, unlike
 // activedPools whose indices change on closure. Verify every association below.
 const components=await Promise.all(Array.from({length:Number(count)},async(_,position)=>{
  const [component,pool]=await Promise.all([
   client.readContract({address:token,abi:tokenAbi,functionName:'componentAt',args:[BigInt(position)],blockNumber}) as Promise<readonly [Address,number,Address]>,
   client.readContract({address:community,abi:communityAbi,functionName:'createdPools',args:[BigInt(position)],blockNumber}),
  ])
  const [asset,weight,pair]=component
  if([asset,pair,pool].some(a=>a===zeroAddress))throw new Error('V13_POOL_MISMATCH')
  const [stakeToken,poolCommunity]=await Promise.all([
   client.readContract({address:pool,abi:poolAbi,functionName:'stakeToken',blockNumber}),
   client.readContract({address:pool,abi:poolAbi,functionName:'community',blockNumber}),
  ])
  if(stakeToken.toLowerCase()!==pair.toLowerCase()||poolCommunity.toLowerCase()!==community.toLowerCase())throw new Error('V13_POOL_MISMATCH')
  return {asset,pair,staking_pool:pool,position,target_weight:Number(weight),asset_decimals:null,pool_status:null}
 }))
 if(new Set(components.map(c=>c.staking_pool.toLowerCase())).size!==components.length)throw new Error('V13_POOL_MISMATCH')
 return {community,components}
}
