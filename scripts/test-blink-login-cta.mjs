import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { parse, compileTemplate } from '@vue/compiler-sfc'

const built = await build({
  entryPoints: ['src/composables/useBlinkLoginPrompt.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{name:'cta-fixtures',setup(build) {
    const fixtures = {
      vue: 'export const computed = fn => ({get value(){return fn()}});',
      '@capacitor/core': 'export const Capacitor = {isNativePlatform:()=>globalThis.cta.native};',
      '@/stores/web3': 'export const useAccountStore = () => globalThis.cta.account;',
    }
    build.onResolve({filter:/.*/}, args => Object.hasOwn(fixtures,args.path) ? {path:args.path,namespace:'fixture'} : undefined)
    build.onLoad({filter:/.*/,namespace:'fixture'}, args => ({contents:fixtures[args.path],loader:'js'}))
  }}],
})
const {useBlinkLoginPrompt} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
for (const native of [false,true]) {
  globalThis.cta = {native,account:{getAccountInfo:null}}
  const show = useBlinkLoginPrompt()
  assert.equal(show.value,!native,'only anonymous web visitors see login CTA')
  cta.account.getAccountInfo = {twitterId:'123'}
  assert.equal(show.value,false,'login reactively restores Trade without remount')
  cta.account.getAccountInfo = null
  assert.equal(show.value,!native,'logout restores web CTA, never changes native flow')
}
for (const file of ['src/components/tweets/CommerceBtn.vue','src/views/BlinkLanding.vue','src/views/buy-sell/BuyAndSellView.vue']) {
  const source = readFileSync(file,'utf8')
  const {descriptor} = parse(source)
  const compiled = compileTemplate({source:descriptor.template.content,filename:file,id:file})
  assert.deepEqual(compiled.errors,[])
  assert.match(descriptor.template.content, /<BlinkTwitterLoginButton\s+v-if="[^"]*showBlinkLogin"[^>]*\/>\s*<button v-else/,
    `${file}: auth and trade/connect must be exclusive branches`)
}
const dialog = readFileSync('src/views/buy-sell/BuyAndSellView.vue','utf8')
assert.match(dialog, /v-if="!isWalletConnected && blinkLoginPath && showBlinkLogin"/,
  'ordinary trades and connected wallets must retain their existing action')
const ctaSource = readFileSync('src/components/login/BlinkTwitterLoginButton.vue','utf8')
assert.ok(ctaSource.includes('twitter 授权登录 & 交易'))
assert.ok(ctaSource.includes('授权登录 & 交易'))
console.log('Blinks single CTA: anonymous/logged-in web, native, reactive login/logout, exclusive template branches and labels passed')
