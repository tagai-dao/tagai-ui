import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
const built = await build({entryPoints:['src/utils/nativeContentLinks.ts'],bundle:true,write:false,platform:'node',format:'esm'})
const {nativeContentPath:parse,androidContentIntent:intent} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
for (const prefix of ['', '/bsc', '/rh']) {
  for (const route of ['/commerce/abc123','/tag-detail/%E7%89%9B%E6%9D%A5/referral','/buy-sell/BUIDL','/post-detail/123','/space-detail/123','/user/TipTagAi']) {
    const path=prefix+route+'?tab=trade&referee=test#content'
    const url='https://tagai.fun'+path
    assert.equal(parse(url),path)
    assert.equal(parse('tagai://open?url='+encodeURIComponent(url)),path)
    assert.ok(intent(url).includes(';package=fun.tagai.app;'))
  }
}
for (const url of [
  'https://evil.example/bsc/commerce/123','http://tagai.fun/bsc/commerce/123',
  'https://user@tagai.fun/bsc/commerce/123','https://tagai.fun/downloads/app.apk',
  'https://tagai.fun/callback?privy_oauth_code=c','https://tagai.fun/bsc/login',
  'https://tagai.fun/bsc/tag-detail/a%2fb','https://tagai.fun/bsc/tag-detail/%00',
  'https://tagai.fun/bsc/tag-detail/BUIDL?access_token=secret',
  'tagai://open?url=https://evil.example/bsc/commerce/123',
  'tagai://open?url=https://tagai.fun/bsc/commerce/123&url=https://tagai.fun/bsc/commerce/456',
  'javascript:alert(1)','tagai://auth-callback?privy_oauth_code=x',
]) { assert.equal(parse(url),null,url);assert.equal(intent(url),null,url) }
const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8')
for (const prefix of ['', '/bsc', '/rh']) {
  for (const route of ['/commerce/','/tag-detail/','/buy-sell/','/post-detail/','/space-detail/','/user/']) {
    assert.ok(manifest.includes(`android:pathPrefix="${prefix}${route}"`))
  }
}
assert.doesNotMatch(readFileSync('src/react_app/AuthLoading.jsx','utf8'),/useSignMessage|wallet smoke|walletSmoke/)
console.log('Content links: BSC/RH/legacy routes, intent round-trip, unsafe URL rejection and release smoke regression passed')
