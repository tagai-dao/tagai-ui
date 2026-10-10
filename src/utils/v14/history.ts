import { get } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { formatUnits } from 'viem'
import type { TokenTrade } from '@/types'

/** The RH index covers curve and main-pool trades; quantities remain exact strings. */
export async function readRhIndexTrades(token:string,tick:string,page=0):Promise<TokenTrade[]> {
  const result:any=await get(`${API_BASE_URL}/pump/v14/trades/${token}`,{page,size:30},{headers:{'X-Chain-Id':'4663'},timeout:10000,'axios-retry':{retries:0}})
  if(result?.c!==0||result.d?.chainId!==4663||result.d.token?.toLowerCase()!==token.toLowerCase()||!Array.isArray(result.d.trades))throw new Error('V14_HISTORY_UNAVAILABLE')
  return result.d.trades.map((row:any)=>({tick,trader:row.buyer,timestamp:Number(row.block_timestamp),isBuy:Number(row.is_buy)===1,
    amount:formatUnits(BigInt(row.token_amount),18),ethAmount:formatUnits(BigInt(row.eth_amount),18),quoteSymbol:'ETH',
    amountRaw:String(row.token_amount),nativeAmountRaw:String(row.eth_amount),transactionHash:row.transaction_hash,
  }))
}
