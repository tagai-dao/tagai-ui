import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { isAddress, zeroAddress } from 'viem'
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { resolveTradeTick } = await import(`data:text/javascript;base64,${Buffer.from(transpile(readFileSync('src/utils/tradeScope.ts','utf8'))).toString('base64')}`)
const view = readFileSync('src/views/buy-sell/BuyAndSellView.vue','utf8')
// Run the real loader and watcher, retaining Vue's asynchronous watch scheduling.
const loader = transpile(view.slice(view.indexOf('let disposed = false'), view.indexOf('onUnmounted(() => {\n  disposed = true')))
const token = '0x935fb3d106c259840d4abe96351867fb63123333'
const metadata = {tick:'Starship',token,version:14}
const deferred = () => {let resolve; const promise=new Promise(r=>resolve=r); return {promise,resolve}}
const flush = async () => {for(let i=0;i<12;i++) await nextTick()}
function fixture({tick=null,name='tag-detail',detail=async()=>({...metadata}),info=async rows=>rows}={}) {
  const calls=[],errors=[],listings=[]
  const props=reactive({tick,sellsman:null}), route=reactive({name,params:{id:name==='post-detail'?'2104449691908018469':'Starship'}})
  const chainStore=reactive({activeChainId:56}),comStore=reactive({currentSelectedCommunity:null})
  const env={props,route,chainStore,comStore,computed,resolveTradeTick,isAddress,zeroAddress,nextTick,stateStore:{},
    getCommunityDetail:async(...args)=>{calls.push(args);return detail(...args)},getTokenInfo:info,
    readTradeListing:async c=>{listings.push(c);return false},updateUserTokenInfo:()=>{},refreshV13Quote:()=>{},
    handleErrorTip:e=>errors.push(e),updateBuyAmount:{cancel(){}},updateSellAmount:{cancel(){}},
    v13Session:{reset(){}}}
  for(const name of ['tradeReady','tradeLoadError','receiveAmount','receiveEth','calculating','tokenBalance','tokenOriginalBalance','ethBalance','listed','v13Quote','curveQuote','v13Error']) env[name]=ref()
  let stop
  env.watch=(...args)=>{stop=watch(...args)}
  const load=new Function(...Object.keys(env),`let buyQuoteSeq=0,sellQuoteSeq=0,willListing=false;${loader};return loadTradeCommunity`)(...Object.values(env))
  return {...env,calls,errors,listings,load,stop:()=>stop()}
}
test('only token routes interpret route IDs as tickers; embedded sheets retain explicit tokens',()=>{
  for(const name of ['post-detail','space-detail','profile','feed',undefined]) {
    assert.equal(resolveTradeTick(null,{name,params:{id:'2104449691908018469'}}),null)
    assert.equal(resolveTradeTick('Starship',{name,params:{id:'2104449691908018469'}}),'Starship')
  }
  for(const name of ['tag-detail','buy-sell']) assert.equal(resolveTradeTick(null,{name,params:{id:'Starship'}}),'Starship')
  assert.equal(resolveTradeTick(null,{name:'tag-detail',params:{id:[]}}),null)
})
test('cached community -> post makes no token request and preserves the post community',async()=>{
  const f=fixture();try {
    await flush();assert.equal(f.tradeReady.value,true)
    f.route.name='post-detail';f.route.params.id='2104449691908018469'
    const postCommunity={tick:'post-community'};f.comStore.currentSelectedCommunity=postCommunity
    await flush();assert.equal(f.calls.length,1);assert.equal(f.tradeReady.value,false)
    assert.deepEqual(f.comStore.currentSelectedCommunity,postCommunity);assert.equal(f.errors.length,0)
    f.route.name='tag-detail';f.route.params.id='Starship';await flush()
    assert.equal(f.calls.length,2);assert.equal(f.tradeReady.value,true)
  }finally{f.stop()}
})
test('leaving during metadata fetch discards stale success or failure before touching contract/state',async()=>{
  for(const fail of [false,true]) {
    const d=deferred(),f=fixture({detail:async()=>{await d.promise;if(fail)throw Error('offline');return metadata}})
    try {
      f.route.name='post-detail';const current={tick:'post-community'};f.comStore.currentSelectedCommunity=current
      d.resolve();await flush()
      assert.equal(f.calls.length,1);assert.equal(f.listings.length,0);assert.equal(f.errors.length,0)
      assert.deepEqual(f.comStore.currentSelectedCommunity,current)
    }finally{f.stop()}
  }
})
test('leaving during on-chain enrichment does not publish stale listing or balances',async()=>{
  const d=deferred(),f=fixture({info:async rows=>{await d.promise;return rows}})
  try {
    await flush();f.route.name='post-detail';await flush()
    const current={tick:'post-community'};f.comStore.currentSelectedCommunity=current
    d.resolve();await flush();assert.equal(f.listings.length,0);assert.deepEqual(f.comStore.currentSelectedCommunity,current)
  }finally{f.stop()}
})
test('invalid API metadata cannot issue a Token1 read without an address',async()=>{
  for(const value of [null,{}, {token:''},{token:zeroAddress},{token:'broken'}]) {
    const f=fixture({detail:async()=>value});try {
      await flush();assert.equal(f.listings.length,0);assert.equal(f.tradeReady.value,false)
      assert.match(f.errors[0].message,/Token is unavailable/)
    }finally{f.stop()}
  }
})
test('explicit post trade sheets and both-chain token routes still load normally',async()=>{
  const f=fixture({name:'post-detail',tick:'Starship'});try {
    await flush();assert.equal(f.tradeReady.value,true);assert.deepEqual(f.calls,[['Starship',56]])
    f.chainStore.activeChainId=4663;await flush();assert.equal(f.tradeReady.value,true)
    assert.deepEqual(f.calls[1],['Starship',4663])
  }finally{f.stop()}
})
