import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
for (const view of ['profile/ProfileView', 'profile/UserView', 'profile/TabPost', 'profile/TabBlinksTweet', 'profile/TabCreateCoin', 'profile/TabPrediction', 'wallet/WalletView', 'wallet/TabHoldTag', 'wallet/TabIPShareHolding', 'wallet/TabSocialAccount', 'wallet/social/AddTokenList', 'wallet/TipTokenRecord']) {
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
test('mobile wallet shares one scroll region with sticky tabs and scoped list pagination', () => {
  const wallet = read('src/views/wallet/WalletView.vue')
  assert.ok(wallet.includes('ref="walletScroller" class="profile-scroll-page wallet-scroll-page"'))
  assert.ok(wallet.includes('ref="walletTabs" class="profile-content-tabs wallet-content-tabs"'))
  assert.ok(wallet.includes('ref="walletContent" class="profile-scroll-content wallet-scroll-content"'))
  assert.ok(wallet.includes('mobileViewport.value ? walletScroller.value : walletContent.value'))
  for (const view of ['wallet/TabHoldTag', 'wallet/TabIPShareHolding', 'profile/TabPrediction', 'wallet/social/AddTokenList']) {
    const source = read(`src/views/${view}.vue`)
    assert.ok(source.includes('const scroller = useProfileScrollParent()'))
    assert.ok(source.includes(':scroller="scroller"'))
    assert.ok(!source.includes("document.querySelector('#profile-tab-scroller')"))
  }
  assert.ok(!read('src/views/wallet/TabHoldTag.vue').includes('min-h-full h-full overflow-auto'))
  assert.ok(!read('src/views/wallet/TabIPShareHolding.vue').includes('class="h-full overflow-auto"'))
  assert.ok(!read('src/views/profile/TabPrediction.vue').includes('class="h-full overflow-auto"'))
})
