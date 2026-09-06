import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
for (const view of ['profile/ProfileView', 'profile/UserView', 'profile/TabPost', 'profile/TabBlinksTweet', 'profile/TabCreateCoin', 'wallet/TipTokenRecord']) {
  test(`${view} script and template compile`, () => {
    const filename = `src/views/${view}.vue`
    const { descriptor, errors } = parse(read(filename), { filename })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: view })
    const template = compileTemplate({ source: descriptor.template.content, filename, id: view, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  })
}
test('profile lists use scoped, reactive scroll parent rather than global DOM selection', () => {
  for (const view of ['TabPost', 'TabBlinksTweet', 'TabCreateCoin']) {
    const source = read(`src/views/profile/${view}.vue`)
    assert.ok(source.includes('const scroller = useProfileScrollParent()'))
    assert.ok(source.includes(':scroller="scroller"'))
    assert.ok(!source.includes('document.querySelector'))
    assert.ok(!source.includes('min-h-full h-full overflow-auto'))
  }
})
test('self and public profiles share one scroll region and sticky tabs', () => {
  for (const view of ['ProfileView', 'UserView']) {
    const source = read(`src/views/profile/${view}.vue`)
    assert.ok(source.includes('ref="profileScroller" class="profile-scroll-page"'))
    assert.ok(source.includes('ref="profileTabs" class="profile-content-tabs"'))
    assert.ok(source.includes('ref="profileContent" class="profile-scroll-content"'))
    assert.ok(!source.includes('id="profile-tab-scroller"'))
  }
  assert.match(read('src/assets/profile-scroll.css'), /position: sticky/)
})
