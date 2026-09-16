import assert from 'node:assert/strict'
import {build} from 'esbuild'
const built=await build({entryPoints:['src/utils/blinkAttribution.ts','src/utils/tradeSellsman.ts'],outdir:'out',bundle:true,write:false,platform:'node',format:'esm'})
const load=async name=>import(`data:text/javascript;base64,${Buffer.from(built.outputFiles.find(f=>f.path.endsWith(name+'.js')).text).toString('base64')}`)
const {verifiedBlink,blinkIdFromRoute,blinkMatchesTrade}=await load('blinkAttribution')
const {resolveTradeSellsman,DEFAULT_TRADE_SELLSMAN}=await load('tradeSellsman')
const author='0x1111111111111111111111111111111111111111',token='0x2222222222222222222222222222222222222222'
for(const chainId of [56,4663]) {
  const source={commerceId:'abc123',chainId,token,tick:'BUIDL',publisher:{twitterId:'author',address:author}}
  assert.equal(verifiedBlink(source,'abc123',chainId),source)
  assert.equal(blinkMatchesTrade(source,token,chainId),true)
  assert.equal(blinkMatchesTrade(source,author,chainId),false)
  assert.equal(blinkMatchesTrade(source,token,chainId===56?4663:56),false)
  for(const patch of [{commerceId:'other'},{chainId:0},{publisher:null},{publisher:{twitterId:'author',address:'bad'}},{token:null}]) assert.throws(()=>verifiedBlink({...source,...patch},'abc123',chainId))
  assert.equal(await resolveTradeSellsman(chainId,source.publisher.address,async()=>true),author)
  assert.equal(await resolveTradeSellsman(chainId,source.publisher.address,async a=>a===DEFAULT_TRADE_SELLSMAN[chainId]),DEFAULT_TRADE_SELLSMAN[chainId])
  await assert.rejects(resolveTradeSellsman(chainId,author,async()=>{throw new Error('RPC unavailable')}),/RPC unavailable/)
  await assert.rejects(resolveTradeSellsman(chainId,null,async()=>false),/unavailable/)
}
assert.equal(blinkIdFromRoute({name:'commerce',params:{commerceid:'abc123'},query:{sellsman:'attacker'}}),'abc123')
assert.equal(blinkIdFromRoute({name:'tag-detail',params:{},query:{blink:'abc123'}}),'abc123')
assert.equal(blinkIdFromRoute({name:'home',params:{},query:{blink:'abc123'}}),null)
assert.equal(blinkIdFromRoute({name:'tag-detail',params:{},query:{}}),null)
assert.throws(()=>blinkIdFromRoute({name:'tag-detail',params:{},query:{blink:['x','y']}}))
console.log('Blinks attribution: both chains, authoritative source validation, scope isolation and fail-closed IPShare fallback passed')
