import { get, post } from '@/apis/axios'
import { BACKEND_API_URL } from '@/config'
import { useChainStore } from '@/stores/chain'
export type TradeCardReward = {
  token: string; tweetId: string; pool: string; endTime: number
  amount: string; amountRaw: string; authorAmount: string; buyerAmount: string
  state: 'processing' | 'settled'
}
type Source = { token: string; tweetId: string; chainId?: number }
type Pending = { source: Source; resolve: (value: TradeCardReward | null) => void; reject: (error: unknown) => void }
const cache = new Map<string, { time: number; value: TradeCardReward | null }>()
const pending = new Map<string, Promise<TradeCardReward | null>>()
const queue: Pending[] = []
let timer: ReturnType<typeof setTimeout> | undefined
const key = (s: Source) => `${s.chainId??useChainStore().activeChainId}:${s.token.toLowerCase()}:${s.tweetId}`
async function flush() {
  timer = undefined
  const chainId=queue[0]?.source.chainId
  const batch:Pending[]=[]
  for(let i=0;i<queue.length && batch.length<50;) {
    if(queue[i].source.chainId===chainId) batch.push(...queue.splice(i,1)); else i++
  }
  if (queue.length) timer = setTimeout(flush, 40)
  try {
    const r: any = await post(BACKEND_API_URL + '/trade-curation/cards', { cards: batch.map(p => p.source) },
      { headers: { 'X-Chain-Id': String(chainId) }, timeout: 10000, 'axios-retry': { retries: 0 }, publicDisplay: true })
    if (r.c !== 0 || !Array.isArray(r.d)) throw new Error(r.error || 'TRADE_CURATION_UNAVAILABLE')
    if(chainId===4663 && r.d.some((v:any)=>v.chainId!==chainId)) throw new Error('TRADE_CURATION_CHAIN_MISMATCH')
    for (const p of batch) {
      const value = r.d.find((v: TradeCardReward) => key({...v,chainId}) === key(p.source)) ?? null
      cache.set(key(p.source), { time: Date.now(), value }); p.resolve(value)
    }
    while (cache.size > 500) cache.delete(cache.keys().next().value!)
  } catch (e: any) {
    for (const p of batch) {
      if ((e?.data?.error ?? e?.message) === 'TRADE_CURATION_DISABLED') p.resolve(null)
      else p.reject(e)
    }
  } finally { for (const p of batch) pending.delete(key(p.source)) }
}
/** Coalesce card mounts/refreshes; reuse duplicate cards without N HTTP requests. */
export function getTradeCardReward(source: Source): Promise<TradeCardReward | null> {
  source={...source,chainId:source.chainId??useChainStore().activeChainId}
  const k = key(source), hit = cache.get(k)
  if (hit && Date.now() - hit.time < 25000) return Promise.resolve(hit.value)
  const running = pending.get(k)
  if (running) return running
  const promise = new Promise<TradeCardReward | null>((resolve, reject) => queue.push({ source, resolve, reject }))
  pending.set(k, promise)
  if (!timer) timer = setTimeout(flush, 40)
  return promise
}

export type TradeCurationRecord = {
  twitterId: string; twitterName?: string; twitterUsername?: string; profile?: string; wallet: string
  tokenAmount: string; tokenAmountRaw: string; rewardAmount: string; rewardAmountRaw: string
  buyCount: number; lastBuyTime: number
}
export type TradeCurationRecordPage = { summary: TradeCardReward; records: TradeCurationRecord[]; nextCursor: string | null }
export async function getTradeCurationRecords(source: Source, cursor?: string): Promise<TradeCurationRecordPage> {
  const chainId=source.chainId??useChainStore().activeChainId
  const r: any = await get(BACKEND_API_URL + '/trade-curation/records', { ...source, cursor, size: 30 },
    { headers: { 'X-Chain-Id': String(chainId) }, timeout: 10000, 'axios-retry': { retries: 0 }, publicDisplay: true })
  if (r.c !== 0 || !r.d?.summary || !Array.isArray(r.d.records)) throw new Error(r.error || 'TRADE_CURATION_UNAVAILABLE')
  if(chainId===4663 && r.d.summary.chainId!==chainId) throw new Error('TRADE_CURATION_CHAIN_MISMATCH')
  return r.d
}
