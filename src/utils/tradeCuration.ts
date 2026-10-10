import { get, post } from '@/apis/axios'
import { BACKEND_API_URL } from '@/config'
import { useChainStore } from '@/stores/chain'
import type { Address, Hex } from 'viem'
const headers = (chainId: number) => ({'X-Chain-Id':String(chainId)})
const currentChain = () => useChainStore().activeChainId
export type TradeAttribution = { token: string; wallet: string; tweetId: string; dataSuffix: Hex }
/** Source is captured before the buy and authenticated by the transaction's own signature. */
export async function prepareTradeAttribution(input: { token: string; wallet: string; tweetId?: string; commerceId?: string }): Promise<TradeAttribution | null> {
  const chainId=currentChain()
  if (![56,4663].includes(chainId) || (!input.tweetId && !input.commerceId)) return null
  try {
    const r: any = await post(BACKEND_API_URL + '/trade-curation/intent', input, { headers:headers(chainId) })
    if(currentChain()!==chainId) throw new Error('TRADE_CURATION_CHAIN_CHANGED')
    if (r.c !== 0) throw new Error(r.error || 'TRADE_CURATION_UNAVAILABLE')
    if(chainId===4663 && r.d?.chainId!==chainId) throw new Error('TRADE_CURATION_CHAIN_MISMATCH')
    if (!r.d || r.d.token?.toLowerCase() !== input.token.toLowerCase() || r.d.wallet?.toLowerCase() !== input.wallet.toLowerCase()
      || (input.tweetId && r.d.tweetId !== input.tweetId)
      || !/^0x7461676169746331[0-9a-f]{64}$/.test(r.d.dataSuffix)) throw new Error('INVALID_TRADE_ATTRIBUTION')
    return r.d
  } catch (e: any) {
    const code = e?.data?.error ?? e?.message
    if (['TRADE_CURATION_DISABLED', 'NO_TRADE_CURATION_POOL', 'CURATION_WINDOW_CLOSED', 'SOURCE_NOT_READY'].includes(code)) return null
    // Once the feature is available, do not silently send a buy without its intended reward attribution.
    throw e
  }
}
export type TradeReward = { pool: Address; token: Address; tick: string; logo: string; amountRaw: string; amount: string; state: 'claimable' | 'processing' }
export const getTradeRewards = async (twitterId: string, chainId = currentChain()): Promise<TradeReward[]> => {
  const r: any = await get(BACKEND_API_URL + '/trade-curation/rewards', { twitterId }, { headers:headers(chainId) })
  if (r.c !== 0) throw new Error(r.error)
  if(!Array.isArray(r.d) || (chainId===4663&&r.d.some((v:any)=>v.chainId!==chainId))) throw new Error('TRADE_CURATION_CHAIN_MISMATCH')
  if(currentChain()!==chainId) throw new Error('TRADE_CURATION_CHAIN_CHANGED')
  return r.d
}
export async function getTradeClaim(twitterId: string, pool: string, chainId = currentChain()): Promise<{ chainId: number; orderId: string; pool: Address; token: Address; recipient: Address; amountRaw: string; deadline: number; signature: Hex }> {
  const r: any = await post(BACKEND_API_URL + '/trade-curation/claim', { twitterId, pool }, { headers:headers(chainId) })
  if (r.c !== 0) throw new Error(r.error)
  if(currentChain()!==chainId) throw new Error('TRADE_CURATION_CHAIN_CHANGED')
  if(chainId===4663 && r.d?.chainId!==chainId) throw new Error('TRADE_CURATION_CHAIN_MISMATCH')
  return r.d
}
export const confirmTradeClaim = (twitterId: string, orderId: string, chainId = currentChain()) => post(BACKEND_API_URL + '/trade-curation/confirm', { twitterId, orderId }, { headers:headers(chainId) })
