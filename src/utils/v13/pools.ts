import liquidityAbi from './LiquidityRouter.json'
import { getChainDeployment } from '@/config/chains'
import { get } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { getReadOnlyClient, getWalletClient, setup } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { type Address,type Abi,parseAbi,zeroAddress } from 'viem'
import staking from './ERC20Staking.json'
import tokenAbi from './Token13.json'
export type Component = {asset:Address;pair:Address;staking_pool:Address;position:number;target_weight:number;asset_decimals:number|null;asset_symbol?:string|null;pool_status:string|null}
export type V13Detail = {buyback:{bnb_reserve:string;total_bnb_spent:string;total_index_bought:string;total_index_claimed:string}|null;config:{name:string;symbol:string;community:Address;index_token:Address|null;basket_fee_bps:number;creator_share_bps:number;retain_community_ownership:number;source_block:string};components:Component[]}
export const erc20=parseAbi(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)'])
export const pairAbi=parseAbi(['function token0() view returns(address)','function token1() view returns(address)','function getReserves() view returns(uint112,uint112,uint32)','function totalSupply() view returns(uint256)'])
export const communityAbi=parseAbi(['function getPoolPendingRewards(address,address) view returns(uint256)','function withdrawPoolsRewards(address[]) payable','function getCommittee() view returns(address)','function poolActived(address) view returns(bool)','function poolRatios(address) view returns(uint256)'])
export const committeeAbi=parseAbi(['function getPoolOperationFee() view returns(uint256)'])
export async function getV13Detail(token:Address):Promise<V13Detail> {
 const r:any=await get(`${API_BASE_URL}/pump/v13/detail/${token}`,{},{headers:{'X-Chain-Id':'56'}})
 if(r?.c!==0||!r.d)throw new Error('V13_DETAIL_UNAVAILABLE');return r.d
}
export async function readPool(token:Address,community:Address,c:Component,account:Address) {
 const client=getReadOnlyClient(56)
 const read=(address:Address,abi:Abi,functionName:string,args:unknown[]=[])=>client.readContract({address,abi,functionName,args})
 const [component,stakeToken,poolCommunity]=await Promise.all([read(token,tokenAbi as Abi,'componentAt',[BigInt(c.position)]),read(c.staking_pool,staking as Abi,'stakeToken'),read(c.staking_pool,staking as Abi,'community')])
 const tuple=component as [Address,bigint,Address]
 if(tuple[0].toLowerCase()!==c.asset.toLowerCase()||tuple[2].toLowerCase()!==c.pair.toLowerCase()||String(stakeToken).toLowerCase()!==c.pair.toLowerCase()||String(poolCommunity).toLowerCase()!==community.toLowerCase())throw new Error('V13_POOL_MISMATCH')
 const [staked,total,pending,lpBalance,tokenBalance,assetBalance,symbol,decimals,reserves,token0,supply,active,committee,rewardRatio]=await Promise.all([
 read(c.staking_pool,staking as Abi,'getUserStakedAmount',[account]),read(c.staking_pool,staking as Abi,'getTotalStakedAmount'),read(community,communityAbi,'getPoolPendingRewards',[c.staking_pool,account]),
 read(c.pair,erc20,'balanceOf',[account]),read(token,erc20,'balanceOf',[account]),read(c.asset,erc20,'balanceOf',[account]),read(c.asset,erc20,'symbol'),read(c.asset,erc20,'decimals'),
 read(c.pair,pairAbi,'getReserves'),read(c.pair,pairAbi,'token0'),read(c.pair,pairAbi,'totalSupply'),read(community,communityAbi,'poolActived',[c.staking_pool]),read(community,communityAbi,'getCommittee'),read(community,communityAbi,'poolRatios',[c.staking_pool])])
 const fee=await read(committee as Address,committeeAbi,'getPoolOperationFee') as bigint
 const r=reserves as [bigint,bigint,number], t0=String(token0).toLowerCase()===token.toLowerCase()
 return {staked:staked as bigint,total:total as bigint,pending:pending as bigint,lpBalance:lpBalance as bigint,tokenBalance:tokenBalance as bigint,assetBalance:assetBalance as bigint,symbol:String(symbol),decimals:Number(decimals),reserveToken:t0?r[0]:r[1],reserveAsset:t0?r[1]:r[0],supply:supply as bigint,active:Boolean(active),rewardRatio:Number(rewardRatio),fee}
}
export function walletGuard(){
 const account=useAccountStore().ethConnectAddress as Address
 if(useChainStore().activeChainId!==56||!account||account===zeroAddress)throw new Error('Connect a BSC wallet')
 return {account,check:()=>{if(useChainStore().activeChainId!==56||useAccountStore().ethConnectAddress?.toLowerCase()!==account.toLowerCase())throw new Error('Wallet or chain changed')}}
}
export async function send(address:Address,abi:Abi,functionName:string,args:unknown[],value=0n,guard=walletGuard()) {
 guard.check();if(useAccountStore().getWalletType!=='privy')await setup();guard.check()
 const client=getReadOnlyClient(56),wallet=getWalletClient();if(!wallet)throw new Error('Wallet unavailable')
 const {request}=await client.simulateContract({address,abi,functionName,args,value,account:guard.account})
 guard.check();const hash=await wallet.writeContract(request as any)
 const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error('Transaction reverted');return hash
}
export async function approve(asset:Address,spender:Address,amount:bigint,guard=walletGuard()) {
 const allowance=await getReadOnlyClient(56).readContract({address:asset,abi:erc20,functionName:'allowance',args:[guard.account,spender]})
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
export const afterPairTax=(amount:bigint)=>amount-amount/1000n
export async function validateLiquidityRouter(address:Address) {
 const contracts=getChainDeployment(56).contracts
 if(address.toLowerCase()!==contracts.liquidityRouter13?.toLowerCase())throw new Error('V13 liquidity deployment mismatch')
 const client=getReadOnlyClient(56)
 const [pump,trade]=await Promise.all([client.readContract({address,abi:liquidityAbi as Abi,functionName:'pump'}),client.readContract({address,abi:liquidityAbi as Abi,functionName:'tradeRouter'})])
 if(String(pump).toLowerCase()!==contracts.pump13?.toLowerCase()||String(trade).toLowerCase()!==contracts.tradeRouter13?.toLowerCase())throw new Error('V13 liquidity deployment mismatch')
}
export async function liquidity(token:Address,community:Address,c:Component,action:'add'|'remove',amount:bigint,bps:number,router:Address) {
 const guard=walletGuard();await validateLiquidityRouter(router)
 const s=await readPool(token,community,c,guard.account)
 if(amount<=0n||!s.reserveToken||!s.reserveAsset||!s.supply)throw new Error('Pool has no liquidity')
 if(!Number.isInteger(bps)||bps<1||bps>1000)throw new Error('Slippage must be 0.01–10%')
 const min=(v:bigint)=>{const m=v*BigInt(10000-bps)/10000n;return m>0n?m:1n}
 if(action==='remove'){
  if(amount>s.lpBalance)throw new Error('Insufficient LP balance')
  await approve(c.pair,router,amount,guard)
  return send(router,liquidityAbi as Abi,'remove',[token,BigInt(c.position),amount,min(afterPairTax(amount*s.reserveToken/s.supply)),min(amount*s.reserveAsset/s.supply),BigInt(Math.floor(Date.now()/1000)+120)],0n,guard)
 }
 const net=afterPairTax(amount),assetAmount=(net*s.reserveAsset+s.reserveToken-1n)/s.reserveToken
 if(amount>s.tokenBalance||assetAmount>s.assetBalance)throw new Error('Insufficient token balance')
 await approve(token,router,amount,guard);await approve(c.asset,router,assetAmount,guard)
 return send(router,liquidityAbi as Abi,'add',[token,BigInt(c.position),amount,assetAmount,min(net*s.supply/s.reserveToken),BigInt(Math.floor(Date.now()/1000)+120)],0n,guard)
}
