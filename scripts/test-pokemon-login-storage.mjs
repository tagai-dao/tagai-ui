import assert from 'node:assert/strict'
import { prepareLoginStorage, writePublicSnapshot } from '../src/utils/publicSnapshot.ts'

const data = new Map()
globalThis.localStorage = {
  get length() { return data.size },
  key: i => Array.from(data.keys())[i],
  getItem: k => data.get(k) ?? null,
  removeItem: k => data.delete(k),
  setItem(k, value) {
    let size = k.length + value.length
    for (const [key, text] of data) if (key !== k) size += key.length + text.length
    if (size > 700000) throw new DOMException('Storage full', 'QuotaExceededError')
    data.set(k, value)
  },
}
const cachePrefix = 'tagai-public-snapshot:v1:'
localStorage.setItem('accountInfo', 'existing account')
localStorage.setItem('privy:existing', 'existing session')
localStorage.setItem(cachePrefix + 'legacy', 'x'.repeat(699900))
assert.throws(() => localStorage.setItem('privy:pat', 'x'.repeat(2000)))
prepareLoginStorage()
localStorage.setItem('privy:pat', 'x'.repeat(2000))
assert.equal(data.has(cachePrefix + 'legacy'), false)
assert.equal(data.get('accountInfo'), 'existing account')
assert.equal(data.get('privy:existing'), 'existing session')
for (let i = 0; i < 15; i++) writePublicSnapshot(String(i), 'x'.repeat(100000))
const entries = [...data].filter(([key]) => key.startsWith(cachePrefix))
assert.ok(entries.length > 0)
assert.ok(entries.reduce((n,[k,v]) => n + k.length + v.length, 0) <= 512 * 1024)
