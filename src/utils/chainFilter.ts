/**
 * 按当前产品链过滤社区 / 持仓，避免把 BSC 合约地址拿到 RH RPC 上读。
 * 有效旧数据未返回 chainId 时视为当前激活链；空项始终丢弃。
 */
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { useChainStore } from '@/stores/chain'

type ChainScopedItem = {
  chainId?: number | null
  chain_id?: number | null
  community?: { chainId?: number | null; chain_id?: number | null } | null
}

export const resolveItemChainId = (item: ChainScopedItem | null | undefined): number => {
  if (!item || typeof item !== 'object') return DEFAULT_CHAIN_ID
  const raw =
    item.chainId ??
    item.chain_id ??
    item.community?.chainId ??
    item.community?.chain_id
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
  try {
    return useChainStore().activeChainId
  } catch {
    return DEFAULT_CHAIN_ID
  }
}

/** 是否属于当前产品链 */
export const isOnActiveChain = (item: ChainScopedItem | null | undefined): boolean => {
  if (!item || typeof item !== 'object') return false
  try {
    return resolveItemChainId(item) === useChainStore().activeChainId
  } catch {
    return resolveItemChainId(item) === DEFAULT_CHAIN_ID
  }
}

export const filterByActiveChain = <T extends ChainScopedItem>(
  items: Array<T | null | undefined> | null | undefined
): T[] => {
  if (!items?.length) return []
  return items.filter((item): item is T => isOnActiveChain(item))
}
