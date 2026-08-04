import { get, post } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { getBasketDeployment } from '@/config/baskets'
import type { Address, Hex } from 'viem'
import type { BasketLegRoute } from './types'

export type RegisteredBasketAsset = {
  position: number
  address: Address
  symbol: string
  decimals: number
  targetWeightBps: number
  route: BasketLegRoute
}

export type RegisteredBasket = {
  address: Address
  name: string
  symbol: string
  decimals: number
  creator: Address
  basketFeeBps: number
  creatorShareBps: number
  version: number
  basketLength: number
  createdAt: number
  assets: RegisteredBasketAsset[]
}

export type BasketTradeEvent = {
  id: string
  basket: Address
  is_buy: number | boolean
  payer: Address
  recipient: Address
  frontend?: Address
  usdg_amount: string
  basket_amount: string
  fee_weth: string
  routed?: number | boolean
  router_log_index?: number
  block_number: number
  block_hash?: string
  block_timestamp: number
  transaction_hash: Hex
  log_index: number
}

type BasketListResponse = {
  c: number
  d: {
    list: RegisteredBasket[]
    total: number
    page: number
    size: number
  }
}

type BasketDetailResponse = {
  c: number
  d: RegisteredBasket
}

type BasketEventsResponse<T> = {
  c: number
  d: {
    list: T[]
    page: number
    size: number
  }
}

const chainHeaders = (chainId: number) => {
  getBasketDeployment(chainId)
  return { headers: { 'X-Chain-Id': String(chainId) } }
}

export const registerBasketDeployment = (basketAddress: Address, txHash: Hex, chainId: number) =>
  post(`${API_BASE_URL}/basket/register`, { basketAddress, txHash }, chainHeaders(chainId))

export const listRegisteredBaskets = async (chainId: number): Promise<RegisteredBasket[]> => {
  const baskets: RegisteredBasket[] = []
  const size = 100
  for (let page = 0; page < 100; page += 1) {
    const response = await get(
      `${API_BASE_URL}/basket/list`,
      { page, size },
      chainHeaders(chainId),
    ) as BasketListResponse
    const rows = Array.isArray(response?.d?.list) ? response.d.list : []
    baskets.push(...rows)
    if (baskets.length >= Number(response?.d?.total || 0) || rows.length < size) break
  }
  return baskets
}

export const listRegisteredBasketAddresses = async (chainId: number): Promise<Address[]> =>
  (await listRegisteredBaskets(chainId)).map((basket) => basket.address)

export const getRegisteredBasket = async (address: Address, chainId: number): Promise<RegisteredBasket> => {
  const response = await get(
    `${API_BASE_URL}/basket/${address}`,
    undefined,
    chainHeaders(chainId),
  ) as BasketDetailResponse
  return response.d
}

export const listBasketTrades = async (
  address: Address,
  chainId: number,
  page = 0,
  size = 20,
): Promise<BasketTradeEvent[]> => {
  const response = await get(
    `${API_BASE_URL}/basket/${address}/trades`,
    { page, size },
    chainHeaders(chainId),
  ) as BasketEventsResponse<BasketTradeEvent>
  return Array.isArray(response?.d?.list) ? response.d.list : []
}
