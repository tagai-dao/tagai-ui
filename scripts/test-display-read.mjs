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
for (const name of ['components/common/PageDataStatus', 'views/HomeView', 'views/home/HomePost', 'views/tag-detail/HomeTagDetail', 'views/tag-detail/TagContent', 'views/tag-detail/TagToken', 'views/ip/IPList', 'views/buidler/PnlView', 'views/buidler/EarnView', 'views/tag-detail/Credit/TagCredit', 'views/tag-detail/Credit/PredictionCredit', 'views/baskets/BasketsListView']) {
  test(`${name} compiles`, () => {
    const filename = `src/${name}.vue`
    const { descriptor, errors } = parse(readFileSync(new URL('../' + filename, import.meta.url), 'utf8'), { filename })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: name })
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: name, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
  })
}
