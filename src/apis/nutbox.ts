import { BACKEND_API_URL } from '@/config'
import { get } from '@/apis/axios'
import type {
  NutboxCommunityByTokenResponse,
  NutboxRewardSummary,
  NutboxTransactionPage,
} from '@/types/nutbox'

const api = (path: string) => `${BACKEND_API_URL}/nutbox${path}`

export const getNutboxCommunityByToken = (token: string) =>
  get(api(`/communities/by-token/${encodeURIComponent(token)}`)) as Promise<NutboxCommunityByTokenResponse>

export const getNutboxNftTransactions = (
  pool: string,
  params: { beforeBlock?: number; beforeLogIndex?: number; size?: number } = {},
) => get(
  api(`/mining/index-broker-nft-pools/${encodeURIComponent(pool)}/transactions`),
  params,
) as Promise<NutboxTransactionPage>

export const getNutboxNftRewardSummary = (pool: string) =>
  get(api(`/mining/index-broker-nft-pools/${encodeURIComponent(pool)}/index-rewards/24h`)) as Promise<NutboxRewardSummary>

export const getNutboxNftTransactionsWebSocketUrl = (pool: string) => {
  const url = new URL(BACKEND_API_URL, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/nutbox/ws/index-broker-nft-transactions`
  url.search = ''
  url.searchParams.set('pool', pool)
  return url.toString()
}
