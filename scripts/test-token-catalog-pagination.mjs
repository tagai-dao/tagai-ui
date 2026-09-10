import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
const source = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
const body = source.slice(source.indexOf('async function loadMore()'), source.indexOf('async function getSpaces()'))
const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function fixture(chainId, type, fetcher) {
  const ctx = {
    listType: {value:type}, loading:{value:false}, refreshing:{value:false}, loadFailed:{value:false},
    finished:{[type]:false}, cursors:new Map([[type,{page:1,catalogId:'frozen'}]]), listRefreshSequence:1,
    chainStore:{activeChainId:chainId}, tagCoinSource:{value:'launch'},
    catalogSort: value=>value, coinListKey:value=>value,
    comStore:{[type]:[{tick:'A',token:'0xa'}]},
    getTokenCatalogPage:fetcher, mergeCoins:(a,b)=>[...new Map([...a,...b].map(r=>[r.token,r])).values()],
    saveCoinListSnapshot:()=>{}, getTokenInfo:async rows=>rows, handleErrorTip:()=>{},
  }
  return {ctx, load:new Function(...Object.keys(ctx), `${js}; return loadMore`)(...Object.values(ctx))}
}
for(const chain of [56,4663]) for(const type of ['new','trending','marketCap']) {
  test(`${chain}/${type}: next page and completion come from catalog, not rendered count`,async()=>{
    let args
    const f=fixture(chain,type,async(...a)=>{args=a;return {rows:[{tick:'B',token:'0xb'}],catalogId:'frozen',nextPage:2,hasMore:true}})
    await f.load()
    assert.deepEqual(args,[type,'launch',1,'frozen'])
    assert.equal(f.ctx.finished[type],false)
    assert.equal(f.ctx.cursors.get(type).page,2)
    assert.equal(f.ctx.comStore[type].length,2)
  })
}
test('late results from a previous chain/source do not modify the current list',async()=>{
  let done
  const f=fixture(56,'new',()=>new Promise(resolve=>{done=resolve}))
  const pending=f.load()
  f.ctx.chainStore.activeChainId=4663
  f.ctx.tagCoinSource.value='import'
  done({rows:[{tick:'wrong',token:'0xb'}],catalogId:'old',nextPage:2,hasMore:false})
  await pending
  assert.equal(f.ctx.comStore.new.length,1)
  assert.equal(f.ctx.finished.new,false)
})
test('failed fetches retain the cursor for retry',async()=>{
  const f=fixture(56,'new',async()=>{throw Error('offline')})
  await f.load()
  assert.equal(f.ctx.cursors.get('new').page,1)
  assert.equal(f.ctx.loadFailed.value,true)
})
test('ticker has independent data and filtered short pages trigger viewport checks',()=>{
  const ticker=source.slice(source.indexOf('async function getNewCommunities()'),source.indexOf('async function loadBStocks'))
  assert.ok(!ticker.includes('comStore.newCommunities'))
  assert.match(ticker,/recentCommunities.value/)
  assert.match(source,/coinListRef.value\?\.check\(\)/)
  assert.match(source,/!cursors.has\(listType.value\)/)
  assert.ok(!source.includes('showAvailableSiblingRanking'))
})
test('HomeView compiles',()=>{
  const {descriptor,errors}=parse(source,{filename:'HomeView.vue'})
  assert.deepEqual(errors,[])
  const script=compileScript(descriptor,{id:'catalog'})
  assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'HomeView.vue',id:'catalog',compilerOptions:{bindingMetadata:script.bindings}}).errors,[])
})
