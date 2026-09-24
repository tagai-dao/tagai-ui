import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'trade-cards-ui-'))
await build({entryPoints:['src/utils/tradeCurationCards.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'module.cjs'),logLevel:'silent',plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/(apis\/axios|config)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const BACKEND_API_URL='https://api.example';export const post=(...a)=>globalThis.__cardsPost(...a);export const get=(...a)=>globalThis.__cardsGet(...a);`,loader:'js'}))
}}]})
const api=createRequire(import.meta.url)(join(dir,'module.cjs'))
const token='0x'+'11'.repeat(20)
after(async()=>{delete globalThis.__cardsPost;delete globalThis.__cardsGet;await rm(dir,{recursive:true,force:true})})
test('70 visible cards use bounded batches, deduplicate identical cards and cache amounts as strings',async()=>{
 const calls=[]
 const max=(2n**256n-1n).toString()
 globalThis.__cardsPost=async(url,body,config)=>{calls.push({body,config});return {c:0,d:body.cards.map(c=>({...c,amountRaw:max,amount:'99999999999999999999999999.1'}))}}
 const requests=Array.from({length:70},(_,i)=>api.getTradeCardReward({token,tweetId:'post'+i}))
 requests.push(api.getTradeCardReward({token,tweetId:'post0'}))
 const values=await Promise.all(requests)
 assert.equal(calls.length,2);assert.equal(calls[0].body.cards.length,50);assert.equal(calls[1].body.cards.length,20)
 assert.equal(values[0].amountRaw,max);assert.deepEqual(values[0],values[70])
 await api.getTradeCardReward({token,tweetId:'post0'});assert.equal(calls.length,2)
 assert.equal(calls[0].config.headers['X-Chain-Id'],'56')
})
test('unsupported cards return null; errors are not cached as zero and can be retried',async()=>{
 globalThis.__cardsPost=async()=>({c:0,d:[]})
 assert.equal(await api.getTradeCardReward({token,tweetId:'no-pool'}),null)
 globalThis.__cardsPost=async()=>{throw Error('offline')}
 await assert.rejects(api.getTradeCardReward({token,tweetId:'retry'}),/offline/)
 globalThis.__cardsPost=async()=>({c:0,d:[{token,tweetId:'retry',amount:'10'}]})
 assert.equal((await api.getTradeCardReward({token,tweetId:'retry'})).amount,'10')
})

test('record pages use the current source and cursor, preserve raw amounts, and surface failures',async()=>{
 const calls=[]
 globalThis.__cardsGet=async(...args)=>{calls.push(args);return {c:0,d:{summary:{token,tweetId:'card'},records:[{rewardAmountRaw:'123456789012345678901234567890'}],nextCursor:'buyer-30'}}}
 const page=await api.getTradeCurationRecords({token,tweetId:'card'},'buyer-1')
 assert.equal(page.records[0].rewardAmountRaw,'123456789012345678901234567890')
 assert.deepEqual(calls[0][1],{token,tweetId:'card',cursor:'buyer-1',size:30})
 assert.equal(calls[0][2].headers['X-Chain-Id'],'56')
 globalThis.__cardsGet=async()=>({c:1,error:'SOURCE_NOT_READY'})
 await assert.rejects(api.getTradeCurationRecords({token,tweetId:'card'}),/SOURCE_NOT_READY/)
})
