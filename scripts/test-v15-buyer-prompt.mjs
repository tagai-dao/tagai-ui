import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {reactive,effectScope,computed,ref} from 'vue'
import ts from 'typescript'
import {createPublicClient,custom,parseAbi,decodeFunctionData,encodeFunctionResult} from 'viem'
import {bsc} from 'viem/chains'
const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'v15-buyer-prompt-'))
await build({stdin:{contents:"export * from './src/composables/useV15BuyerEligibility.ts';export * from './src/utils/v15/buyer.ts';",resolveDir:process.cwd()},alias:{'@':join(process.cwd(),'src')},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},a=>({path:require.resolve(a.path),external:true}))
 b.onResolve({filter:/^@\/utils\/wallets$/},()=>({path:'wallets',namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const getReadOnlyClient=()=>{throw Error("No unexpected RPC")}' }))
}}]})
const {readBuyerHandle,useV15BuyerEligibility}=require(join(dir,'test.cjs'))
after(()=>rm(dir,{recursive:true,force:true}))
const token='0x'+'11'.repeat(20),account='0x'+'22'.repeat(20),other='0x'+'33'.repeat(20)
const mc='0xca11bde05977b3631167028862be2a173976ca11',registry='0x60b9262456de011f7d15a54cdd8c48baaa8b022f'
const aggregate=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const abi=parseAbi(['function handleOf(address account) view returns(string)'])
function rpc(handle,fail=false){
 const calls=[]
 const client=createPublicClient({chain:bsc,transport:custom({request:async({method,params})=>{
  if(method==='eth_blockNumber')return '0x1312d00'
  assert.equal(method,'eth_call');assert.equal(params[0].to.toLowerCase(),mc);assert.equal(params[1],'0x1312d00')
  const children=decodeFunctionData({abi:aggregate,data:params[0].data}).args[0];assert.equal(children.length,1)
  const child=children[0];assert.equal(child.target.toLowerCase(),registry)
  const fn=decodeFunctionData({abi,data:child.callData});assert.equal(fn.functionName,'handleOf');assert.deepEqual(fn.args,[account]);calls.push(fn)
  return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:[{success:!fail,returnData:fail?'0x':encodeFunctionResult({abi,functionName:'handleOf',result:handle})}]})
 }},{retryCount:0})})
 return {client,calls}
}
for(const handle of ['', 'registered', ' '])test(`connected-address Handle check uses fixed-block Multicall and accepts exactly nonempty strings (${JSON.stringify(handle)})`,async()=>{
 const {client,calls}=rpc(handle);assert.equal(await readBuyerHandle(client,account),handle.length>0);assert.equal(calls.length,1)
})
test('required Handle call failure is unavailable, never treated as an unregistered wallet',async()=>{
 await assert.rejects(readBuyerHandle(rpc('registered',true).client,account))
 await assert.rejects(readBuyerHandle({chain:{id:4663}},account),/UNAVAILABLE/)
})
const base=()=>({chainId:56,version:15,token,account,connected:true,listed:false,ready:true,side:'buy'})
const tick=async()=>{await Promise.resolve();await Promise.resolve()}
function mount(patch={},reader){
 const c=reactive({...base(),...patch}),scope=effectScope()
 const result=scope.run(()=>useV15BuyerEligibility(()=>({...c}),reader))
 return {c,scope,...result}
}
test('checks on connection before any amount is entered; provider branding has no role',async()=>{
 const addresses=[];const ui=mount({},async addr=>{addresses.push(addr);return false})
 assert.equal(ui.status.value,'checking');assert.equal(ui.blocked.value,true)
 await tick();assert.equal(ui.status.value,'unregistered');assert.deepEqual(addresses,[account])
 ui.c.account=other;await tick();assert.deepEqual(addresses,[account,other]);ui.scope.stop()
})
test('V14, listed tokens, sells, RH and disconnected/loading pages do not request Handle or block trading',()=>{
 for(const patch of [{version:14},{listed:true},{side:'sell'},{chainId:4663},{connected:false},{ready:false},{account:''}]){
  const ui=mount(patch,async()=>{assert.fail('must not read Handle')})
  assert.equal(ui.status.value,'idle');assert.equal(ui.blocked.value,false);ui.scope.stop()
 }
})
test('switching address discards both stale success and stale failure responses',async()=>{
 for(const oldFails of [false,true]){
  const pending=[];const ui=mount({},()=>new Promise((resolve,reject)=>pending.push({resolve,reject})))
  ui.c.account=other;assert.equal(ui.status.value,'checking')
  pending[1].resolve(oldFails);await tick()
  assert.equal(ui.status.value,oldFails?'eligible':'unregistered')
  oldFails?pending[0].reject(Error('old RPC')):pending[0].resolve(true);await tick()
  assert.equal(ui.status.value,oldFails?'eligible':'unregistered');ui.scope.stop()
 }
})
test('leaving V15 buys or disposing the page invalidates in-flight results',async()=>{
 for(const leave of ['listed','sell','chain','token','dispose']){
  let resolve;const ui=mount({},()=>new Promise(r=>{resolve=r}))
  if(leave==='listed')ui.c.listed=true
  if(leave==='sell')ui.c.side='sell'
  if(leave==='chain')ui.c.chainId=4663
  if(leave==='token')ui.c.token=''
  if(leave==='dispose')ui.scope.stop()
  resolve(false);await tick();assert.notEqual(ui.status.value,'unregistered')
  if(leave!=='dispose'){assert.equal(ui.blocked.value,false);ui.scope.stop()}
 }
})
test('RPC failure blocks until retry; a nonempty Handle re-enables a current buyer',async()=>{
 let fail=true;const ui=mount({},async()=>{if(fail)throw Error('RPC');return true})
 await tick();assert.equal(ui.status.value,'unavailable');assert.equal(ui.blocked.value,true)
 fail=false;await ui.refresh();assert.equal(ui.status.value,'eligible');assert.equal(ui.blocked.value,false);ui.scope.stop()
})
test('real view puts the exact localized warning below the disabled purchase button',async()=>{
 const source=await readFile('src/views/buy-sell/BuyAndSellView.vue','utf8')
 const script=source.split('<script setup lang="ts">')[1].split('</script>')[0]
 const ast=ts.createSourceFile('view.ts',script,ts.ScriptTarget.Latest,true)
 const expr=ast.statements.flatMap(s=>ts.isVariableStatement(s)?[...s.declarationList.declarations]:[]).find(d=>d.name.getText(ast)==='v15BuyerMessage').initializer.getText(ast)
 const code=ts.transpileModule(`const message=${expr}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const messages=JSON.parse(await readFile('src/lang/locales/zh.json','utf8')).v15Trade
 const ui=mount({},async()=>false)
 const message=new Function('computed','v15BuyerCheckActive','v15BuyerStatus','v13Error','t',`${code};return message`)(computed,ui.active,ui.status,ref(''),key=>messages[key.split('.')[1]])
 await tick();assert.equal(message.value,'只有Binance钱包可以在内盘购买')
 ui.c.listed=true;assert.equal(message.value,'');ui.scope.stop()
 const button=source.indexOf('@click="confirm"'),prompt=source.indexOf('id="v15-buyer-message"')
 assert.ok(prompt>source.indexOf('</button>',button))
 assert.match(source,/:disabled="!tradeReady \|\| v15BuyerBlocked/)
 assert.match(source,/poolMetadataError.value \|\| v15BuyerBlocked.value\) return/)
})

for(const version of [15,16])test(`V${version} eligibility refreshes across account and listing changes`,async()=>{
 const ui=mount({version},async()=>false);await tick();assert.equal(ui.active.value,true);assert.equal(ui.blocked.value,true);assert.equal(ui.status.value,'unregistered');
 ui.c.listed=true;assert.equal(ui.active.value,false);assert.equal(ui.blocked.value,false);ui.scope.stop()
})
