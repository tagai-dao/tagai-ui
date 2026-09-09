import {spawn} from 'node:child_process'
import {readFile,mkdir,open,writeFile,copyFile,rename,stat} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {parse} from 'dotenv'
import {setTimeout as delay} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'
process.chdir(fileURLToPath(new URL('../',import.meta.url)))
let env={};try{env=parse(await readFile('../TagAI-contract-V2/.env'))}catch{}
const rpc=process.env.BSC_RPC_URL||env.BSC_RPC_URL
if(!rpc)throw new Error('Set BSC_RPC_URL or the contract project .env BSC_RPC_URL (read-only source)')
await mkdir('.local-fork',{recursive:true})
// Never attach admin operations to another process using one of our endpoints.
for(const port of [18545,18546,19900,15173]){
 const {default:net}=await import('node:net');await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error(`Port ${port} is occupied`)));s.listen(port,'127.0.0.1',()=>s.close(resolve))})
}
const fresh=process.argv.includes('--fresh')
let saved,resumeTimestamp
try{saved=JSON.parse(await readFile('.local-fork/checkpoint.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
if(fresh){
 const archive='.local-fork/archive-'+Date.now();await mkdir(archive,{mode:0o700})
 for(const name of ['checkpoint.json','state.json','anvil.log','api.log','vite.log','rpc.log']){
  try{await copyFile('.local-fork/'+name,archive+'/'+name)}catch(e){if(e.code!=='ENOENT')throw e}
 }
 if(saved)await rename('.local-fork/checkpoint.json',archive+'/previous-checkpoint.json')
 saved=undefined
}else if(!saved){
 try{
  const previous=JSON.parse(await readFile('.local-fork/state.json','utf8'))
  if(previous.communities?.length)throw new Error('Existing communities have no chain checkpoint. Use --fresh explicitly to archive them and start a new fork.')
 }catch(e){if(e.code!=='ENOENT')throw e}
}
const args=['--host','127.0.0.1','--port','18546','--chain-id','560013','--fork-url',rpc,'--hardfork','cancun','--block-time','2','--gas-limit','60000000','--timeout','15000','--retries','2','--threads','8','--silent']
if(saved){
 if(saved.version!==1||!/^0x[0-9a-f]+$/i.test(saved.chain)||!Number.isSafeInteger(saved.api?.forkBlock))throw new Error('Invalid checkpoint; refusing to discard it')
 const raw=Buffer.from(saved.chain.slice(2),'hex')
 const decoded=raw[0]===0x1f&&raw[1]===0x8b?gunzipSync(raw):raw
 const restored=JSON.parse(decoded.toString())
 resumeTimestamp=Number(BigInt(restored.block.timestamp))
 if(!Number.isSafeInteger(resumeTimestamp))throw new Error('Invalid checkpoint timestamp')
 await writeFile('.local-fork/resume-state.json',decoded,{mode:0o600})
 args.push('--fork-block-number',String(saved.api.forkBlock),'--load-state','.local-fork/resume-state.json')
 console.log('Restoring local fork checkpoint from '+new Date(saved.savedAt).toLocaleString())
}
const children=[]
let stopping=false,apiReady=false
async function stop(code=0){
 if(stopping)return;stopping=true
 if(apiReady){try{await fetch('http://127.0.0.1:19900/__fork/checkpoint',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)})}catch{}}
 for(const child of children)child.kill('SIGTERM')
 await delay(1500)
 for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL')
 process.exit(code)
}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop())
async function run(binary,argv,name,childEnv={}){
 const log=await open(`.local-fork/${name}.log`,'w',0o600)
 const child=spawn(binary,argv,{stdio:['ignore',log.fd,log.fd],env:{...process.env,...childEnv}});children.push(child);await log.close()
 child.on('error',()=>{console.error(`${name} failed to start; inspect local log`);void stop(1)})
 child.on('exit',code=>{if(!stopping){console.error(`${name} stopped (${code}); see .local-fork/${name}.log`);void stop(code||1)}})
}
async function waitReady(url,init={},seconds=120){
 const deadline=Date.now()+seconds*1000
 while(Date.now()<deadline&&!stopping){try{const response=await fetch(url,{...init,signal:AbortSignal.timeout(4000)});if(response.ok){const data=url.endsWith('/bsc')?null:await response.json();if(!data?.error)return}}catch{}await delay(1000)}
 throw new Error('Local service did not become ready: '+url)
}
try{
 await run('anvil',args,'anvil')
 await waitReady('http://127.0.0.1:18546',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})})
 if(saved){
  // Anvil restores block state but its mining clock can still start at the fork time.
  // Advance the clock before API snapshots and automatic mining read restored contracts.
  const rpcCall=async(method,params)=>{
   const r=await fetch('http://127.0.0.1:18546',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)}).then(r=>r.json())
   if(r.error)throw new Error('Failed to restore local chain clock: '+r.error.message)
   return r.result
  }
  const head=await rpcCall('eth_getBlockByNumber',['latest',false])
  await rpcCall('evm_setNextBlockTimestamp',[Math.max(resumeTimestamp,Number(BigInt(head.timestamp)))+1])
  await rpcCall('evm_mine',[])
 }
 await run(process.execPath,['local-fork/rpc-gateway.mjs'],'rpc')
 await waitReady('http://127.0.0.1:18545/health')
 await run(process.execPath,['local-fork/server.mjs'],'api',{LOCAL_FORK_RESUME:saved?'1':'0'})
 await waitReady('http://127.0.0.1:19900/__fork/status',{},240);apiReady=true
 await run(process.execPath,['node_modules/vite/bin/vite.js','--config','local-fork/vite.config.ts'],'vite')
 await waitReady('http://127.0.0.1:15173/bsc',{},60)
 console.log('Local fork ready: http://127.0.0.1:15173/bsc\nRPC: localhost:18545. Checkpoint every 30 seconds while idle; normal restart restores it. Use --fresh for a new fork. Ctrl+C saves and stops local services.')
 let checking=false,warned=false,lastHead=null,lastProgress=Date.now()
 setInterval(async()=>{
  if(checking||stopping)return;checking=true
  try{
   const response=await fetch('http://127.0.0.1:18546',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}',signal:AbortSignal.timeout(5000)})
   const data=await response.json();if(!data.result)throw new Error('Unavailable')
   if(data.result!==lastHead){lastHead=data.result;lastProgress=Date.now()}
   if(Date.now()-lastProgress>30000)throw new Error('Block production stalled')
   warned=false
  }catch{if(!warned){console.error('Local RPC health check failed. No automatic reset or transaction retry; checkpoint retained.');warned=true}}
  finally{checking=false}
 },15000).unref()
}catch(e){console.error(e.message);await stop(1)}
