import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
for (const file of ['HomeView.vue', 'tag-detail/TagContent.vue']) {
  test(`${file} compiles`, async () => {
    const text = await readFile(new URL(`../src/views/${file}`, import.meta.url), 'utf8')
    const { descriptor } = parse(text)
    compileScript(descriptor, { id: file })
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, [])
  })
}
test('Token Empty is gated by successful loading and no error', async () => {
  const text = await readFile(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
  assert.equal((text.match(/listLoaded && !refreshing && !loadFailed/g) || []).length, 3)
  assert.match(text, /window.addEventListener\('online', retryVisibleList\)/)
  assert.match(text, /window.removeEventListener\('online', retryVisibleList\)/)
})
test('community initial posts do not await trades and pagination pauses after failure', async () => {
  const text = await readFile(new URL('../src/views/tag-detail/TagContent.vue', import.meta.url), 'utf8')
  const refresh = text.slice(text.indexOf('async function onRefresh()'), text.indexOf('async function onLoad()'))
  assert.doesNotMatch(refresh, /Promise.all/)
  assert.match(refresh, /allCommunityTweets.value = list/)
  assert.match(text, /:error="loadFailed"/)
  assert.match(text, /loadFailed.value \|\| tradesLoading.value/)
  assert.doesNotMatch(text, /while \(!comStore.currentSelectedCommunity/)
})
