import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {createPublicClient,custom,parseAbi,decodeFunctionData,encodeFunctionResult,zeroAddress} from 'viem'
import {bsc} from 'viem/chains'
const dir=await mkdtemp(join(tmpdir(),'creation-mode-'))
await build({stdin:{contents:`export * from './src/utils/v14/creation-mode.ts';export * from './src/utils/v13/creation.ts';export * from './src/utils/v13/creation-chain.ts';export * from './src/utils/pumpSalt.ts';export * from './src/config/chains.ts';export * from './src/utils/v14/chain.ts';`,resolveDir:process.cwd()},alias:{'@':join(process.cwd(),'src')},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/^@\/(stores\/chain|apis\/axios|config\/api|utils\/wallets)$|^\.\/contract$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('chain')?'export const useChainStore=()=>globalThis.__mode.store':a.path.endsWith('axios')?'export const get=(...a)=>globalThis.__mode.get(...a);export const post=(...a)=>globalThis.__mode.post(...a)':a.path.endsWith('api')?'export const API_BASE_URL="https://api.invalid"':a.path.endsWith('wallets')?'export const getReadOnlyClient=()=>globalThis.__mode.client':'export const readContract=()=>{throw Error("No direct contract read expected")}' }))
}}]})
const ui=createRequire(import.meta.url)(join(dir,'test.cjs'))
after(async()=>{delete globalThis.__mode;await rm(dir,{recursive:true,force:true})})
const candidateAssets=JSON.parse(await readFile('src/utils/v13/creation-assets.json','utf8'))
const creator='0x'+'11'.repeat(20),committee='0x'+'22'.repeat(20),hash='0x'+'ab'.repeat(32)
const store=()=>({activeChainId:56,deployment:ui.getChainDeployment(56)})
const aggregate=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const abi=parseAbi(['function getIPShare() view returns(address)','function nutboxCommittee() view returns(address)','function createFee() view returns(uint256)','function tokenImplementation() view returns(address)','function approvedConstituent(address) view returns(bool)','function ipshareCreated(address) view returns(bool)','function getCreateCommunityFee() view returns(uint256)','function getCommunitySettingsFee() view returns(uint256)','function optionalPoolFactories(address) view returns(string,uint16,bool)','function verifyContract(address) view returns(bool)','function operators(address) view returns(bool)','function approvedCreatorForwarders(address) view returns(bool)'])
function optionsClient(version,failMethod){
 const d=ui.getChainDeployment(56),pump=d.contracts[`pump${version}`],requests=[]
 const client=createPublicClient({chain:bsc,transport:custom({request:async({method,params})=>{
  if(method==='eth_blockNumber')return '0x7ae7140'
  assert.equal(method,'eth_call');assert.equal(params[0].to.toLowerCase(),'0xca11bde05977b3631167028862be2a173976ca11');assert.equal(params[1],'0x7ae7140')
  const calls=decodeFunctionData({abi:aggregate,data:params[0].data}).args[0];requests.push(calls)
  const results=calls.map(c=>{
   const f=decodeFunctionData({abi,data:c.callData})
   if(['getIPShare','nutboxCommittee','tokenImplementation','approvedConstituent','optionalPoolFactories'].includes(f.functionName))assert.equal(c.target.toLowerCase(),pump.toLowerCase())
   if(['getCreateCommunityFee','getCommunitySettingsFee','verifyContract'].includes(f.functionName))assert.equal(c.target.toLowerCase(),committee.toLowerCase())
   if(f.functionName==='ipshareCreated'){assert.equal(c.target.toLowerCase(),creator.toLowerCase());assert.deepEqual(f.args,[creator])}
   if(f.functionName==='optionalPoolFactories'||f.functionName==='verifyContract')assert.deepEqual(f.args,[d.contracts.tradeCurationFactory])
   if(f.functionName==='createFee')assert.ok([pump.toLowerCase(),creator.toLowerCase()].includes(c.target.toLowerCase()))
   if(['operators','approvedCreatorForwarders'].includes(f.functionName)){assert.deepEqual(f.args,[pump]);assert.ok([18].includes(version));assert.equal(c.target,d.contracts[f.functionName==='operators'?`nutboxRouter${version}`:`basketRegistry${version}`])}
   const value={getIPShare:creator,nutboxCommittee:committee,createFee:100n,tokenImplementation:d.contracts[`tokenImplementation${version}`],approvedConstituent:true,ipshareCreated:true,getCreateCommunityFee:200n,getCommunitySettingsFee:300n,optionalPoolFactories:['Trade',8000,true],verifyContract:true,operators:true,approvedCreatorForwarders:true}[f.functionName]
   if(f.functionName===failMethod)return {success:false,returnData:'0x'}
   return {success:true,returnData:encodeFunctionResult({abi,functionName:f.functionName,result:value})}
  })
  return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:results})
 }},{retryCount:0})})
 return {client,requests}
}
test('unchecked selects V14, checked selects V18; RH remains V14',()=>{
 assert.equal(ui.creationVersionForMode(56),14);assert.equal(ui.creationVersionForMode(56,false),14);assert.equal(ui.creationVersionForMode(56,true),18)
 assert.equal(ui.creationVersionForMode(4663),14);assert.throws(()=>ui.creationVersionForMode(4663,true))
 globalThis.__mode={store:store()}
 for(const version of [14,18]){
  const d=ui.getCreatePumpDeployment(version);assert.equal(d.version,version);assert.equal(d.pump,ui.getChainDeployment(56).contracts[`pump${version}`]);assert.equal(d.tokenImplementation,ui.getChainDeployment(56).contracts[`tokenImplementation${version}`])
 }
 assert.notEqual(ui.predictPumpTokenAddress(creator,hash,14),ui.predictPumpTokenAddress(creator,hash,18))
})
for(const version of [14,18])test(`V${version} settings and API fallback retain the chosen Pump and one Multicall block`,async()=>{
 const {client,requests}=optionsClient(version);globalThis.__mode={store:store(),client,get:async url=>{assert.match(url,new RegExp(`/pump/v${version}/creation/`));throw Error('offline')}}
 const options=await ui.creationOptions(creator,56,version)
 assert.equal(options.version,version);assert.equal(options.pump,ui.getChainDeployment(56).contracts[`pump${version}`]);assert.ok(requests.length >= ([18].includes(version)?3:2))
 const decoded=requests.flat().map(c=>decodeFunctionData({abi,data:c.callData}))
 const methods=decoded.map(c=>c.functionName)
 assert.deepEqual(decoded.filter(c=>c.functionName==='approvedConstituent').map(c=>c.args[0].toLowerCase()),candidateAssets.map(a=>a.address.toLowerCase()))
 assert.equal(methods.filter(m=>m==='createFee').length,2)
 assert.equal(methods.filter(m=>m==='approvedConstituent').length,options.assets.length)
 for(const method of ['getIPShare','nutboxCommittee','tokenImplementation','ipshareCreated','optionalPoolFactories','getCreateCommunityFee','getCommunitySettingsFee','verifyContract'])assert.equal(methods.filter(m=>m===method).length,1)
 for(const method of ['operators','approvedCreatorForwarders'])assert.equal(methods.filter(m=>m===method).length,[18].includes(version)?1:0)
 globalThis.__mode.get=async()=>({c:0,d:options});assert.equal((await ui.creationOptions(creator,56,version)).version,version)
 const other=version===14?18:14;const fallback=optionsClient(version);globalThis.__mode.client=fallback.client
 globalThis.__mode.get=async()=>({c:0,d:{...options,version:other,pump:ui.getChainDeployment(56).contracts[`pump${other}`]}})
 assert.equal((await ui.creationOptions(creator,56,version)).version,version);assert.equal(fallback.requests.length,requests.length)
})
for(const version of [14,18])test(`V${version} required Multicall child failure refuses creation configuration`,async()=>{
 const {client}=optionsClient(version,'getCommunitySettingsFee');globalThis.__mode={store:store(),client,get:async()=>{throw Error('offline')}}
 await assert.rejects(ui.creationOptions(creator,56,version))
})
const source=await readFile('src/utils/pump.ts','utf8')
const ast=ts.createSourceFile('pump.ts',source,ts.ScriptTarget.Latest,true)
const fn=ast.statements.flatMap(s=>ts.isVariableStatement(s)?[...s.declarationList.declarations]:[]).find(d=>d.name.getText(ast)==='createCoin').initializer.getText(ast)
const js=ts.transpileModule(`const create=${fn}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function actualCreate(extra={}){
 const seen={versions:[],writes:[],submitted:[]};globalThis.__mode={store:store()}
 const deps={useChainStore:()=>globalThis.__mode.store,useAccountStore:()=>({ethConnectAddress:creator}),creationVersionForMode:ui.creationVersionForMode,getCreatePumpDeployment:ui.getCreatePumpDeployment,
 validateIndexConfig:()=>{},creationOptions:async(_c,_chain,version)=>{seen.versions.push(['options',version]);return {assets:[{address:creator}]}},tradePoolConfig:()=>[],findPumpDeploySalt:async(_c,version)=>{seen.versions.push(['salt',version]);return hash},creationFee:()=>100n,calculateInitEth:async(_amount,version)=>{seen.versions.push(['premine',version]);return 50n},getCreatePumpFee:async()=>{throw Error('Wrong fee path')},writeContract:async req=>{req.beforeWrite();seen.writes.push(req);req.onSubmitted(hash);return hash},getTransactionReceipt:async()=>({transactionHash:hash}),getCreateTokenEventByHash:(_tx,version)=>{seen.versions.push(['receipt',version]);return {tick:'TEST',token:creator}},errCode:{TRANSACTION_INVALID:'invalid'},...extra}
 return {seen,run:new Function(...Object.keys(deps),`${js};return create`)(...Object.values(deps))}
}
for(const flag of [false,true])test(`actual createCoin uses selected version for configuration, salt, broadcast and receipt (flag=${flag})`,async()=>{
 const {run,seen}=actualCreate();const version=flag?18:14
 const result=await run({tick:'TEST',initAmount:10n,binanceWalletOnly:flag,indexConfig:{constituentAssets:[creator]}},(hash,v)=>seen.submitted.push([hash,v]))
 assert.equal(result.version,version);assert.equal(seen.writes[0].contractName,`Pump${version}`)
 assert.deepEqual(seen.versions,[['options',version],['salt',version],['premine',version],['receipt',version]])
 assert.equal(seen.writes[0].value,150n)
 assert.deepEqual(seen.submitted,[[hash,version]])
})
test('V18 creation rejects excess premine before wallet work while V14 keeps its existing allowance',async()=>{
 const limit=10_000_000n*10n**18n;
 const excess=actualCreate();
 await assert.rejects(excess.run({tick:'TEST',initAmount:limit+1n,binanceWalletOnly:true,indexConfig:{constituentAssets:[creator]}}),/V18_BUY_LIMIT_EXCEEDED/);
 assert.equal(excess.seen.versions.length,0);assert.equal(excess.seen.writes.length,0);
 const exact=actualCreate();await exact.run({tick:'TEST',initAmount:limit,binanceWalletOnly:true,indexConfig:{constituentAssets:[creator]}});
 assert.equal(exact.seen.writes[0].contractName,'Pump18');
 const ordinary=actualCreate();await ordinary.run({tick:'TEST',initAmount:limit+1n,binanceWalletOnly:false,indexConfig:{constituentAssets:[creator]}});
 assert.equal(ordinary.seen.writes[0].contractName,'Pump14');
});
test('changing chain during preflight prevents a deployment signature',async()=>{
 const {run,seen}=actualCreate({findPumpDeploySalt:async()=>{globalThis.__mode.store.activeChainId=4663;return hash}})
 await assert.rejects(run({tick:'TEST',binanceWalletOnly:false,indexConfig:{constituentAssets:[creator]}}),/Wallet or chain changed/);assert.equal(seen.writes.length,0)
})
test('creation receipt retry keeps the selected flag and endpoint',async()=>{
 const posts=[];globalThis.__mode={post:async(url,form)=>{posts.push([url,form]);return {c:0,d:{version:form.version}}}}
 for(const flag of [false,true]){const version=flag?18:14;await ui.registerV13({chainId:56,version,binanceWalletOnly:flag})}
 assert.deepEqual(posts.map(p=>p[0]),['https://api.invalid/pump/v14/register','https://api.invalid/pump/v18/register'])
 assert.deepEqual(posts.map(p=>p[1].binanceWalletOnly),[false,true])
 await ui.registerV13({chainId:56,version:15,binanceWalletOnly:true});assert.equal(posts.at(-1)[0],'https://api.invalid/pump/v15/register')
})

for(const version of [14,15,16,17,18])test(`V${version} trading profile keeps its Pump and Hook`,()=>{
 const d=ui.getChainDeployment(56),p=ui.getIndexDeployment(56,version);
 assert.equal(p.pump,d.contracts[`pump${version}`]);
 if(version>=15)assert.equal(p.hook,d.contracts[`tipTagSwapHook${version}`]);
 assert.equal(p.tokenAbi.some(a=>a.type==='error'&&a.name==='InnerMarketTransferRestricted'),version>=16);
 assert.throws(()=>ui.getIndexDeployment(4663,version===14?16:version));
})
for(const method of ['operators','approvedCreatorForwarders'])test(`V18 failed activation read (${method}) cannot return creation settings`,async()=>{
 const {client}=optionsClient(18,method);globalThis.__mode={store:store(),client,get:async()=>{throw Error('offline')}};
 await assert.rejects(ui.creationOptions(creator,56,18));
})

for(const retired of [15,16,17])test(`V${retired} creation helpers are retired while historical registration stays available`,async()=>{
 globalThis.__mode={store:store(),post:async(url,form)=>{assert.match(url,new RegExp(`/pump/v${retired}/register`));return {c:0,d:form}}};
 assert.throws(()=>ui.getCreatePumpDeployment(retired),/Unsupported creation/);
 await assert.rejects(ui.creationOptions(creator,56,retired),/Unsupported creation/);
 const registered=await ui.registerV13({chainId:56,version:retired,binanceWalletOnly:true});assert.equal(registered.version,retired);
});

test('a stale default version cannot reopen legacy creation',()=>{
 globalThis.__mode={store:{activeChainId:56,deployment:{...ui.getChainDeployment(56),latestPumpVersion:17}}};
 assert.throws(()=>ui.getCreatePumpDeployment(),/Unsupported creation/);
});
