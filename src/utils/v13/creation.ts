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
export async function creationOptions(creator: string): Promise<CreationOptions> {
  if (!isAddress(creator)) throw new Error('Connect a wallet to load creation settings')
  try {
    const r: any = await get(`${API_BASE_URL}/pump/v14/creation/${creator}`, {}, {
      headers: {'X-Chain-Id':'56'}, timeout: 8000, 'axios-retry': { retries: 0 },
    })
    if (r?.c !== 0 || r.d?.chainId !== 56 || r.d?.version !== 14 ||
        r.d?.pump?.toLowerCase() !== getChainDeployment(56).contracts.pump14?.toLowerCase() ||
        !validTradePool(r.d?.tradePool) ||
        r.d?.tokenImplementation?.toLowerCase() !== getChainDeployment(56).contracts.tokenImplementation14?.toLowerCase() ||
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
    return readCreationOptions(getReadOnlyClient(56), creator as Address)
  }
}
export const creationFee = (o: CreationOptions, count: number) => BigInt(o.pumpFee)+BigInt(o.ipshareFee)+BigInt(o.communityFee)+BigInt(o.settingsFee)*BigInt(count)
export async function registerV13(form: { version?: number }) {
  const version = Number(form.version)
  if (![13, 14].includes(version)) throw new Error('Unsupported registration version')
  // V13 is retained only for already-submitted receipt recovery. New creation uses V14.
  const r: any = await post(`${API_BASE_URL}/pump/v${version}/register`, form, {headers:{'X-Chain-Id':'56'}, timeout: 10_000, 'axios-retry': { retries: 0 }})
  if (r?.c !== 0 || !r.d) throw new Error('Token registration unavailable')
  return r.d
}
