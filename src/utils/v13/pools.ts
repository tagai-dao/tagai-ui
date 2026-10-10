import { getIndexDeployment } from '../v14/chain'
import liquidityAbi from './LiquidityRouter.json'
import { getChainDeployment } from '@/config/chains'
import { get } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { getReadOnlyClient, getPreparedWalletClient } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { type Address,type Abi,parseAbi,zeroAddress } from 'viem'
import staking from './ERC20Staking.json'
import tokenAbi from './Token13.json'
import {afterPairTax,previewLiquidityAdd} from './liquidity-preview'
export {afterPairTax,previewLiquidityAdd} from './liquidity-preview'
export type Component = {asset:Address;pair:Address;staking_pool:Address;position:number;target_weight:number;asset_decimals:number|null;asset_symbol?:string|null;staking_reward_ratio?:number|null;pool_status:string|null}
export type V13Detail = {chainId?:number;nativeSymbol?:string;buyback:{bnb_reserve?:string;total_bnb_spent?:string;native_reserve?:string;total_native_spent?:string;total_index_bought:string;total_index_claimed:string}|null;config:{name:string;symbol:string;community:Address;index_token:Address|null;basket_fee_bps:number;creator_share_bps:number;retain_community_ownership:number;source_block:string};components:Component[]}
export const erc20=parseAbi(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)'])
export const pairAbi=parseAbi(['function token0() view returns(address)','function token1() view returns(address)','function getReserves() view returns(uint112,uint112,uint32)','function totalSupply() view returns(uint256)'])
export const communityAbi=parseAbi(['function getPoolPendingRewards(address,address) view returns(uint256)','function withdrawPoolsRewards(address[]) payable','function getCommittee() view returns(address)','function poolActived(address) view returns(bool)'])
export const committeeAbi=parseAbi(['function getPoolOperationFee() view returns(uint256)'])
export async function getV13Detail(token:Address):Promise<V13Detail> {
 const chainId=useChainStore().activeChainId
 const r:any=await get(`${API_BASE_URL}/pump/v13/detail/${token}`,{},{headers:{'X-Chain-Id':String(chainId)}})
 if(r?.c!==0||!r.d||(chainId===4663&&r.d.chainId!==4663)||useChainStore().activeChainId!==chainId)throw new Error('V13_DETAIL_UNAVAILABLE');return r.d
}
export async function readPool(token:Address,community:Address,c:Component,account:Address) {
 const chainId=useChainStore().activeChainId,client=getReadOnlyClient(chainId)
 const blockNumber=await client.getBlockNumber()
 const call=(address:Address,abi:Abi,functionName:string,args:unknown[]=[])=>({address,abi,functionName,args})
 const rows=await client.multicall({blockNumber,allowFailure:false,contracts:[
  call(token,getIndexDeployment(chainId).tokenAbi,'componentAt',[BigInt(c.position)]),call(c.staking_pool,staking as Abi,'stakeToken'),call(c.staking_pool,staking as Abi,'community'),
  call(c.staking_pool,staking as Abi,'getUserStakedAmount',[account]),call(c.staking_pool,staking as Abi,'getTotalStakedAmount'),call(community,communityAbi,'getPoolPendingRewards',[c.staking_pool,account]),
  call(c.pair,erc20,'balanceOf',[account]),call(token,erc20,'balanceOf',[account]),call(c.asset,erc20,'balanceOf',[account]),call(c.asset,erc20,'symbol'),call(c.asset,erc20,'decimals'),
  call(c.pair,pairAbi,'getReserves'),call(c.pair,pairAbi,'token0'),call(c.pair,pairAbi,'totalSupply'),call(community,communityAbi,'poolActived',[c.staking_pool]),call(community,communityAbi,'getCommittee'),
 ]})
 const [component,stakeToken,poolCommunity,staked,total,pending,lpBalance,tokenBalance,assetBalance,symbol,decimals,reserves,token0,supply,active,committee]=rows
 const tuple=component as [Address,bigint,Address]
 if(tuple[0].toLowerCase()!==c.asset.toLowerCase()||tuple[2].toLowerCase()!==c.pair.toLowerCase()||String(stakeToken).toLowerCase()!==c.pair.toLowerCase()||String(poolCommunity).toLowerCase()!==community.toLowerCase())throw new Error('V13_POOL_MISMATCH')
 const fee=await client.readContract({address:committee as Address,abi:committeeAbi,functionName:'getPoolOperationFee',blockNumber})
 const nativeBalance=account===zeroAddress?0n:await client.getBalance({address:account,blockNumber})
 const r=reserves as [bigint,bigint,number], t0=String(token0).toLowerCase()===token.toLowerCase()
 return {staked:staked as bigint,total:total as bigint,pending:pending as bigint,lpBalance:lpBalance as bigint,tokenBalance:tokenBalance as bigint,assetBalance:assetBalance as bigint,nativeBalance,symbol:String(symbol),decimals:Number(decimals),reserveToken:t0?r[0]:r[1],reserveAsset:t0?r[1]:r[0],supply:supply as bigint,active:Boolean(active),rewardRatio:c.staking_reward_ratio == null ? null : Number(c.staking_reward_ratio),fee}
}
export function walletGuard(){
 const account=useAccountStore().ethConnectAddress as Address
 const chainId=useChainStore().activeChainId
 if(![56,4663].includes(chainId)||!account||account===zeroAddress)throw new Error('Connect a wallet')
 return {account,chainId,check:()=>{if(useChainStore().activeChainId!==chainId||useAccountStore().ethConnectAddress?.toLowerCase()!==account.toLowerCase())throw new Error('Wallet or chain changed')}}
}
export async function send(address:Address,abi:Abi,functionName:string,args:unknown[],value=0n,guard=walletGuard()) {
 guard.check()
 const client=getReadOnlyClient(guard.chainId),wallet=await getPreparedWalletClient(guard.chainId);if(!wallet)throw new Error('Wallet unavailable')
 guard.check()
 const tx={address,abi,functionName,args,value,account:guard.account}
 const {request}=await client.simulateContract(tx)
 guard.check()
 const estimatedGas=await client.estimateContractGas(tx)
 if(estimatedGas<=0n)throw new Error('Invalid gas estimate')
 // LP execution can take different branches as pool state changes before inclusion.
 // Round up a 30% buffer; estimation failures must never fall back to a fixed limit.
 const gas=(estimatedGas*130n+99n)/100n
 guard.check();const hash=await wallet.writeContract({...request,account:guard.account,chain:client.chain,gas} as any)
 const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error('Transaction reverted');return hash
}
export async function approve(asset:Address,spender:Address,amount:bigint,guard=walletGuard()) {
 const allowance=await getReadOnlyClient(useChainStore().activeChainId).readContract({address:asset,abi:erc20,functionName:'allowance',args:[guard.account,spender]})
 if(allowance>=amount)return
 if(allowance>0n)await send(asset,erc20,'approve',[spender,0n],0n,guard)
 await send(asset,erc20,'approve',[spender,amount],0n,guard)
}
export async function operatePool(token:Address,community:Address,c:Component,action:'deposit'|'withdraw'|'claim',amount:bigint) {
 const guard=walletGuard(),state=await readPool(token,community,c,guard.account)
 if(action==='claim')return send(community,communityAbi,'withdrawPoolsRewards',[[c.staking_pool]],state.fee,guard)
 if(amount<=0n||amount>(action==='deposit'?state.lpBalance:state.staked))throw new Error('Invalid LP amount')
 if(action==='deposit'){if(!state.active)throw new Error('Pool closed');await approve(c.pair,c.staking_pool,amount,guard)}
 return send(c.staking_pool,staking as Abi,action,[amount],state.fee,guard)
}
export async function claimAllPoolRewards(token:Address,community:Address,components:Component[]) {
 const guard=walletGuard(),client=getReadOnlyClient(useChainStore().activeChainId)
 const pools=[...new Map(components.map(c=>[c.staking_pool.toLowerCase(),c])).values()]
 if(!pools.length)return null
 const blockNumber=await client.getBlockNumber()
 const rows=await client.multicall({blockNumber,allowFailure:false,contracts:pools.flatMap(c=>[
  {address:token,abi:getIndexDeployment(guard.chainId).tokenAbi,functionName:'componentAt',args:[BigInt(c.position)]},
  {address:c.staking_pool,abi:staking as Abi,functionName:'stakeToken'},
  {address:c.staking_pool,abi:staking as Abi,functionName:'community'},
  {address:community,abi:communityAbi,functionName:'getPoolPendingRewards',args:[c.staking_pool,guard.account]},
 ])})
 const eligible=pools.filter((c,i)=>{
  const [asset,,pair]=rows[i*4] as [Address,bigint,Address]
  if(asset.toLowerCase()!==c.asset.toLowerCase()||pair.toLowerCase()!==c.pair.toLowerCase()||String(rows[i*4+1]).toLowerCase()!==c.pair.toLowerCase()||String(rows[i*4+2]).toLowerCase()!==community.toLowerCase())throw new Error('V13_POOL_MISMATCH')
  return (rows[i*4+3] as bigint)>0n
 }).map(c=>c.staking_pool)
 guard.check()
 if(!eligible.length)return null
 const committee=await client.readContract({address:community,abi:communityAbi,functionName:'getCommittee',blockNumber})
 const fee=await client.readContract({address:committee,abi:committeeAbi,functionName:'getPoolOperationFee',blockNumber})
 return send(community,communityAbi,'withdrawPoolsRewards',[eligible],fee,guard)
}
export async function validateLiquidityRouter(address:Address) {
 const chainId=useChainStore().activeChainId
 const profile=getIndexDeployment(chainId,chainId===4663?14:13)
 const contracts=getChainDeployment(chainId).contracts
 if(address.toLowerCase()!==profile.liquidityRouter?.toLowerCase())throw new Error('V13 liquidity deployment mismatch')
 const client=getReadOnlyClient(useChainStore().activeChainId)
 const blockNumber=await client.getBlockNumber()
 const [pump,trade]=await client.multicall({blockNumber,allowFailure:false,contracts:['pump','tradeRouter'].map(functionName=>({address,abi:liquidityAbi as Abi,functionName}))})
 if(String(pump).toLowerCase()!==profile.pump?.toLowerCase()||String(trade).toLowerCase()!==profile.liquidityExecutor?.toLowerCase())throw new Error('V13 liquidity deployment mismatch')
}
export async function liquidity(token:Address,community:Address,c:Component,action:'add'|'remove',amount:bigint,bps:number,router:Address,assetLimit?:bigint) {
 const guard=walletGuard();await validateLiquidityRouter(router)
 const s=await readPool(token,community,c,guard.account)
 if(amount<=0n||!s.reserveToken||!s.reserveAsset||!s.supply)throw new Error('Pool has no liquidity')
 if(!Number.isInteger(bps)||bps<1||bps>1000)throw new Error('Slippage must be 0.01–10%')
 const min=(v:bigint)=>{const m=v*BigInt(10000-bps)/10000n;return m>0n?m:1n}
 if(action==='remove'){
  if(amount>s.lpBalance)throw new Error('Insufficient LP balance')
  await approve(c.pair,router,amount,guard)
  const deadline=(await getReadOnlyClient(useChainStore().activeChainId).getBlock({blockTag:'latest'})).timestamp+120n
  return send(router,liquidityAbi as Abi,'remove',[token,BigInt(c.position),amount,min(afterPairTax(amount*s.reserveToken/s.supply)),min(amount*s.reserveAsset/s.supply),deadline],0n,guard)
 }
 const preview=previewLiquidityAdd(amount,s)
 if(!preview||preview.lp<=0n)throw new Error('Amount is too small to mint LP')
 const {assetAmount}=preview
 if(assetLimit!==undefined&&assetAmount>assetLimit)throw new Error('V13_LIQUIDITY_RATIO_CHANGED')
 if(amount>s.tokenBalance||assetAmount>s.assetBalance)throw new Error('Insufficient token balance')
 await approve(token,router,amount,guard);await approve(c.asset,router,assetAmount,guard)
 // Read chain time after approvals: wallet confirmations may take time, and a fork can be ahead of the browser clock.
 const deadline=(await getReadOnlyClient(useChainStore().activeChainId).getBlock({blockTag:'latest'})).timestamp+120n
 return send(router,liquidityAbi as Abi,'add',[token,BigInt(c.position),amount,assetAmount,min(preview.lp),deadline],0n,guard)
}
