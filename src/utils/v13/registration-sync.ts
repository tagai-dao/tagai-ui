import { API_BASE_URL } from '@/config/api'
import { getReadOnlyClient } from '@/utils/wallets'
import { useChainStore } from '@/stores/chain'
import emitter from '@/utils/emitter'
import { registerV13 } from './creation'
import { createRegistrationQueue, type RegistrationForm } from './registration-queue'

let queue: ReturnType<typeof createRegistrationQueue> | undefined
function getQueue() {
  if (!queue) {
    const client = getReadOnlyClient(56)
    queue = createRegistrationQueue({
      storage: localStorage,
      scope: `${API_BASE_URL}:${client.chain?.id ?? 56}`,
      receipt: hash => client.getTransactionReceipt({ hash: hash as `0x${string}` }),
      register: registerV13,
      synced: (form, result) => {
        if (useChainStore().activeChainId === form.chainId) emitter.emit('newCommunity', { ...form, ...(result as object) })
      },
    })
  }
  return queue
}
export function enqueueV13Registration(form: RegistrationForm) {
  getQueue().enqueue(form)
  void getQueue().flush().catch(() => {})
}
export function startV13RegistrationSync() {
  const sync = () => { void getQueue().flush().catch(() => {}) }
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
