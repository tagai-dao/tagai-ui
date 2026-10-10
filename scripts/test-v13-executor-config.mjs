import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-executor-'))
await build({entryPoints:['src/utils/v13/client.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'client.cjs'),define:{'import.meta.url':JSON.stringify('file:///test/client.ts')},logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^@\/config\/chains$/},()=>({path:join(process.cwd(),'src/config/chains.ts')}))
 b.onResolve({filter:/^(@\/apis\/axios|@\/config\/api|@\/utils\/wallets|@\/stores\/chain|@\/stores\/web3|\.\/snapshot)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export const API_BASE_URL='http://test';export const get=async()=>({c:0,d:globalThis.__executor.metadata});
 export const getReadOnlyClient=()=>({getGasPrice:async()=>1n});
 export const getPreparedWalletClient=async()=>{throw new Error('unexpected wallet access')};export const setup=()=>{};
 export const useChainStore=()=>({activeChainId:56});
 export const useAccountStore=()=>({ethConnectAddress:'0x1111111111111111111111111111111111111111'});
 export const loadSnapshot=async(_client,m)=>{globalThis.__executor.snapshotTarget=m.executor;return{executable:true,fetchedAt:Date.now(),timestamp:1,hashes:{'0:true':'0x'+'00'.repeat(32),'0:false':'0x'+'00'.repeat(32)}}};`}))
}}]})
const {createQuoteSession,buildTrade,executeQuote}=createRequire(import.meta.url)(join(dir,'client.cjs'))
const token='0x1111111111111111111111111111111111111111'
const expected='0xB70544BfdACaBD8718261d7A6be5208b7D2f6Ebf'
const originalWorker=globalThis.Worker
const plan={isBuy:true,amountIn:100n,amountOut:50n,legs:[{index:0,amount:100n,intermediate:0n,output:50n}]}
globalThis.Worker=class{terminate(){} postMessage(data){globalThis.__executor.workerTarget=data.metadata.executor;this.onmessage({data:{id:data.id,plan}})}}
after(async()=>{globalThis.Worker=originalWorker;delete globalThis.__executor;await rm(dir,{recursive:true,force:true})})
for(const version of [13,14]) for(const executor of [undefined,'0x9999999999999999999999999999999999999999']){
 test(`V${version} trade snapshot and wallet target use config with ${executor?'conflicting':'missing'} API executor`,async()=>{
  globalThis.__executor={metadata:{version,chainId:56,pump:version===14?'0xcd4e721Fc418f4D723C04c71e8d8EcCb75C3CD34':'0x2c2f4e8D85c02a065f109c74d9b27186AE65Adfa',nutboxRouter:'0x72dc4F38A7E4159e97d826a6ab594748C6b68f17',multicall:'0xcA11bde05977b3631167028862bE2a173976CA11',token,executor,listed:true,generatedAt:Date.now(),configHash:'test'}}
  const q=await createQuoteSession().quote(token,true,100n)
  assert.equal(globalThis.__executor.snapshotTarget,expected)
  assert.equal(globalThis.__executor.workerTarget,expected)
  assert.equal(buildTrade(q,token,token,100).address,expected)
  assert.equal(buildTrade({...q,plan:{...plan,isBuy:false}},token,token,100).address,expected)
  await assert.rejects(executeQuote({...q,metadata:{...q.metadata,executor:token}},token,100),/EXECUTOR_UNAVAILABLE/)
 })
}
