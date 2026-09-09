import {test,beforeEach,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-zap-quote-'))
await build({entryPoints:['src/utils/v13/zap.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'quote.cjs'),define:{'import.meta.url':JSON.stringify('file:///test/zap.ts')},logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^@\/config\/chains$/},()=>({path:join(process.cwd(),'src/config/chains.ts')}))
 b.onResolve({filter:/^(@\/apis\/axios|@\/config\/api|@\/utils\/wallets|\.\/snapshot|\.\/pools)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export const API_BASE_URL='http://test';export const get=(...args)=>globalThis.__zap.get(...args);
 export const getReadOnlyClient=()=>globalThis.__zap.client;
 export const loadSnapshot=(...args)=>globalThis.__zap.snapshot(...args);
 export const send=()=>{};export const walletGuard=()=>({});export const validateLiquidityRouter=()=>{};`}))
}}]})
const {quoteZap}=createRequire(import.meta.url)(join(dir,'quote.cjs'))
const token='0x1111111111111111111111111111111111111111'
const deferred=()=>{let resolve;return{promise:new Promise(r=>{resolve=r}),resolve:v=>resolve(v)}}
let workers,ready,snapshotCalls,getCalls
const originalWorker=globalThis.Worker
beforeEach(()=>{
 workers=[];ready=deferred();snapshotCalls=0;getCalls=0;
 globalThis.__zap={get:async()=>{getCalls++;return{c:0,d:{token}}},client:{getGasPrice:async()=>1n},snapshot:async()=>{snapshotCalls++;return{block:1n}}}
 globalThis.Worker=class {constructor(){this.terminated=false;workers.push(this);ready.resolve(this)}postMessage(data){this.data=data}terminate(){this.terminated=true}}
})
after(async()=>{globalThis.Worker=originalWorker;delete globalThis.__zap;await rm(dir,{recursive:true,force:true})})
test('quote returns LP for the exact amount and component then terminates Worker',async()=>{
 const promise=quoteZap(token,2,123n),worker=await ready.promise;
 assert.equal(worker.data.amount,123n);assert.equal(worker.data.component,2);
 worker.onmessage({data:{plan:{lp:456n,plan:{amountIn:100n}}}});
 const quote=await promise;assert.equal(quote.zap.lp,456n);assert.equal(quote.amount,123n);assert.equal(quote.component,2);assert.equal(worker.terminated,true);
})
test('cancelled input never starts API work',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(quoteZap(token,0,1n,controller.signal),/QUOTE_CANCELLED/);assert.equal(getCalls,0);
})
test('cancel during metadata prevents a later pool read',async()=>{
 const started=deferred(),result=deferred(),controller=new AbortController();
 globalThis.__zap.get=async(_url,_params,config)=>{assert.equal(config.signal,controller.signal);started.resolve();return result.promise};
 const promise=quoteZap(token,0,1n,controller.signal),rejected=assert.rejects(promise,/QUOTE_CANCELLED/);
 await started.promise;controller.abort();result.resolve({c:0,d:{token}});await rejected;
 assert.equal(snapshotCalls,0);assert.equal(workers.length,0);
})
test('cancel during gas read prevents an unnecessary snapshot',async()=>{
 const started=deferred(),result=deferred(),controller=new AbortController();
 globalThis.__zap.client.getGasPrice=async()=>{started.resolve();return result.promise};
 const promise=quoteZap(token,0,1n,controller.signal),rejected=assert.rejects(promise,/QUOTE_CANCELLED/);
 await started.promise;controller.abort();result.resolve(1n);await rejected;assert.equal(snapshotCalls,0);
})
test('cancel running Worker rejects obsolete result and terminates computation',async()=>{
 const controller=new AbortController(),promise=quoteZap(token,0,1n,controller.signal);
 const rejected=assert.rejects(promise,/QUOTE_CANCELLED/),worker=await ready.promise;
 controller.abort();worker.onmessage({data:{plan:{lp:999n}}});await rejected;assert.equal(worker.terminated,true);
})
test('failed Worker frees resources without returning a usable quote',async()=>{
 const promise=quoteZap(token,0,1n),rejected=assert.rejects(promise,/QUOTE_FAILED/),worker=await ready.promise;
 worker.onerror();await rejected;assert.equal(worker.terminated,true);
})

for(const executor of [undefined,'0x9999999999999999999999999999999999999999']){
 test(`zap uses frontend trade router when API executor is ${executor?'different':'missing'}`,async()=>{
  globalThis.__zap.get=async()=>({c:0,d:{token,executor}});
  const promise=quoteZap(token,0,123n),worker=await ready.promise;
  assert.equal(worker.data.metadata.executor,'0x7D5480C10A98b0Feb4e5fA77aF3F01aE3a5E86F4');
  worker.onmessage({data:{plan:{lp:456n,plan:{amountIn:100n}}}});
  assert.equal((await promise).quote.metadata.executor,worker.data.metadata.executor);
 })
}
