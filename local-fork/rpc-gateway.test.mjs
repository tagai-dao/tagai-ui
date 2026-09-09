import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {createGateway} from './rpc-gateway.mjs'
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)))
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})
const rpc=(id,method)=>({jsonrpc:'2.0',id,method,params:[]})
const post=async(url,body)=>(await fetch(url,{method:'POST',body:JSON.stringify(body)})).json()
test('storage reads drain concurrent calls and preserve batch ids/results',async()=>{
 let active=0,storage=false,violation=false,max=0
 const backend=http.createServer(async(req,res)=>{
  let body='';for await(const c of req)body+=c;const q=JSON.parse(body)
  if(storage||(q.method==='eth_getStorageAt'&&active))violation=true
  active++;max=Math.max(active,max);if(q.method==='eth_getStorageAt')storage=true
  await new Promise(r=>setTimeout(r,8))
  active--;if(q.method==='eth_getStorageAt')storage=false
  res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:q.id}))
 })
 const target=await listen(backend),gateway=createGateway({target,maxConcurrent:4}),url=await listen(gateway)
 try{
  const batch=Array.from({length:80},(_,i)=>rpc(i,i%5===4?'eth_getStorageAt':'eth_call'))
  const out=await post(url,batch)
  assert.deepEqual(out.map(x=>x.result),batch.map(x=>x.id));assert.equal(violation,false);assert.ok(max>1&&max<=4)
 }finally{await close(gateway);await close(backend)}
})
test('uncertain write times out once, closes circuit, and preserves queued ids',async()=>{
 let calls=0
 const backend=http.createServer(()=>{calls++})
 const target=await listen(backend),gateway=createGateway({target,timeoutMs:50,maxConcurrent:1}),url=await listen(gateway)
 try{
  const out=await post(url,[rpc(11,'eth_sendRawTransaction'),rpc(12,'eth_getStorageAt'),rpc(13,'eth_call')])
  assert.equal(calls,1);assert.deepEqual(out.map(x=>x.id),[11,12,13]);assert.ok(out.every(x=>x.error.code===-32002))
  assert.equal((await post(url,rpc(14,'eth_sendRawTransaction'))).error.code,-32002);assert.equal(calls,1)
  assert.equal((await(await fetch(url+'/health')).json()).ok,false)
 }finally{await close(gateway);await close(backend)}
})
test('contract reverts pass through and do not trip the circuit',async()=>{
 const backend=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;res.end(JSON.stringify({jsonrpc:'2.0',id:JSON.parse(body).id,error:{code:3,message:'execution reverted',data:'0x1234'}}))})
 const target=await listen(backend),gateway=createGateway({target}),url=await listen(gateway)
 try{assert.deepEqual((await post(url,rpc(1,'eth_call'))).error,{code:3,message:'execution reverted',data:'0x1234'});assert.equal((await(await fetch(url+'/health')).json()).ok,true)}finally{await close(gateway);await close(backend)}
})
test('receipts bypass blocked EVM reads; recovery requires advancing blocks and never replays writes',async()=>{
 let healthy=false,advance=false,head=1,writes=0,probes=0
 const backend=http.createServer(async(req,res)=>{
  let body='';for await(const c of req)body+=c;const q=JSON.parse(body)
  if(q.method==='eth_sendRawTransaction'){writes++;return}
  if(q.method==='eth_getBalance'&&!healthy)return
  if(q.method==='eth_blockNumber'){probes++;if(advance)head++}
  res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:q.method==='eth_blockNumber'?'0x'+head.toString(16):q.method==='eth_getTransactionReceipt'?{status:'0x1'}:'0x0'}))
 })
 const target=await listen(backend),gateway=createGateway({target,timeoutMs:60,maxConcurrent:1,recoverIntervalMs:15}),url=await listen(gateway)
 try{
  const pending=post(url,rpc(1,'eth_sendRawTransaction'))
  assert.equal((await post(url,rpc(2,'eth_getTransactionReceipt'))).result.status,'0x1')
  assert.equal((await pending).error.code,-32002);healthy=true
  const deadline=Date.now()+1000;while(probes<3&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10))
  assert.equal((await(await fetch(url+'/health')).json()).ok,false,'chainId/balance alone must not reopen a stalled miner')
  advance=true;let ok=false
  while(Date.now()<deadline){ok=(await(await fetch(url+'/health')).json()).ok;if(ok)break;await new Promise(r=>setTimeout(r,10))}
  assert.ok(ok);assert.equal(writes,1);assert.equal((await post(url,rpc(3,'eth_call'))).result,'0x0')
 }finally{await close(gateway);await close(backend)}
})
