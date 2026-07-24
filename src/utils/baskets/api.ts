import { get, post } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { BASKET_CHAIN_ID } from '@/config/baskets'
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

const chainHeaders = { headers: { 'X-Chain-Id': String(BASKET_CHAIN_ID) } }

export const registerBasketDeployment = (basketAddress: Address, txHash: Hex) =>
  post(`${API_BASE_URL}/basket/register`, { basketAddress, txHash }, chainHeaders)

export const listRegisteredBaskets = async (): Promise<RegisteredBasket[]> => {
  const baskets: RegisteredBasket[] = []
  const size = 100
  for (let page = 0; page < 100; page += 1) {
    const response = await get(
      `${API_BASE_URL}/basket/list`,
      { page, size },
      chainHeaders,
    ) as BasketListResponse
    const rows = Array.isArray(response?.d?.list) ? response.d.list : []
    baskets.push(...rows)
    if (baskets.length >= Number(response?.d?.total || 0) || rows.length < size) break
  }
  return baskets
}

export const listRegisteredBasketAddresses = async (): Promise<Address[]> =>
  (await listRegisteredBaskets()).map((basket) => basket.address)

export const getRegisteredBasket = async (address: Address): Promise<RegisteredBasket> => {
  const response = await get(
    `${API_BASE_URL}/basket/${address}`,
    undefined,
    chainHeaders,
  ) as BasketDetailResponse
  return response.d
}
