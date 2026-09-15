import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const policy = await import(`data:text/javascript;base64,${Buffer.from(transpile(read('src/utils/androidUpdatePolicy.ts'))).toString('base64')}`)
const source = read('src/components/common/DownloadAppButton.vue').split('<script setup lang="ts">')[1].split('</script>')[0]
const handler = transpile(source).replace(/^import .*$/gm, '').replace('defineProps();', '')
const manifest = JSON.parse(read('public/app-updates/android.json'))
const calls = [], downloads = [], errors = [], infos = []
let data = manifest, apkType = 'application/vnd.android.package-archive', native = false
let userAgent = 'Android', manifestStatus = 200
const result = new Function('ref', 'Capacitor', 'CapacitorHttp', 'Browser', 'ElMessage', 'parseAndroidDownload', 'navigator', 'fetch', 'document',
  `${handler}\nreturn { download, busy }`)(
  value => ({value}), {isNativePlatform: () => native},
  {get: async () => ({status:200, data})}, {open: async ({url}) => downloads.push(url)},
  {error: v => errors.push(v), info: v => infos.push(v)}, policy.parseAndroidDownload,
  {get userAgent() {return userAgent}, platform:'Linux', maxTouchPoints:1},
  async (url, options) => {
    calls.push({url, options})
    return options.method === 'HEAD'
      ? new Response(null, {headers:{'Content-Type':apkType}})
      : new Response(JSON.stringify(data), {status:manifestStatus})
  },
  {body:{appendChild() {}}, createElement:() => ({href:'', download:'', click() {downloads.push(this.href)}, remove() {}})},
)
await result.download()
assert.equal(downloads[0], new URL(manifest.downloadUrl).pathname)
assert.equal(result.busy.value, false)
assert.equal(calls[0].options.cache, 'no-store')
data = {...manifest, versionCode:manifest.versionCode + 1, downloadUrl:'https://tagai.fun/downloads/next.apk'}
await result.download()
assert.equal(downloads[1], '/downloads/next.apk', 'each click must resolve the latest manifest')
data = {...manifest, downloadEnabled:false}
await result.download()
data = manifest
apkType = 'text/html'
await result.download()
manifestStatus = 503
await result.download()
assert.equal(errors.length, 3)
assert.equal(downloads.length, 2)
assert.equal(result.busy.value, false, 'errors must unlock retry')
native = true
await result.download()
assert.equal(downloads[2], manifest.downloadUrl)
userAgent = 'iPhone'
await result.download()
assert.equal(infos.length, 1)
assert.equal(downloads.length, 3, 'iOS must not download an APK')
console.log('Download handler: fresh manifest, browser/native paths, disabled release, HTML fallback, HTTP failure and iOS passed')
