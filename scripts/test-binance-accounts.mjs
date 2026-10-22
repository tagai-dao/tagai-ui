import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { isAddress } from 'viem'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
function component(file, mocks = {}) {
  const { descriptor, errors } = parse(read(file), { filename: file })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: file })
  const template = compileTemplate({
    source: descriptor.template.content, filename: file, id: file,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  const code = ts.transpileModule(script.content, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name === 'vue') return Vue
    if (name.endsWith('.vue')) return {}
    throw Error(`Missing mock ${name}`)
  }, exports)
  return exports.default
}

const logos = Object.fromEntries(['TAGAI', 'BINANCE', 'X', 'FOMO', 'GMGN', 'PUMP'].map(key => [key, key]))
const Badges = component('src/components/common/AccountOriginBadges.vue', {
  '@/assets/externalSourceLogos': { externalSourceLogos: logos },
})
test('Binance identities and wallets have one badge, including serialized numeric metadata', () => {
  for (const props of [
    { accountType: 3 }, { walletType: 2 }, { accountType: '3', walletType: '2' },
    { accountType: 3, walletType: 2, sources: 'binance,BINANCE' },
  ]) {
    const model = Badges.setup(Vue.reactive(props), { expose() {} })
    assert.deepEqual(model.origins.value, ['BINANCE'])
  }
})
test('existing origins coexist, and absent account type does not imply an X identity', () => {
  for (const [props, expected] of [
    [{}, []], [{ accountType: null }, []],
    [{ accountType: 0 }, ['X']],
    [{ walletType: 1, ethAddr: '0x123' }, ['TAGAI']],
    [{ accountType: 3, sources: ['fomo', 'GMGN', 'pump'] }, ['BINANCE', 'FOMO', 'GMGN', 'PUMP']],
  ]) assert.deepEqual(Badges.setup(props, { expose() {} }).origins.value, expected)
})

const UserAvatar = component('src/components/common/UserAvatar.vue', {
  vue: { ...Vue, onMounted() {} },
  '@/composables/useTools': { useTools: () => ({ onCopy() {} }) },
  '@/utils/helper': { formatAddress() {}, formatAmount() {}, formatPrice() {} },
  'vue-router': { useRouter: () => ({}) },
  '@/stores/community': { useCommunityStore: () => ({}) },
  '@/stores/common': { useStateStore: () => ({}) },
  '@/stores/chain': { useChainStore: () => ({ nativeCurrency: { symbol: 'BNB' } }) },
})
test('handle.ai avatar cards never link to a fictional X profile', () => {
  for (const [props, expected] of [
    [{ username: 'shower.ai', accountType: 3, walletType: 2 }, false],
    [{ username: 'shower.ai', accountType: 0 }, false],
    [{ username: 'shower', accountType: 0, walletType: 2 }, false],
    [{ username: 'TagAI', accountType: 0 }, true],
    [{ username: 'agent', accountType: 2 }, false],
    [{ username: 'user@example.com', accountType: 1 }, false],
  ]) assert.equal(UserAvatar.setup(props, { expose() {} }).showTwitterLink.value, expected)
})

const wallet = '0xe3ba25c853cc58a7b73b693d8e9ed84ca70c9185'
const identity = { twitterId: 'shower.ai', twitterName: 'shower.ai', twitterUsername: 'shower.ai', ethAddr: wallet, accountType: 3, walletType: 2, profile: '', supply: '5' }
function ipshareFixture(t, failStats = false) {
  const requests = [], navigation = [], subjects = [], errors = []
  const scope = Vue.effectScope()
  t.after(() => scope.stop())
  const List = component('src/views/ip/IPList.vue', {
    vue: { ...Vue, onMounted() {}, onBeforeUnmount() {} },
    '@/apis/api': {
      getIPShareList: async (...args) => { requests.push(args); return [identity] },
      getIPShareMarketSummary: async () => ({}),
    },
    '@/utils/helper': { formatAmount: String, formatPrice: String },
    '@/utils/ipshare': { calculateIPsharePriceLocal: supply => supply },
    '@/utils/ipshareAsset': { getIPshareMarketStats: async addresses => {
      subjects.push(addresses)
      if (failStats) throw Error('RPC unavailable')
      return { supplies: { [wallet]: 7 }, totalStaked: { [wallet]: 2 } }
    } },
    '@/stores/common': { useStateStore: () => ({ ethPrice: 600 }) },
    '@/stores/chain': { useChainStore: () => ({ deployment: { name: 'BSC' } }) },
    'vue-router': { useRouter: () => ({ push: path => navigation.push(path) }) },
    '@/utils/notify': { handleErrorTip: error => errors.push(error) },
    viem: { isAddress },
  })
  const model = scope.run(() => List.setup({}, { expose() {} }))
  return { model, requests, navigation, subjects, errors }
}
const flush = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
test('Binance account with IPShare remains in the list, navigates by handle and trades its wallet subject', async t => {
  const f = ipshareFixture(t)
  await f.model.refreshList(false)
  await flush()
  assert.equal(f.model.list.value.length, 1)
  const ip = f.model.list.value[0]
  assert.equal(ip.twitterName, 'shower.ai')
  assert.equal(ip.accountType, 3)
  assert.equal(ip.walletType, 2)
  assert.equal(ip.supply, 7)
  assert.equal(ip.totalStaked, 2)
  assert.deepEqual(f.subjects, [[wallet]])
  f.model.gotoUserPage(ip)
  assert.deepEqual(f.navigation, ['/user/shower.ai'])
  f.model.onTrade(ip)
  assert.equal(f.model.modalVisible.value, true)
  assert.equal(f.model.selectedIP.value.ethAddr, wallet)
  f.model.searchQuery.value = 'shower.ai'
  await f.model.refreshList(false)
  assert.deepEqual(f.requests.at(-1), [0, 'shower.ai'])
  assert.deepEqual(f.errors, [])
})
test('optional IPShare metrics failure does not hide the new Binance account', async t => {
  const f = ipshareFixture(t, true)
  await f.model.refreshList(false)
  await flush()
  assert.equal(f.model.list.value[0].twitterUsername, 'shower.ai')
  assert.equal(f.model.list.value[0].supply, 5)
})

test('all updated templates compile and account portraits use the local avatar fallback', () => {
  for (const file of [
    'src/views/ip/IPList.vue', 'src/views/profile/UserView.vue', 'src/views/wallet/TabIPShareHolding.vue',
    'src/views/buy-sell/RecordList.vue', 'src/views/tag-detail/TagToken.vue',
    'src/components/feed/FeedTradeActivity.vue', 'src/components/tweets/TweetItem.vue',
  ]) {
    const { descriptor } = parse(read(file), { filename: file })
    const script = compileScript(descriptor, { id: file })
    const template = compileTemplate({ source: descriptor.template.content, filename: file, id: file, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], file)
  }
  for (const file of ['src/views/ip/IPList.vue', 'src/views/wallet/TabIPShareHolding.vue', 'src/views/buy-sell/RecordList.vue']) {
    assert.doesNotMatch(read(file), /profile-images\.heywallet\.com/)
    assert.match(read(file), /<SafeAvatar/)
  }
})
