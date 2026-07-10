/**
 * 按当前产品链过滤社区 / 持仓，避免把 BSC 合约地址拿到 RH RPC 上读。
 * 后端未返回 chainId 时默认视为 BSC（56），与 community.chain_id DEFAULT 一致。
 */
import { DEFAULT_CHAIN_ID } from '@/config/chains'
import { useChainStore } from '@/stores/chain'

export const resolveItemChainId = (item: {
  chainId?: number | null
  chain_id?: number | null
  community?: { chainId?: number | null; chain_id?: number | null } | null
}): number => {
  const raw =
    item.chainId ??
    item.chain_id ??
    item.community?.chainId ??
    item.community?.chain_id
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
  return 56
}

/** 是否属于当前产品链 */
export const isOnActiveChain = (item: Parameters<typeof resolveItemChainId>[0]): boolean => {
  try {
    return resolveItemChainId(item) === useChainStore().activeChainId
  } catch {
    return resolveItemChainId(item) === DEFAULT_CHAIN_ID
  }
}

export const filterByActiveChain = <T extends Parameters<typeof resolveItemChainId>[0]>(
  items: T[] | null | undefined
): T[] => {
  if (!items?.length) return []
  return items.filter(isOnActiveChain)
}
