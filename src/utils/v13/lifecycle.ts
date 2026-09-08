import { getReadOnlyClient, getWalletClient, setup } from '@/utils/wallets'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { getChainDeployment } from '@/config/chains'
import { type Address, type Abi, parseEther } from 'viem'
import pumpAbi from './Pump13.json'
import tokenAbi from './Token13.json'
export const CURVE_CAP = parseEther('650000000')
export async function readLifecycle(token: Address) {
  const client = getReadOnlyClient(56)
  const blockNumber = await client.getBlockNumber()
  const values = await client.multicall({blockNumber,allowFailure:false, contracts:['listed','listingPending','bondingCurveSupply','createdAt','getBuyFeeRatios','ipshareSubject','nutboxCommunity','indexToken'].map(functionName=>({address:token,abi:tokenAbi as Abi,functionName}))})
  return {token,blockNumber,listed:Boolean(values[0]),pending:Boolean(values[1]),supply:values[2] as bigint,createdAt:values[3] as bigint,fees:values[4] as [bigint,bigint],subject:values[5] as Address,community:values[6] as Address,indexToken:values[7] as Address}
}
export type CurveQuote = {token:Address;isBuy:boolean;amountIn:bigint;amountOut:bigint;quotedAt:number;state:Awaited<ReturnType<typeof readLifecycle>>}
export async function quoteCurve(token:Address,isBuy:boolean,amountIn:bigint):Promise<CurveQuote> {
  const state = await readLifecycle(token)
  if(state.listed) throw new Error('V13_ALREADY_LISTED')
  if(state.pending) throw new Error('V13_LISTING_PENDING')
  if(amountIn<=0n) throw new Error('V13_INVALID_AMOUNT')
  const client=getReadOnlyClient(56), pump=getChainDeployment(56).contracts.pump13!
  let amountOut:bigint
  if(isBuy) {
    const net=amountIn - amountIn*state.fees[0]/10000n - amountIn*state.fees[1]/10000n
    amountOut=await client.readContract({address:pump,abi:pumpAbi as Abi,functionName:'getBuyAmountByValue',args:[state.supply,net],blockNumber:state.blockNumber}) as bigint
    if(amountOut>CURVE_CAP-state.supply)amountOut=CURVE_CAP-state.supply
  } else {
    if(amountIn>state.supply)throw new Error('V13_INVALID_AMOUNT')
    amountOut=await client.readContract({address:pump,abi:pumpAbi as Abi,functionName:'getSellPriceAfterFee',args:[state.supply,amountIn],blockNumber:state.blockNumber}) as bigint
  }
  if(amountOut<=0n) throw new Error('V13_INVALID_AMOUNT')
  return {token,isBuy,amountIn,amountOut,state,quotedAt:Date.now()}
}
export async function executeCurve(q:CurveQuote,subject:Address,slippage:number) {
  const account=useAccountStore().ethConnectAddress as Address
  const check=()=> { if(useChainStore().activeChainId!==56 || useAccountStore().ethConnectAddress?.toLowerCase()!==account.toLowerCase() || Date.now()-q.quotedAt>30000)throw new Error('V13_QUOTE_EXPIRED') }
  check();if(useAccountStore().getWalletType!=='privy')await setup();check()
  const client=getReadOnlyClient(56),wallet=getWalletClient()
  if(!wallet)throw new Error('Wallet unavailable')
  // Token13 skips its slippage check when bps=0. Use at least 1 bps.
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > 5000) throw new Error('Invalid slippage')
  const bps=Math.max(1,slippage)
  const expected=slippage===0?(q.amountOut*10000n+9998n)/9999n:q.amountOut
  const params={address:q.token,abi:tokenAbi as Abi,functionName:q.isBuy?'buyToken':'sellToken',args:q.isBuy?[expected,subject,bps]:[q.amountIn,expected,subject,bps],account,value:q.isBuy?q.amountIn:0n}
  const {request}=await client.simulateContract(params)
  check()
  const hash=await wallet.writeContract(request as any)
  const receipt=await client.waitForTransactionReceipt({hash})
  if(receipt.status!=='success')throw new Error('V13_TRANSACTION_FAILED')
  return hash
}
