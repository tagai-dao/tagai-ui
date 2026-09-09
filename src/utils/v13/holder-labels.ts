import { isAddress, zeroAddress, type Address, type Abi } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { getBasketDeployment } from '@/config/baskets'
import { getV13Detail } from './pools'
import tokenAbi from './Token13.json'

export type HolderLabel = { key: string; asset?: string }
export async function readV13HolderLabels(token: Address): Promise<Record<string, HolderLabel>> {
  const labels: Record<string, HolderLabel> = {}
  const add = (address: string | undefined, key: string, asset?: string) => {
    if (address && isAddress(address, { strict: false }) && address.toLowerCase() !== zeroAddress) {
      labels[address.toLowerCase()] = { key, asset }
    }
  }
  // A temporary failure in either source must not hide labels supplied by the other.
  const [detail, contracts] = await Promise.allSettled([
    getV13Detail(token),
    getReadOnlyClient(56).multicall({ allowFailure: true, contracts:
      ['vault', 'clPoolManager', 'listingHook', 'nutboxCommunity'].map(functionName => ({ address: token, abi: tokenAbi as Abi, functionName })),
    }),
  ])
  if (contracts.status === 'fulfilled') {
    const keys = ['v13Page.holderV4Vault', 'v13Page.holderV4Manager', 'v13Page.rewardReserve', 'postView.nutbox']
    contracts.value.forEach((result, index) => {
      if (result.status === 'success') add(result.result as string, keys[index])
    })
  }
  if (detail.status === 'fulfilled') {
    for (const component of detail.value.components) {
      const asset = component.asset_symbol?.trim()
        || getBasketDeployment(56).assetPresets.find(p => p.address.toLowerCase() === component.asset.toLowerCase())?.symbol
        || `${component.asset.slice(0, 6)}…${component.asset.slice(-4)}`
      add(component.pair, 'v13Page.holderComponentPool', asset)
      add(component.staking_pool, 'v13Page.holderStakingPool', asset)
    }
    add(detail.value.config.community, 'postView.nutbox')
  }
  return labels
}
