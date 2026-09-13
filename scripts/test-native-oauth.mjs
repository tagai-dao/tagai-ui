import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const js = ts.transpileModule(read('src/utils/nativeOAuthCallback.ts'), {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
}).outputText
const {nativeOAuthCallbackPath: parse, NATIVE_OAUTH_REDIRECT_URL} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const query = '?privy_oauth_code=code%2B%2F%3D&privy_oauth_state=state&privy_oauth_provider=twitter'
test('HTTPS, host-canonicalized, and legacy callbacks preserve encoded OAuth values', () => {
  for (const base of [NATIVE_OAUTH_REDIRECT_URL, NATIVE_OAUTH_REDIRECT_URL + '.html', 'tagai://auth-callback']) {
    const path = parse(base + query + '&redirect=https://evil.example&access_token=secret#bad')
    const url = new URL(path, 'https://tagai.fun')
    assert.equal(url.pathname, '/callback')
    assert.equal(url.searchParams.get('privy_oauth_code'), 'code+/=')
    assert.equal(url.searchParams.get('privy_oauth_state'), 'state')
    assert.equal(url.searchParams.size, 3)
    assert.equal(url.hash, '')
  }
})
test('untrusted, incomplete, ambiguous, or non-OAuth deep links are ignored', () => {
  for (const value of [
    'https://evil.example/native-oauth-redirect' + query,
    'https://tagai.fun.evil.example/native-oauth-redirect' + query,
    'https://tagai.fun/bsc' + query, 'http://tagai.fun/native-oauth-redirect' + query,
    'https://user@tagai.fun/native-oauth-redirect' + query,
    'tagai://auth-callback/other' + query, 'tagai://other' + query,
    NATIVE_OAUTH_REDIRECT_URL, NATIVE_OAUTH_REDIRECT_URL + query + '&privy_oauth_state=other',
    NATIVE_OAUTH_REDIRECT_URL + query.replace('provider=twitter', 'provider=google'),
    NATIVE_OAUTH_REDIRECT_URL + '?privy_oauth_code=c&privy_oauth_provider=twitter',
  ]) assert.equal(parse(value), null, value)
})
test('an error without a code cannot enter a callback the installed SDK cannot consume', () => {
  assert.equal(parse(NATIVE_OAUTH_REDIRECT_URL + '?privy_oauth_error=access_denied&privy_oauth_state=s&privy_oauth_provider=twitter'), null)
})
test('browser fallback is package-bound, user initiated and never authenticates in Chrome', () => {
  const html = read('public/native-oauth-redirect.html')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const nodes = {open: {hidden: true}, tip: {}}
  const context = search => ({window: {location: {search}}, URLSearchParams,
    navigator: {userAgent: 'Android'}, document: {getElementById: id => nodes[id]}})
  runInNewContext(script, context(query + '&access_token=secret'))
  assert.equal(nodes.open.hidden, false)
  assert.match(nodes.open.href, /^intent:\/\/auth-callback\?/)
  assert.match(nodes.open.href, /;package=fun.tagai.app;end$/)
  assert.doesNotMatch(nodes.open.href, /secret|access_token/)
  nodes.open.hidden = true
  runInNewContext(script, context(''))
  assert.equal(nodes.open.hidden, true)
  assert.doesNotMatch(script, /localStorage|sessionStorage|fetch\(|location\.(assign|replace)/)
})
test('native navigation uses a plugin, listener precedes mount, and return is not timed out into home', () => {
  const native = read('src/utils/native.ts')
  assert.doesNotMatch(native, /locationPrototype|Object.getPrototypeOf/)
  assert.match(native, /await NativeOAuth.prepare\(\)/)
  assert.match(native, /Capacitor.getPlatform\(\) !== 'android'/)
  assert.match(native, /await router.replace\(path\)/)
  assert.match(read('src/main.ts'), /initNativeApp\(router\)[\s\S]*?finally\(\(\) => app.mount/)
  assert.doesNotMatch(read('src/views/Callback.vue'), /setTimeout\(finish,/)
  const manifest = read('android/app/src/main/AndroidManifest.xml')
  assert.match(manifest, /android:autoVerify="true"/)
  assert.match(manifest, /android:path="\/native-oauth-redirect"/)
  assert.doesNotMatch(manifest, /android:pathPrefix="\/"/)
  const association = JSON.parse(read('public/.well-known/assetlinks.json'))[0]
  assert.equal(association.target.package_name, 'fun.tagai.app')
  assert.equal(association.target.sha256_cert_fingerprints[0], 'C8:D6:78:B7:68:F8:F3:49:AE:AD:14:4B:83:77:69:F4:0E:CF:1E:8C:40:42:08:9D:21:E1:93:0A:C1:4A:17:DC')
})
