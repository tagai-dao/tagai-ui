import { ref, watch, onScopeDispose, type Ref } from 'vue'
import { isAddress } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { fetchAgentIdImage, readAgentIdAvatarUris } from '@/utils/agentIdAvatar'

const cache = new Map<string, { image: string; expires: number }>()
const pending = new Map<string, Promise<string>>()
const queue = new Map<string, (image: string) => void>()
let timer: ReturnType<typeof setTimeout> | undefined
async function flush() {
  timer = undefined
  const batch = [...queue.entries()]; queue.clear()
  let uris: Record<string, string> = {}
  let failed = false
  try { uris = await readAgentIdAvatarUris(getReadOnlyClient(56), batch.map(([address]) => address)) } catch { failed = true }
  // Bound metadata concurrency as well; failures never block the account list.
  for (let i = 0; i < batch.length; i += 6) await Promise.all(batch.slice(i, i + 6).map(async ([address, resolve]) => {
    let image = ''
    try { if (uris[address]) image = await fetchAgentIdImage(uris[address]!) } catch { failed = true }
    cache.set(address, { image, expires: Date.now() + (image ? 300000 : failed ? 10000 : 60000) })
    while (cache.size > 2000) cache.delete(cache.keys().next().value!)
    pending.delete(address); resolve(image)
  }))
}
function load(address: string): Promise<string> {
  const hit = cache.get(address)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.image)
  if (pending.has(address)) return pending.get(address)!
  const task = new Promise<string>(resolve => queue.set(address, resolve))
  pending.set(address, task)
  timer ??= setTimeout(() => { void flush() }, 20)
  return task
}

export function useAgentIdAvatar(address: Ref<string | null | undefined>) {
  const image = ref('')
  let sequence = 0
  onScopeDispose(() => { sequence++ })
  watch(address, async value => {
    const current = ++sequence; image.value = ''
    if (!value || !isAddress(value, { strict: false })) return
    const result = await load(value.toLowerCase())
    if (current === sequence) image.value = result
  }, { immediate: true })
  return image
}
