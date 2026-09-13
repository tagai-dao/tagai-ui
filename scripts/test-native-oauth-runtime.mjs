import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'

const built = await build({
  entryPoints: ['src/utils/native.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{name: 'native-fixtures', setup(build) {
    build.onResolve({filter: /^@capacitor\//}, args => ({path: args.path, namespace: 'fixture'}))
    build.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({loader: 'js', contents: {
      '@capacitor/core': `export const Capacitor = {isNativePlatform: () => globalThis.fixture.platform !== 'web', getPlatform: () => globalThis.fixture.platform};
        export const registerPlugin = () => ({prepare: async () => globalThis.fixture.events.push('prepare'), cancel: async () => globalThis.fixture.events.push('cancel')});`,
      '@capacitor/app': `export const App = {
        addListener: async (name, fn) => {globalThis.fixture.listeners[name] = fn; if (name === 'appUrlOpen' && globalThis.fixture.retained) fn({url:globalThis.fixture.retained}); return {remove(){}};},
        getLaunchUrl: async () => ({url:globalThis.fixture.launch}), minimizeApp: async () => {}};`,
      '@capacitor/browser': `export const Browser = {close: async () => globalThis.fixture.events.push('close')};`,
      '@capacitor/splash-screen': `export const SplashScreen = {hide: async () => globalThis.fixture.events.push('hide')};`,
    }[args.path]}))
  }}],
})
const {initNativeApp, runNativeBrowserOAuth} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
const callback = 'https://tagai.fun/native-oauth-redirect?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=twitter'
function reset(platform = 'android') {
  const fixture = globalThis.fixture = {platform, events:[], listeners:{}}
  globalThis.document = {documentElement:{classList:{add(){}}}}
  globalThis.window = {location: {origin:'https://tagai.fun',replace: value => fixture.events.push(['reload', value])}}
  return fixture
}
const router = () => ({replace:async path => fixture.events.push(['route',path]), options:{history:{state:{}}}})
test('web OAuth does not arm native interception or change its redirect', async () => {
  const f=reset('web'); await runNativeBrowserOAuth(async () => f.events.push('sdk'))
  await initNativeApp(router()); assert.deepEqual(f.events,['sdk'])
})
test('Android arms interception before SDK init, keeping successful navigation armed', async () => {
  const f=reset(); await runNativeBrowserOAuth(async () => f.events.push('sdk-pkce'))
  assert.deepEqual(f.events,['prepare','sdk-pkce'])
})
test('SDK init failure cancels native interception and preserves the error', async () => {
  const f=reset(); const error=new Error('SDK init failed')
  await assert.rejects(runNativeBrowserOAuth(async () => {throw error}), value => value === error)
  assert.deepEqual(f.events,['prepare','cancel'])
})
test('cold retained event plus launch URL is consumed once before initialization completes', async () => {
  const f=reset(); f.launch=callback; f.retained=callback
  await initNativeApp(router())
  assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='route').length,1)
  assert.equal(f.events.some(e=>Array.isArray(e)&&e[0]==='reload'),false)
  assert.equal(f.events.at(-1),'hide')
})
test('warm return reloads the local SDK callback, not a browser login page', async () => {
  const f=reset(); await initNativeApp(router())
  await f.listeners.appUrlOpen({url:'https://evil.example/'+callback})
  assert.equal(f.events.some(Array.isArray),false)
  await f.listeners.appUrlOpen({url:callback})
  await f.listeners.appUrlOpen({url:callback})
  const reloads=f.events.filter(e=>Array.isArray(e)&&e[0]==='reload')
  assert.equal(reloads.length,1)
  assert.match(reloads[0][1], /^https:\/\/tagai.fun\/callback\?privy_oauth_code=c/)
})
