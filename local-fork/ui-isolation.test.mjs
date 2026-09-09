import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {loadConfigFromFile} from 'vite'

const root=fileURLToPath(new URL('../',import.meta.url))
const loaded=await loadConfigFromFile({command:'serve',mode:'development'},resolve(root,'local-fork/vite.config.ts'),root)
const plugin=loaded.config.plugins.flat(Infinity).find(p=>p?.name==='local-fork-only')
assert.equal(typeof plugin?.transform,'function')
const source=path=>readFile(resolve(root,path),'utf8')

for(const file of [
 'src/components/common/CreateCoinModal.vue',
 'src/views/buy-sell/RecordList.vue',
 'src/views/buy-sell/BuyAndSellView.vue',
 'src/utils/v13/worker.ts',
 'src/utils/v13/math.ts',
 'src/utils/v13/zap.ts',
 'src/utils/v13/liquidity-preview.ts',
]){
 test(`fork leaves production UI / algorithms unchanged: ${file}`,async()=>{
  const code=await source(file)
  assert.equal(plugin.transform(code,resolve(root,file)),undefined)
  assert.equal(plugin.transform(code,resolve(root,file)+'?vue&type=script'),undefined)
 })
}

test('original Logo-required validation is retained',async()=>{
 const code=await source('src/components/common/CreateCoinModal.vue')
 assert.match(code,/if\s*\(!createForm\.logoUrl\s*\|\|\s*createForm\.logoUrl\.length\s*===\s*0\)\s*\{\s*notify\(\{message:\s*'Need upload an image for your tag'\}\)\s*return;/)
})

test('panel supplies a real downloadable PNG, not an automatic form value',async()=>{
 const panel=await source('local-fork/Panel.vue')
 assert.match(panel,/href="\/pwa-192x192\.png" download="tiptag-fork-logo\.png"/)
 const png=await readFile(resolve(root,'public/pwa-192x192.png'))
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
 assert.doesNotMatch(panel,/createForm\.logoUrl\s*=/)
 assert.match(panel,/需要独立验收的功能/)
})

test('upload destination stays local without changing crop / upload behavior',async()=>{
 const file='src/composables/useUploadImg.ts',code=await source(file)
 const transformed=plugin.transform(code,resolve(root,file))
 assert.equal(transformed,code.replace('https://upload.tagai.fun/files/upload','http://127.0.0.1:19900/files/upload'))
 assert.ok(transformed.includes('http://127.0.0.1:19900/files/upload'))
 assert.ok(!transformed.includes('https://upload.tagai.fun/files/upload'))
})
