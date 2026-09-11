import './axios'
import axios from 'axios'
import { BACKEND_API_URL } from '@/config'
import { useAccountStore } from '@/stores/web3'

export type FavoriteToken = {
  chainId: number
  address: string
  kind: 'community' | 'basket'
  name: string
  symbol: string
  logo: string
}

export async function favoriteRequest<T>(action: 'list' | 'set', twitterId: string, chainId: number, data = {}) {
  const response = await axios.post(`${BACKEND_API_URL}/favorites/${action}`, { ...data, twitterId }, {
    headers: { 'X-Chain-Id': String(chainId) },
    'axios-retry': { retries: 0 },
  })
  const envelope = response.data
  const result = envelope.jwt ? envelope.data : envelope
  if (result?.c !== 0) throw new Error(result?.error || 'Unable to update watchlist')
  // A late response must never restore the account that has just logged out.
  const accountStore = useAccountStore()
  if (envelope.jwt && String(accountStore.getAccountInfo?.twitterId || '') === twitterId) {
    accountStore.setAccount({ ...accountStore.getAccountInfo, accessToken: envelope.jwt })
  }
  return result.d as T
}
