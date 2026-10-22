import { get, post } from '@/apis/axios'
import { API_BASE_URL } from '@/config/api'
import { isAddress, type Address } from 'viem'
import { getChainDeployment } from '@/config/chains'
import { sortBasketAssetOptions } from '@/utils/baskets/asset-order'
export type CreationOptions = { chainId: number; version: number; pump: string; tokenImplementation: string; sourceBlock: number;
  assets: {address: `0x${string}`; symbol: string; decimals: number}[];
  pumpFee: string; ipshareFee: string; communityFee: string; settingsFee: string; tradePool: { factory: `0x${string}`; enabled: boolean; maxRewardRatio: number } }
import { validTradePool } from '../v14/creation-config'
export { validateIndexConfig } from './index-config'
export async function creationOptions(creator: string, chainId = 56, selectedVersion?: 14 | 15 | 16): Promise<CreationOptions> {
  if (!isAddress(creator)) throw new Error('Connect a wallet to load creation settings')
  const d = getChainDeployment(chainId), version = selectedVersion ?? d.latestPumpVersion
  if (![14, 15, 16].includes(version) || (chainId !== 56 && version !== 14)) throw new Error('Unsupported creation version')
  try {
    const r: any = await get(`${API_BASE_URL}/pump/v${version}/creation/${creator}`, {}, {
      headers: {'X-Chain-Id':String(chainId)}, timeout: 8000, 'axios-retry': { retries: 0 },
    })
    if (r?.c !== 0 || r.d?.chainId !== chainId || r.d?.version !== version ||
        r.d?.pump?.toLowerCase() !== d.contracts[`pump${version}` as keyof typeof d.contracts]?.toLowerCase() ||
        !validTradePool(r.d?.tradePool, chainId) ||
        r.d?.tokenImplementation?.toLowerCase() !== d.contracts[`tokenImplementation${version}` as keyof typeof d.contracts]?.toLowerCase() ||
        !Number.isSafeInteger(r.d?.sourceBlock) || !isAddress(r.d?.tokenImplementation ?? '') ||
        !Array.isArray(r.d?.assets) || !r.d.assets.every((a: CreationOptions['assets'][number]) =>
          isAddress(a?.address ?? '') && typeof a.symbol === 'string' && a.symbol.length > 0 && Number.isInteger(a.decimals) && a.decimals >= 0 && a.decimals <= 255) ||
        !['pumpFee', 'ipshareFee', 'communityFee', 'settingsFee'].every(k => typeof r.d[k] === 'string' && /^\d+$/.test(r.d[k]))) {
      throw new Error('Creation settings unavailable')
    }
    return { ...r.d, assets: sortBasketAssetOptions(r.d.assets) }
  } catch {
    const [{ getReadOnlyClient }, { readCreationOptions }] = await Promise.all([
      import('@/utils/wallets'), import('./creation-chain'),
    ])
    return readCreationOptions(getReadOnlyClient(chainId), creator as Address, version as 14 | 15 | 16)
  }
}
export const creationFee = (o: CreationOptions, count: number) => BigInt(o.pumpFee)+BigInt(o.ipshareFee)+BigInt(o.communityFee)+BigInt(o.settingsFee)*BigInt(count)
export async function registerV13(form: { version?: number; chainId?: number; binanceWalletOnly?: boolean }) {
  const version = Number(form.version)
  const chainId = form.chainId ?? 56
  if (![56,4663].includes(chainId) || (chainId === 4663 && version !== 14)) throw new Error('Unsupported registration chain')
  if (![13, 14, 15, 16].includes(version)) throw new Error('Unsupported registration version')
  // Historical receipts retain their own endpoints; BSC creation selects V14 or V16; RH uses V14.
  const r: any = await post(`${API_BASE_URL}/pump/v${version}/register`, form, {headers:{'X-Chain-Id':String(chainId)}, timeout: 10_000, 'axios-retry': { retries: 0 }})
  if (r?.c !== 0 || !r.d) throw new Error('Token registration unavailable')
  return r.d
}
