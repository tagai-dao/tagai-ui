import { getReadOnlyClient, getPreparedWalletClient } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { type Address, type Abi, parseEther } from 'viem'
import { getIndexDeployment } from '../v14/chain'
import { requiresBuyerHandle, buyerHandleCall, assertBuyerHandle } from '../v15/buyer'
export const CURVE_CAP = parseEther('650000000')
export async function readLifecycle(token: Address, chainId = useChainStore().activeChainId, version = 14) {
  const client = getReadOnlyClient(chainId)
  const blockNumber = await client.getBlockNumber()
  const values = await client.multicall({blockNumber,allowFailure:false, contracts:['listed','listingPending','bondingCurveSupply','createdAt','getBuyFeeRatios','ipshareSubject','nutboxCommunity','indexToken'].map(functionName=>({address:token,abi:getIndexDeployment(chainId, version).tokenAbi,functionName}))})
  return {token,chainId,blockNumber,listed:Boolean(values[0]),pending:Boolean(values[1]),supply:values[2] as bigint,createdAt:values[3] as bigint,fees:values[4] as [bigint,bigint],subject:values[5] as Address,community:values[6] as Address,indexToken:values[7] as Address}
}
export type CurveQuote = {version?:number;buyer?:Address;token:Address;isBuy:boolean;amountIn:bigint;amountOut:bigint;quotedAt:number;state:Awaited<ReturnType<typeof readLifecycle>>}
export async function quoteCurve(token:Address,isBuy:boolean,amountIn:bigint,version=13):Promise<CurveQuote> {
  const state = await readLifecycle(token, useChainStore().activeChainId, version)
  const buyer = useAccountStore().ethConnectAddress as Address | undefined
  if(state.listed) throw new Error('V13_ALREADY_LISTED')
  if(state.pending) throw new Error('V13_LISTING_PENDING')
  if(amountIn<=0n) throw new Error('V13_INVALID_AMOUNT')
  const client=getReadOnlyClient(state.chainId), deployment=getIndexDeployment(state.chainId,version), pump=deployment.pump
  let amountOut:bigint
  if(isBuy) {
    const net=amountIn - amountIn*state.fees[0]/10000n - amountIn*state.fees[1]/10000n
    const contracts: {address:Address;abi:Abi;functionName:string;args:readonly unknown[]}[] = [
      {address:pump,abi:deployment.pumpAbi,functionName:'getBuyAmountByValue',args:[state.supply,net]},
      ...(requiresBuyerHandle(state.chainId,version) && buyer ? [buyerHandleCall(buyer)] : []),
      ...(version === 17 && buyer ? ['innerMarketBought','INNER_MARKET_BUY_LIMIT'].map(functionName=>({address:token,abi:deployment.tokenAbi,functionName,args:functionName==='innerMarketBought'?[buyer]:[]})) : []),
    ]
    const values = await client.multicall({blockNumber:state.blockNumber,allowFailure:false,contracts})
    amountOut = values[0] as bigint
    if (requiresBuyerHandle(state.chainId,version) && buyer) assertBuyerHandle(values[1])
    if(amountOut>CURVE_CAP-state.supply)amountOut=CURVE_CAP-state.supply
    if(version === 17 && buyer && (values[2] as bigint) + amountOut > (values[3] as bigint)) throw new Error('V17_BUY_LIMIT_EXCEEDED')
  } else {
    if(amountIn>state.supply)throw new Error('V13_INVALID_AMOUNT')
    const [out] = await client.multicall({blockNumber:state.blockNumber,allowFailure:false,contracts:[{address:pump,abi:deployment.pumpAbi,functionName:'getSellPriceAfterFee',args:[state.supply,amountIn]}]})
    amountOut=out as bigint
  }
  if(amountOut<=0n) throw new Error('V13_INVALID_AMOUNT')
  return {token,version,buyer,isBuy,amountIn,amountOut,state,quotedAt:Date.now()}
}
export async function executeCurve(q:CurveQuote,subject:Address,slippage:number,dataSuffix?:`0x${string}`) {
  const account=useAccountStore().ethConnectAddress as Address
  const check=()=> { if(useChainStore().activeChainId!==q.state.chainId || useAccountStore().ethConnectAddress?.toLowerCase()!==account.toLowerCase() || Date.now()-q.quotedAt>30000)throw new Error('V13_QUOTE_EXPIRED') }
  check()
  if(q.isBuy && requiresBuyerHandle(q.state.chainId,q.version ?? 13) && q.buyer?.toLowerCase() !== account?.toLowerCase()) throw new Error('V13_QUOTE_EXPIRED')
  const client=getReadOnlyClient(q.state.chainId),wallet=await getPreparedWalletClient(q.state.chainId)
  check()
  if(!wallet)throw new Error('Wallet unavailable')
  // Token13 skips its slippage check when bps=0. Use at least 1 bps.
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > 5000) throw new Error('Invalid slippage')
  const bps=Math.max(1,slippage)
  const expected=slippage===0?(q.amountOut*10000n+9998n)/9999n:q.amountOut
  const params={dataSuffix,address:q.token,abi:getIndexDeployment(q.state.chainId,q.version ?? 14).tokenAbi,functionName:q.isBuy?'buyToken':'sellToken',args:q.isBuy?[expected,subject,bps]:[q.amountIn,expected,subject,bps],account,value:q.isBuy?q.amountIn:0n}
  const {request}=await client.simulateContract(params)
  check()
  const hash=await wallet.writeContract(request as any)
  const receipt=await client.waitForTransactionReceipt({hash})
  if(receipt.status!=='success')throw new Error('V13_TRANSACTION_FAILED')
  return hash
}
