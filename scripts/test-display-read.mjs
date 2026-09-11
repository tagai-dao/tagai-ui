import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
const source = readFileSync(new URL('../src/utils/displayRead.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createDisplayReader } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const storage = () => {
  const data = new Map()
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }
}
test('deduplicates requests, isolates chains and returns independent copies', async () => {
  let calls = 0
  const read = createDisplayReader(async () => { calls++; return { data: [{ id: 1 }] } })
  const [a, b] = await Promise.all([read('/list', {}, 56), read('/list', {}, 56)])
  a[0].id = 2
  assert.equal(b[0].id, 1); assert.equal(calls, 1)
  await read('/list', {}, 4663); assert.equal(calls, 2)
})
test('persistent public snapshot renders before a failing background request', async () => {
  const local = storage()
  await createDisplayReader(async () => ({ data: ['old'] }), local)('/list', {}, 56)
  const read = createDisplayReader(async () => { throw new Error('offline') }, local)
  assert.deepEqual(await read('/list', {}, 56, -1), ['old'])
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(await read('/list', {}, 56), ['old'])
})
test('personalized annotations are neither persisted nor shared between users', async () => {
  const local = storage()
  const read = createDisplayReader(async (_, query) => ({ data: query.twitterId }), local)
  assert.equal(await read('/feed', { twitterId: 'alice' }, 56), 'alice')
  assert.equal(await read('/feed', { twitterId: 'bob' }, 56), 'bob')
  assert.equal(local.data.size, 0)
})
test('cold failures reject instead of returning an empty successful list', async () => {
  const read = createDisplayReader(async () => { throw new Error('offline') })
  await assert.rejects(read('/list', {}, 56), error => error.displayRead === true)
})
test('explicit basket refresh waits for the latest list even with a fresh persisted snapshot', async () => {
  const local = storage()
  const query = { page: 0, size: 100 }
  await createDisplayReader(async () => ({ data: ['V3'] }), local)('/basket/list', query, 56)
  let complete
  const read = createDisplayReader(() => new Promise(resolve => { complete = resolve }), local)
  let resolved = false
  const pending = read('/basket/list', query, 56, 30000, true).then(value => { resolved = true; return value })
  await Promise.resolve()
  assert.equal(resolved, false)
  complete({ data: ['V3', 'CyberCab V4'] })
  assert.deepEqual(await pending, ['V3', 'CyberCab V4'])
  assert.deepEqual(await read('/basket/list', query, 56), ['V3', 'CyberCab V4'])
})
test('forced refresh joins an in-flight background read instead of returning its old membership', async () => {
  const local = storage()
  await createDisplayReader(async () => ({ data: ['V3'] }), local)('/basket/list', {}, 56)
  let complete, calls = 0
  const read = createDisplayReader(() => { calls++; return new Promise(resolve => { complete = resolve }) }, local)
  assert.deepEqual(await read('/basket/list', {}, 56, -1), ['V3'])
  const pending = read('/basket/list', {}, 56, 30000, true)
  complete({ data: ['V3', 'CyberCab V4'] })
  assert.deepEqual(await pending, ['V3', 'CyberCab V4'])
  assert.equal(calls, 1)
})
test('failed forced refresh reports failure and preserves the offline snapshot', async () => {
  const local = storage()
  await createDisplayReader(async () => ({ data: ['V3'] }), local)('/basket/list', {}, 56)
  const read = createDisplayReader(async () => { throw new Error('offline') }, local)
  await assert.rejects(read('/basket/list', {}, 56, 30000, true), error => error.displayRead === true)
  assert.deepEqual(await read('/basket/list', {}, 56), ['V3'])
})
test('caps parallel display requests at four', async () => {
  let active = 0, maximum = 0
  const read = createDisplayReader(async () => {
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 5)); active--
    return { data: [] }
  })
  await Promise.all(Array.from({ length: 12 }, (_, page) => read('/list', { page }, 56)))
  assert.equal(maximum, 4)
})
test('retries PAGE_PREPARING and coalesces readers until the snapshot is ready', async () => {
  let calls = 0
  const read = createDisplayReader(async () => {
    if (++calls === 1) throw { response: { status: 503, data: { code: 'PAGE_PREPARING', retryAfter: 1 } } }
    return { data: ['ready'] }
  })
  const [a, b] = await Promise.all([read('/list', {}, 56), read('/list', {}, 56)])
  assert.deepEqual(a, ['ready'])
  assert.deepEqual(b, ['ready'])
  assert.equal(calls, 2)
})
test('stops retrying persistent PAGE_PREPARING failures', async () => {
  let calls = 0
  const read = createDisplayReader(async () => {
    calls++
    throw { response: { status: 503, data: { code: 'PAGE_PREPARING' }, headers: { 'retry-after': '1' } } }
  })
  await assert.rejects(read('/list', {}, 56), error => error.displayRead === true)
  assert.equal(calls, 3)
})
test('does not retry authorization errors', async () => {
  let calls = 0
  const read = createDisplayReader(async () => {
    calls++
    throw { response: { status: 401, data: { code: 'UNAUTHORIZED' } } }
  })
  await assert.rejects(read('/list', {}, 56))
  assert.equal(calls, 1)
})
test('queued first loads survive a slow initial request batch', async () => {
  const read = createDisplayReader(async (_, query) => {
    if (query.page < 4) await new Promise(resolve => setTimeout(resolve, 2700))
    return { data: [query.page] }
  })
  const rows = await Promise.all(Array.from({ length: 5 }, (_, page) => read('/list', { page }, 56)))
  assert.deepEqual(rows[4], [4])
})
for (const name of ['components/common/PageDataStatus', 'views/HomeView', 'views/home/HomePost', 'views/tag-detail/HomeTagDetail', 'views/tag-detail/TagContent', 'views/tag-detail/TagToken', 'views/ip/IPList', 'views/buidler/PnlView', 'views/buidler/EarnView', 'views/tag-detail/Credit/TagCredit', 'views/tag-detail/Credit/PredictionCredit', 'views/baskets/BasketsListView']) {
  test(`${name} compiles`, () => {
    const filename = `src/${name}.vue`
    const { descriptor, errors } = parse(readFileSync(new URL('../' + filename, import.meta.url), 'utf8'), { filename })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: name })
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: name, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  })
}
