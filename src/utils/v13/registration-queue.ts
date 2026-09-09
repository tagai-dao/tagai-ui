import type { CreateCommunity } from '@/types'

export type RegistrationForm = CreateCommunity & { createHash: string; chainId: 56; version: 13 }
type Entry = { form: RegistrationForm; attempts: number; nextAttempt: number }
type Dependencies = {
  storage: Storage
  scope: string
  now?: () => number
  receipt: (hash: string) => Promise<{ status: string }>
  register: (form: RegistrationForm) => Promise<unknown>
  synced: (form: RegistrationForm, result: unknown) => void
}

// One record per transaction: a later creation must never overwrite an earlier
// upload. The scope separates API environments and fork chains on the same origin.
export function createRegistrationQueue(deps: Dependencies) {
  const prefix = `v13-registration:${encodeURIComponent(deps.scope)}:`
  const memory = new Map<string, Entry>()
  const now = deps.now ?? Date.now
  let running: Promise<void> | undefined
  function save(key: string, entry: Entry) {
    memory.set(key, entry)
    try { deps.storage.setItem(key, JSON.stringify(entry)) } catch { /* Retain in memory if storage is unavailable. */ }
  }
  function remove(key: string) {
    deps.storage.removeItem(key)
    memory.delete(key)
  }
  function enqueue(form: RegistrationForm) {
    if (form.chainId !== 56 || form.version !== 13 || !/^0x[\da-f]{64}$/i.test(form.createHash)) throw new Error('Invalid V13 registration')
    const key = prefix + form.createHash.toLowerCase()
    // Snapshot metadata so edits in another creation form cannot change it.
    save(key, { form: JSON.parse(JSON.stringify(form)), attempts: 0, nextAttempt: 0 })
  }
  function migrate() {
    for (const key of Object.keys(deps.storage)) {
      if (!key.startsWith('createTokenForm:56:') && key !== 'createTokenForm') continue
      try {
        const form = JSON.parse(deps.storage.getItem(key)!)
        if (form.version !== 13 || form.chainId !== 56) continue
        enqueue(form)
        // Remove the old record only after its replacement was persisted.
        if (deps.storage.getItem(prefix + form.createHash.toLowerCase())) deps.storage.removeItem(key)
      } catch { /* Preserve malformed or other-version drafts. */ }
    }
  }
  async function drain() {
    migrate()
    for (const key of Object.keys(deps.storage)) {
      if (!key.startsWith(prefix) || memory.has(key)) continue
      try { memory.set(key, JSON.parse(deps.storage.getItem(key)!)) } catch { /* Preserve unreadable records. */ }
    }
    for (const [key, entry] of memory) {
      if (entry.nextAttempt > now()) continue
      try {
        const receipt = await deps.receipt(entry.form.createHash)
        if (receipt.status === 'reverted') { remove(key); continue }
        if (receipt.status !== 'success') throw new Error('Receipt not confirmed')
        const result = await deps.register(entry.form)
        remove(key)
        try { deps.synced(entry.form, result) } catch { /* A UI refresh failure must not replay a completed upload. */ }
      } catch {
        entry.attempts++
        entry.nextAttempt = now() + Math.min(300_000, 5_000 * 2 ** Math.min(entry.attempts - 1, 6))
        save(key, entry)
      }
    }
  }
  function flush() {
    // Startup, timer, connectivity and submission can all trigger the worker.
    if (!running) running = drain().finally(() => { running = undefined })
    return running
  }
  return { enqueue, flush }
}
