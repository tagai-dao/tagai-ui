import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const dir = await mkdtemp(join(tmpdir(), 'v13-registration-'))
await build({ entryPoints: ['src/utils/v13/registration-queue.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'queue.cjs') })
const { createRegistrationQueue } = createRequire(import.meta.url)(join(dir, 'queue.cjs'))
await rm(dir, { recursive: true, force: true })
const form = (id = '1') => ({ chainId: 56, version: 13, createHash: '0x' + id.repeat(64), ethAddr: '0x' + '12'.repeat(20), tick: 'TEST', token: '', logoUrl: 'logo', desc: 'saved metadata' })
function storage() {
 const s = {}
 Object.defineProperties(s, {
  getItem: { value: k => s[k] ?? null }, setItem: { value: (k, v) => { s[k] = v } }, removeItem: { value: k => { delete s[k] } },
 })
 return s
}
function setup(overrides = {}) {
 const saved = overrides.storage ?? storage()
 const calls = []
 const deps = { storage: saved, scope: 'production:56', now: () => 0, receipt: async () => ({ status: 'success' }), register: async f => { calls.push(f); return { token: 'created' } }, synced: () => {}, ...overrides }
 return { deps, saved, calls, queue: createRegistrationQueue(deps) }
}
test('failed API upload persists through reload, respects backoff and retries the same hash', async () => {
 let time = 0, attempts = 0
 const f = form()
 const { deps, saved, queue } = setup({ now: () => time, register: async payload => { assert.deepEqual(payload, f); if (++attempts === 1) throw new Error('offline'); return {} } })
 queue.enqueue(f); await queue.flush()
 assert.equal(Object.keys(saved).length, 1)
 const restarted = createRegistrationQueue(deps)
 time = 4999; await restarted.flush(); assert.equal(attempts, 1)
 time = 5000; await restarted.flush(); assert.equal(attempts, 2)
 assert.equal(Object.keys(saved).length, 0)
})
test('several creations remain independent and preserve their submitted metadata', async () => {
 const { queue, calls } = setup()
 const first = form('1'); queue.enqueue(first); first.desc = 'edited later'
 queue.enqueue(form('2')); await queue.flush()
 assert.equal(calls.length, 2); assert.equal(calls[0].desc, 'saved metadata')
 assert.notEqual(calls[0].createHash, calls[1].createHash)
})
test('pending receipt waits; reverted transaction never registers', async () => {
 let time = 0, status = 'pending'
 const { queue, calls, saved } = setup({ now: () => time, receipt: async () => { if (status === 'pending') throw new Error('not mined'); return { status } } })
 queue.enqueue(form()); await queue.flush(); assert.equal(calls.length, 0); assert.equal(Object.keys(saved).length, 1)
 status = 'reverted'; time = 5000; await queue.flush()
 assert.equal(calls.length, 0); assert.equal(Object.keys(saved).length, 0)
})
test('old V13 draft migrates automatically, keeping legacy and other-chain drafts untouched', async () => {
 const { queue, saved, calls } = setup()
 saved.setItem('createTokenForm:56:owner', JSON.stringify(form()))
 saved.setItem('createTokenForm:4663:owner', JSON.stringify({ ...form(), chainId: 4663, version: 11 }))
 saved.setItem('createTokenForm', JSON.stringify({ version: 9 }))
 await queue.flush()
 assert.equal(calls.length, 1); assert.equal(saved.getItem('createTokenForm:56:owner'), null)
 assert.equal(Object.keys(saved).length, 2)
})
test('another API or fork chain cannot consume production pending uploads', async () => {
 const { queue, saved } = setup(); queue.enqueue(form())
 for (const scope of ['local:560013', 'production:560013']) {
  const other = setup({ storage: saved, scope }); await other.queue.flush(); assert.equal(other.calls.length, 0)
 }
 assert.equal(Object.keys(saved).length, 1)
})
test('simultaneous triggers share one upload', async () => {
 let release, calls = 0
 const barrier = new Promise(resolve => { release = resolve })
 const { queue } = setup({ register: async () => { calls++; await barrier; return {} } })
 queue.enqueue(form())
 const a = queue.flush(), b = queue.flush()
 assert.equal(a, b); release(); await Promise.all([a, b]); assert.equal(calls, 1)
})
test('unavailable browser storage still permits upload in this session', async () => {
 const s = storage(); const unavailable = Object.create(s)
 Object.defineProperty(unavailable, 'setItem', { value: () => { throw new Error('quota') } })
 const { queue, calls } = setup({ storage: unavailable }); queue.enqueue(form()); await queue.flush()
 assert.equal(calls.length, 1)
})
