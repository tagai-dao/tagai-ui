import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

const built = await build({ entryPoints: ['src/utils/blinkLoginReturn.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
const { safeBlinkReturn, saveBlinkLoginReturn, takeBlinkLoginReturn, clearBlinkLoginReturn } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
function storage() {
  const values = new Map()
  return { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }
}
for (const chain of ['bsc', 'rh']) {
  for (const path of [`/${chain}/commerce/ad123`, `/${chain}/post-detail/123?blink=ad123`, `/${chain}/space-detail/123?blink=ad123`, `/${chain}/commerce/ad123?preview=1`]) {
    const stores = [storage(), storage()]
    assert.equal(saveBlinkLoginReturn(path, stores, 1000), true)
    assert.equal(takeBlinkLoginReturn(stores, 2000), path)
    assert.equal(takeBlinkLoginReturn(stores, 2000), null, 'one-shot; no stale navigation on next login')
  }
}
for (const path of ['//evil.test/bsc/commerce/x', 'https://evil.test', '/bsc/callback', '/bsc/commerce/a%2fb', '/bsc/commerce/a\\b', '/bsc/commerce/a/other', 'javascript:alert(1)']) assert.equal(safeBlinkReturn(path), null, path)
assert.equal(safeBlinkReturn('/bsc/post-detail/1?blink=x&privy_oauth_code=secret&returnTo=https://evil.test'), '/bsc/post-detail/1?blink=x')
const expired = [storage()]
saveBlinkLoginReturn('/rh/commerce/test', expired, 0)
assert.equal(takeBlinkLoginReturn(expired, 20 * 60 * 1000 + 1), null)
const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') }, removeItem() {} }
assert.equal(saveBlinkLoginReturn('/bsc/commerce/test', [blocked]), false)
const fallback = storage()
assert.equal(saveBlinkLoginReturn('/bsc/commerce/test', [blocked, fallback], 100), true)
assert.equal(takeBlinkLoginReturn([blocked, fallback], 200), '/bsc/commerce/test')
const cancelled = [storage(), storage()]
saveBlinkLoginReturn('/bsc/commerce/old', cancelled, 100)
clearBlinkLoginReturn(cancelled)
assert.equal(takeBlinkLoginReturn(cancelled, 200), null, 'ordinary login clears both storage copies')
saveBlinkLoginReturn('/bsc/commerce/old', cancelled, 100)
saveBlinkLoginReturn('/rh/commerce/new', cancelled, 150)
assert.equal(takeBlinkLoginReturn(cancelled, 200), '/rh/commerce/new', 'new Blinks attempt replaces old one')
saveBlinkLoginReturn('/bsc/commerce/old', cancelled, 100)
assert.equal(saveBlinkLoginReturn('https://evil.test', cancelled, 150), false)
assert.equal(takeBlinkLoginReturn(cancelled, 200), null, 'invalid new target cannot retain the previous target')
assert.doesNotThrow(() => clearBlinkLoginReturn([blocked]))
for (const file of ['src/components/login/BlinkTwitterLoginButton.vue','src/components/tweets/CommerceBtn.vue','src/views/BlinkLanding.vue','src/views/Callback.vue','src/views/buy-sell/BuyAndSellView.vue']) {
  const source = readFileSync(file, 'utf8')
  assert.ok(compileScript(parse(source).descriptor, { id: file }).content)
}
const callback = readFileSync('src/views/Callback.vue', 'utf8')
assert.doesNotMatch(callback.slice(callback.indexOf('const finish'), callback.indexOf('onMounted(')), /router\.replace/)
const oauth = readFileSync('src/react_app/LoginWithOAuth.jsx', 'utf8')
assert.ok(oauth.indexOf('saveBlinkLoginReturn(returnPath)') < oauth.indexOf('await runNativeBrowserOAuth'))
assert.doesNotMatch(oauth, /sendTransaction|writeContract/)
const layout = readFileSync('src/layout/Layout.vue', 'utf8')
assert.match(layout, /Number\(accInfo.accountType\) === 1\) clearBlinkLoginReturn\(\)/)
console.log('Blinks login return: BSC/RH, one-shot TTL, unsafe URL rejection, blocked storage, callback ownership and Vue compilation passed')
