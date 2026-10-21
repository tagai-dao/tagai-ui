import { computed, onScopeDispose, ref, watch } from 'vue'
import { isAddress, type Address } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { readBuyerHandle, requiresBuyerHandle } from '@/utils/v15/buyer'

type Context = {
  chainId: number; version?: number; token?: string; account?: string
  connected: boolean; listed: boolean; ready: boolean; side: string
}
type Status = 'idle' | 'checking' | 'eligible' | 'unregistered' | 'unavailable'

/** Eligibility belongs to the current address, token, chain and trade side. */
export function useV15BuyerEligibility(context: () => Context,
  read: (account: Address) => Promise<boolean> = account => readBuyerHandle(getReadOnlyClient(56), account)) {
  const current = computed(context)
  const active = computed(() => {
    const c = current.value
    return requiresBuyerHandle(c.chainId, Number(c.version)) && c.ready && c.connected && !c.listed
      && c.side === 'buy' && isAddress(c.token ?? '') && isAddress(c.account ?? '')
  })
  const status = ref<Status>('idle')
  const blocked = computed(() => active.value && status.value !== 'eligible')
  let generation = 0
  async function refresh() {
    const id = ++generation
    if (!active.value) { status.value = 'idle'; return }
    const account = current.value.account as Address
    status.value = 'checking'
    try {
      const eligible = await read(account)
      if (id === generation) status.value = eligible ? 'eligible' : 'unregistered'
    } catch {
      if (id === generation) status.value = 'unavailable'
    }
  }
  watch(current, () => { void refresh() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++ })
  return { active, status, blocked, refresh }
}
