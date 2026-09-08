import {get} from '@/apis/axios'
import {API_BASE_URL} from '@/config/api'
import {getReadOnlyClient} from '@/utils/wallets'
import {type Abi,type Address} from 'viem'
import {loadSnapshot} from './snapshot'
import {type Quote} from './client'
import {type Metadata} from './types'
import {type ZapPlan} from './math'
import {send,walletGuard,validateLiquidityRouter} from './pools'
import abi from './LiquidityRouter.json'
export type ZapQuote={quote:Quote;zap:ZapPlan;amount:bigint;component:number}
export async function quoteZap(token:Address,component:number,amount:bigint,signal?:AbortSignal):Promise<ZapQuote>{
 const check=()=>{if(signal?.aborted)throw new Error('V13_QUOTE_CANCELLED')}
 check()
 const result:any=await get(`${API_BASE_URL}/pump/v13/metadata/${token}`,{},{headers:{'X-Chain-Id':'56'},signal})
 check()
 if(result?.c!==0)throw new Error('V13_METADATA_UNAVAILABLE')
 const m=result.d as Metadata,client=getReadOnlyClient(56)
 const gas=await client.getGasPrice()
 check()
 const s=await loadSnapshot(client,m,gas)
 check()
 const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'})
 let timeout:ReturnType<typeof setTimeout>|undefined
 let abort: (()=>void)|undefined
 try{
  const zap=await new Promise<ZapPlan>((resolve,reject)=>{
   abort=()=>{worker.terminate();reject(new Error('V13_QUOTE_CANCELLED'))}
   signal?.addEventListener('abort',abort,{once:true})
   if(signal?.aborted){abort();return}
   timeout=setTimeout(()=>reject(new Error('V13_QUOTE_TIMEOUT')),20000)
   worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data.plan)
   worker.onerror=()=>reject(new Error('V13_QUOTE_FAILED'))
   worker.postMessage({id:1,metadata:m,snapshot:s,amount,component,isBuy:true})
  })
  return {quote:{metadata:m,snapshot:s,plan:zap.plan},zap,amount,component}
 }finally{clearTimeout(timeout);if(abort)signal?.removeEventListener('abort',abort);worker.terminate()}
}
export async function executeZap(q:ZapQuote,router:Address,subject:Address,bps:number){
 const guard=walletGuard();await validateLiquidityRouter(router)
 if(!q.quote.snapshot.executable||!q.quote.metadata.executor)throw new Error('V13_EXECUTOR_UNAVAILABLE')
 if(!Number.isInteger(bps)||bps<1||bps>1000)throw new Error('Invalid slippage')
 const bound=await getReadOnlyClient(56).readContract({address:router,abi:abi as Abi,functionName:'tradeRouter'})
 if(String(bound).toLowerCase()!==q.quote.metadata.executor.toLowerCase())throw new Error('V13_EXECUTOR_MISMATCH')
 if(Date.now()-q.quote.snapshot.fetchedAt>45000)throw new Error('V13_QUOTE_EXPIRED')
 const min=(n:bigint)=>{const x=n*BigInt(10000-bps)/10000n;return x>0n?x:1n}
 const rate=(n:bigint)=>min(n)
 const z={token:q.quote.metadata.token,component:BigInt(q.component),tokenBnb:q.zap.tokenBnb,minToken:min(q.zap.plan.amountOut),minAsset:min(q.zap.assetOut),minLP:min(q.zap.lp),deadline:BigInt(q.quote.snapshot.timestamp+120),subject,mainRouteHash:q.quote.snapshot.hashes['0:true'],assetRouteHash:q.quote.snapshot.hashes[`${q.component+1}:true`],minTokenRefundRateX128:rate(q.zap.tokenRefundRateX128),minAssetRefundRateX128:rate(q.zap.assetRefundRateX128)}
 return send(router,abi as Abi,'addWithBNB',[z],q.amount,guard)
}
