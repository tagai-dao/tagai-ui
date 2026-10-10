import { API_BASE_URL } from '@/config/api'
import { getReadOnlyClient } from '@/utils/wallets'
import { useChainStore } from '@/stores/chain'
import emitter from '@/utils/emitter'
import { registerV13 } from './creation'
import { createRegistrationQueue, type RegistrationForm } from './registration-queue'

const queues = new Map<number, ReturnType<typeof createRegistrationQueue>>()
function getQueue(chainId: 56 | 4663) {
  let queue = queues.get(chainId)
  if (!queue) {
    const client = getReadOnlyClient(chainId)
    queue = createRegistrationQueue({
      chainId,
      storage: localStorage,
      scope: `${API_BASE_URL}:${chainId}`,
      receipt: hash => client.getTransactionReceipt({ hash: hash as `0x${string}` }),
      register: registerV13,
      synced: (form, result) => {
        if (useChainStore().activeChainId === form.chainId) emitter.emit('newCommunity', { ...form, ...(result as object) })
      },
    })
  }
  queues.set(chainId, queue)
  return queue
}
export function enqueueV13Registration(form: RegistrationForm) {
  getQueue(form.chainId).enqueue(form)
  void getQueue(form.chainId).flush().catch(() => {})
}
export function startV13RegistrationSync() {
  const sync = () => { for (const chainId of [56,4663] as const) void getQueue(chainId).flush().catch(() => {}) }
  const visible = () => { if (document.visibilityState === 'visible') sync() }
  const timer = window.setInterval(sync, 5_000)
  window.addEventListener('online', sync)
  window.addEventListener('storage', sync)
  document.addEventListener('visibilitychange', visible)
  sync()
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('online', sync)
    window.removeEventListener('storage', sync)
    document.removeEventListener('visibilitychange', visible)
  }
}
