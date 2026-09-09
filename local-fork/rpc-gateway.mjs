import http from 'node:http'
import {pathToFileURL} from 'node:url'

// Anvil's historical storage reads hold a synchronous upgradable state lock.
// Drain other requests before these reads and never run two of them together.
const exclusive = new Set(['eth_getStorageAt','eth_getBalance','eth_getCode','eth_getTransactionCount','anvil_dumpState','anvil_loadState','evm_revert','evm_snapshot'])
// These read blockchain records without taking the EVM state lock. Receipts
// must remain available even when a slow simulation has opened the circuit.
const control = new Set(['eth_chainId','net_version','web3_clientVersion','eth_blockNumber','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getBlockByHash'])
export function createGateway({target='http://127.0.0.1:18546',timeoutMs=90000,maxConcurrent=8,maxQueued=256,recoverIntervalMs=5000}={}) {
 let active=0,locked=false,fault=null,lastSuccess=null
 let controlActive=0,probing=false,recoveryHead=null
 const controlQueue=[],running=new Map()
 const queue=[]
 const error=(id,code,message)=>({jsonrpc:'2.0',id:id??null,error:{code,message}})
 function drain(){
  while(queue.length&&!locked){
   if(fault){const item=queue.shift();item.resolve(error(item.rpc.id,-32002,'Local fork RPC is recovering. Check receipts before retrying a transaction.'));continue}
   const item=queue[0],solo=exclusive.has(item.rpc.method)
   if(active>=maxConcurrent||(solo&&active))break
   queue.shift();active++;locked=solo
   void forward(item.rpc).then(item.resolve).finally(()=>{active--;if(solo)locked=false;drain()})
  }
 }
 async function forward(rpc,isControl=false){
  const key=Symbol();running.set(key,{method:rpc.method,startedAt:Date.now()})
  try{
   const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rpc),signal:AbortSignal.timeout(isControl?Math.min(timeoutMs,5000):timeoutMs)})
   if(!response.ok)throw new Error('RPC HTTP failure')
   const result=await response.json();lastSuccess=Date.now();return result
  }catch{
   // Aborting HTTP does not cancel execution inside Anvil. Do not retry a write
   // or admit more work into an unhealthy node after an uncertain response.
   if(!isControl)fault=Date.now()
   return error(rpc.id,-32002,'Local fork RPC timed out. Check the transaction receipt before retrying; recovery is being monitored.')
  }finally{running.delete(key)}
 }
 function drainControl(){while(controlQueue.length&&controlActive<4){const item=controlQueue.shift();controlActive++;void forward(item.rpc,true).then(item.resolve).finally(()=>{controlActive--;drainControl()})}}
 function dispatch(rpc){
  if(!rpc||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return Promise.resolve(error(rpc?.id,-32600,'Invalid JSON-RPC request'))
  if(control.has(rpc.method)){
   if(controlQueue.length>=maxQueued)return Promise.resolve(error(rpc.id,-32005,'Local RPC is busy'))
   return new Promise(resolve=>{controlQueue.push({rpc,resolve});drainControl()})
  }
  if(fault)return Promise.resolve(error(rpc.id,-32002,'Local fork RPC is recovering. Check receipts before retrying a transaction.'))
  if(queue.length>=maxQueued)return Promise.resolve(error(rpc.id,-32005,'Local fork RPC is busy; try again later.'))
  return new Promise(resolve=>{queue.push({rpc,resolve});drain()})
 }
 async function recover(){
  if(!fault||active||probing)return
  probing=true
  try{
   const call=async(method,params=[])=>{
    const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:0,method,params}),signal:AbortSignal.timeout(Math.min(timeoutMs,3000))})
    const data=await response.json();if(data.error||data.result===undefined)throw new Error('Probe failed');return data.result
   }
   const head=await call('eth_blockNumber')
   // A responsive chainId alone did not detect the stopped miner in the incident.
   await call('eth_getBalance',['0x0000000000000000000000000000000000000000','latest'])
   if(recoveryHead!==null&&BigInt(head)>BigInt(recoveryHead)){fault=null;lastSuccess=Date.now();recoveryHead=null;console.log('RPC recovered: state reads and block production verified. No transactions replayed.');drain()}
   else recoveryHead=head
  }catch{recoveryHead=null}finally{probing=false}
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS')
  res.setHeader('Content-Type','application/json')
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  if(req.method==='GET'&&req.url==='/health')return res.end(JSON.stringify({ok:!fault,active,controlActive,queued:queue.length,controlQueued:controlQueue.length,fault,lastSuccess,running:[...running.values()].map(x=>({method:x.method,ms:Date.now()-x.startedAt}))}))
  if(req.method!=='POST'){res.statusCode=405;return res.end()}
  try{
   const chunks=[];let size=0
   for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)throw new Error('Request too large');chunks.push(chunk)}
   const rpc=JSON.parse(Buffer.concat(chunks).toString())
   if(Array.isArray(rpc)&&(!rpc.length||rpc.length>256))throw new Error('Invalid batch')
   const result=Array.isArray(rpc)?await Promise.all(rpc.map(dispatch)):await dispatch(rpc)
   res.end(JSON.stringify(result))
  }catch{res.statusCode=400;res.end(JSON.stringify(error(null,-32700,'Invalid RPC payload')))}
 })
 const timer=setInterval(()=>void recover(),recoverIntervalMs);timer.unref();server.on('close',()=>clearInterval(timer))
 return server
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 createGateway().listen(18545,'127.0.0.1',()=>console.log('Local RPC gateway ready on 18545; Anvil backend on 18546.'))
}
