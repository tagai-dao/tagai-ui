import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const code = ts.transpileModule(read('src/utils/androidUpdatePolicy.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { parseAndroidDownload: parse, parseAndroidRelease } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const manifest = JSON.parse(read('public/app-updates/android.json'))
assert.equal(parse(manifest).versionCode, manifest.versionCode)
assert.equal(parseAndroidRelease(manifest, 20), null, 'manual downloads must not enable update prompts')
for (const patch of [
  { downloadEnabled: false }, { downloadEnabled: undefined }, { applicationId: 'other.app' },
  { versionCode: NaN }, { versionCode: -1 }, { versionCode: '22' }, { versionName: '' },
  { downloadUrl: 'https://evil.example/app.apk' }, { downloadUrl: 'https://tagai.fun/index.html' },
  { downloadUrl: 'https://tagai.fun/downloads/app.apk?x=1' },
]) assert.equal(parse({ ...manifest, ...patch }), null)
assert.equal(parse(null), null)
const apk = new URL(`../public${new URL(manifest.downloadUrl).pathname}`, import.meta.url)
assert.equal(createHash('sha256').update(readFileSync(apk)).digest('hex'), manifest.sha256)
assert.ok(statSync(apk).size < 25 * 1024 * 1024, 'APK must fit Pages single-file limit')
const sidebar = read('src/layout/LeftSidebar.vue')
assert.ok(sidebar.indexOf('to="/about"') < sidebar.indexOf('<DownloadAppButton'))
assert.ok(sidebar.indexOf('<DownloadAppButton') < sidebar.indexOf('<!-- 8. More -->'))
const top = read('src/layout/TopBar.vue')
assert.ok(top.indexOf('v-for="l') < top.indexOf('<DownloadAppButton'))
assert.ok(top.indexOf('<DownloadAppButton') < top.indexOf('href="https://coincidence-labs.gitbook.io/tagai/"'))
const { navigationDenylist } = await import('../src/service-worker/precachePolicy.js')
for (const path of ['/downloads/TagAI.apk', '/app-updates/android.json']) {
  assert.ok(navigationDenylist.some(rule => rule.test(path)))
}
console.log('App download policy, artifact integrity, menu placement and SW exclusions passed')
