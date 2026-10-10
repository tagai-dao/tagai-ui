import {test,after,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {parseAbi,encodeFunctionResult,decodeFunctionData,encodeAbiParameters,keccak256,toHex,zeroAddress} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'rh-v14-ui-'))
await build({stdin:{contents:`
export * from './src/utils/v13/creation-chain.ts';export * from './src/utils/v13/creation.ts';
export * from './src/utils/v14/creation-config.ts';export * from './src/utils/v14/chain.ts';
export * from './src/utils/v14/uniswap-state.ts';export * from './src/utils/v14/history.ts';
export * from './src/utils/v13/snapshot.ts';export * from './src/utils/v13/registration-queue.ts';
export * from './src/utils/v13/lifecycle.ts';export * from './src/utils/v13/client.ts';
export * from './src/config/baskets.ts';`,resolveDir:process.cwd()},alias:{'@':join(process.cwd(),'src')},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),define:{'import.meta.env':'{}','import.meta.url':JSON.stringify('file:///test/rh-v14.ts')},logLevel:'silent',plugins:[{name:'io',setup(b){
 b.onResolve({filter:/^@\/(apis\/axios|config\/api|utils\/wallets|stores\/(chain|web3))$/},a=>({path:a.path,namespace:'io'}))
 b.onLoad({filter:/.*/,namespace:'io'},a=>({contents:a.path.endsWith('axios')?
  'export const get=(...a)=>globalThis.__rhUi.get(...a);export const post=(...a)=>globalThis.__rhUi.post(...a)':
  a.path.endsWith('wallets')?'export const getReadOnlyClient=id=>{globalThis.__rhUi.clientIds.push(id);return globalThis.__rhUi.client};export const getPreparedWalletClient=async()=>globalThis.__rhUi.wallet':
  a.path.includes('stores/')?'export const useChainStore=()=>({activeChainId:globalThis.__rhUi.chainId});export const useAccountStore=()=>({ethConnectAddress:globalThis.__rhUi.account})':
  "export const API_BASE_URL='https://example.invalid'",loader:'js'}))
}}]})
const ui=createRequire(import.meta.url)(join(dir,'test.cjs'))
const catalog=JSON.parse(await readFile('src/utils/v14/rh-creation-assets.json','utf8'))
const creator='0x'+'11'.repeat(20),committee='0x'+'22'.repeat(20)
const profile=ui.getIndexDeployment(4663)
after(async()=>{delete globalThis.__rhUi;await rm(dir,{recursive:true,force:true})})
beforeEach(()=>{globalThis.__rhUi={clientIds:[],chainId:4663,account:creator}})
function creationClient(){
 const calls=[]
 return {calls,chain:{id:4663},getBlockNumber:async()=>123n,multicall:async req=>{
  calls.push(req)
  return calls.length===1?[creator,committee,5n,profile.deployment.contracts.tokenImplementation14,...catalog.map(()=>true)]:
   [false,6n,7n,8n,['Trade Curation',8000,true],true]
 }}
}
test('RH V14 profile uses its deployed contracts; BSC V13/V14 and RH V9/V11 do not mix',()=>{
 assert.equal(profile.pump.toLowerCase(),'0xd72826378cb53182319f7a8b2882de4997ffc896')
 assert.equal(profile.executor.toLowerCase(),'0xf64b0e841a756b32e0848b609e9a0d1646ec00d9')
 assert.equal(profile.nativeSymbol,'ETH');assert.equal(profile.v2FeePips,3000)
 for(const [chain,v,expected] of [[56,13,true],[56,14,true],[4663,14,true],[4663,13,false],[4663,11,false],[4663,9,false]])assert.equal(ui.isIndexToken(chain,v),expected)
 assert.equal(profile.deployment.latestPumpVersion,14)
 assert.equal(profile.deployment.contracts.pump11.toLowerCase(),'0x7686cbaf2dfc7000eb9b0d6de81e48c1211d2655')
})
test('RH fallback offers exactly 52 approved assets with two fixed-block Multicalls',async()=>{
 const client=creationClient(),result=await ui.readCreationOptions(client,creator)
 assert.equal(result.chainId,4663);assert.equal(result.assets.length,52)
 assert.deepEqual(new Set(result.assets.map(a=>a.address.toLowerCase())),new Set(catalog.map(a=>a.address.toLowerCase())))
 assert.equal(ui.creationFee(result,5),58n)
 assert.equal(client.calls.length,2)
 for(const req of client.calls){assert.equal(req.blockNumber,123n);assert.equal(req.allowFailure,false)}
 assert.equal(client.calls[0].contracts[0].address,profile.pump)
 assert.equal(client.calls[1].contracts[4].args[0],profile.deployment.contracts.tradeCurationFactory)
})
test('RH API requests, fallback clients and registrations use chain 4663',async()=>{
 const options=await ui.readCreationOptions(creationClient(),creator),requests=[]
 globalThis.__rhUi.get=async(...a)=>{requests.push(a);return {c:0,d:options}}
 await ui.creationOptions(creator,4663)
 assert.equal(requests[0][2].headers['X-Chain-Id'],'4663')
 globalThis.__rhUi.get=async()=>{throw Error('offline')};globalThis.__rhUi.client=creationClient()
 assert.equal((await ui.creationOptions(creator,4663)).assets.length,52)
 assert.deepEqual(globalThis.__rhUi.clientIds,[4663])
 globalThis.__rhUi.post=async(...a)=>{requests.push(a);return {c:0,d:{chainId:4663,version:14}}}
 await ui.registerV13({chainId:4663,version:14})
 assert.equal(requests.at(-1)[2].headers['X-Chain-Id'],'4663')
 await assert.rejects(ui.registerV13({chainId:4663,version:13}),/Unsupported registration chain/)
})
test('RH mining configuration rejects a BSC factory and keeps cumulative LP allocation',async()=>{
 const options=await ui.readCreationOptions(creationClient(),creator)
 assert.equal(ui.tradePoolConfig(8000,options)[0].factory,profile.deployment.contracts.tradeCurationFactory)
 assert.throws(()=>ui.tradePoolConfig(8000,{...options,tradePool:{...options.tradePool,factory:ui.getIndexDeployment(56).deployment.contracts.tradeCurationFactory}}))
 assert.deepEqual(ui.stakingRewardRatios([1,3332,3333,3334],8000),[0,666,667,667])
})
test('registration queues isolate chains even for identical transaction hashes',async()=>{
 const storage={getItem(k){return this[k]??null},setItem(k,v){this[k]=v},removeItem(k){delete this[k]}}
 const registered=[],hash='0x'+'ab'.repeat(32)
 const make=chainId=>ui.createRegistrationQueue({storage,chainId,scope:`api:${chainId}`,receipt:async()=>({status:'success'}),register:async f=>registered.push(f.chainId),synced(){}})
 const rh=make(4663),bsc=make(56)
 rh.enqueue({chainId:4663,version:14,createHash:hash});bsc.enqueue({chainId:56,version:14,createHash:hash})
 assert.throws(()=>rh.enqueue({chainId:56,version:14,createHash:hash}))
 await rh.flush();assert.deepEqual(registered,[4663]);await bsc.flush();assert.deepEqual(registered,[4663,56])
})
test('Uniswap packed negative tick, signed liquidity net and mapping slots follow StateLibrary',()=>{
 const id=toHex(1n,{size:32}),sqrt=1n<<96n
 const packed=toHex(sqrt|(BigInt.asUintN(24,-60n)<<160n)|(123n<<184n)|(3000n<<208n),{size:32})
 assert.deepEqual(ui.decodeSlot0(packed),[sqrt,-60,123,3000])
 assert.deepEqual(ui.decodeTick(toHex(7n|(BigInt.asUintN(128,-9n)<<128n),{size:32})),{liquidityGross:7n,liquidityNet:-9n})
 const base=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[id,6n]))
 assert.equal(ui.stateSlot(id),base)
 const expected=keccak256(encodeAbiParameters([{type:'int256'},{type:'bytes32'}],[-1n,toHex(BigInt(base)+5n,{size:32})]))
 assert.equal(ui.bitmapSlot(id,-1),expected)
})
test('RH route hashes include chain 4663; new linked Basket retains legacy V3 deployments',()=>{
 const m={chainId:4663,nutboxRouter:profile.nutboxRouter},r={asset:catalog[0].address,registry:[]}
 assert.notEqual(ui.routeHash(m,r,true),ui.routeHash({...m,chainId:56},r,true))
 const legacy=ui.getBasketProtocol(4663,3),current=ui.getBasketProtocol(4663,3,ui.RH_PUMP14_BASKET_PROTOCOL.hook)
 assert.notEqual(legacy.hook,current.hook)
 assert.equal(current.swapRouter.toLowerCase(),'0x47fcc4e4396bfb306e4cb60e53d366c7caf17971')
 assert.throws(()=>ui.getBasketProtocol(4663,3,creator),/Unsupported Basket protocol engine/)
})
test('RH live snapshot reads Uniswap through a pinned Multicall, never Pancake getters',async()=>{
 const token=creator,id=toHex(2n,{size:32}),pool={id:'main',address:profile.deployment.dex.v4PoolManager,kind:'v4',v4Protocol:'uniswap-v4',poolId:id,token0:zeroAddress,token1:token,feePips:0,words:[-1,0],ticks:[-60,60],tickSpacing:60,decimals0:18,decimals1:18}
 const metadata={schemaVersion:1,abiVersion:'ipshare-subject-v1',chainId:4663,version:14,token,pump:profile.pump,nutboxRouter:profile.nutboxRouter,multicall:profile.deployment.multiConfig.multicallAddress,executor:profile.executor,pools:[pool],routes:[{index:0,asset:token,pools:['main'],registry:[]}]}
 const abi=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns((bool success,bytes returnData)[])','function extsload(bytes32) view returns(bytes32)','function getBlockNumber() view returns(uint256)','function getCurrentBlockTimestamp() view returns(uint256)','function listed() view returns(bool)','function listingPending() view returns(bool)','function supportsToken(address) view returns(bool)','function nutboxRouter() view returns(address)','function routePoolCount(address,address) view returns(uint256)'])
 const calls=[];const client={chain:{id:4663},getBlockNumber:async()=>123n,readContract:async req=>{
  assert.equal(req.address,metadata.multicall);assert.equal(req.functionName,'aggregate3');assert.equal(req.blockNumber,123n)
  return req.args[0].map(call=>{
   const fn=decodeFunctionData({abi,data:call.callData});calls.push(fn.functionName)
   let result={getBlockNumber:123n,getCurrentBlockTimestamp:1000n,listed:true,listingPending:false,supportsToken:true,nutboxRouter:profile.nutboxRouter,routePoolCount:0n}[fn.functionName]
   if(fn.functionName==='extsload'){
    assert.equal(call.target,profile.deployment.dex.v4PoolManager)
    const slot=fn.args[0]
    const n=slot===ui.stateSlot(id)?1n<<96n:slot===ui.liquiditySlot(id)?10000n:slot===ui.tickSlot(id,-60)||slot===ui.tickSlot(id,60)?1n:slot===ui.bitmapSlot(id,-1)?1n<<255n:2n
    result=toHex(n,{size:32})
   }
   return {success:true,returnData:encodeFunctionResult({abi,functionName:fn.functionName,result})}
  })
 }}
 const snapshot=await ui.loadSnapshot(client,metadata,0n)
 assert.equal(snapshot.executable,true);assert.equal(snapshot.pools.main.valid,true)
 assert.equal(snapshot.pools.main.sqrtPrice,1n<<96n)
 assert.equal(snapshot.hashes['0:true'],ui.routeHash(metadata,metadata.routes[0],true))
 assert.ok(calls.includes('extsload'));assert.ok(!calls.includes('getSlot0'))
 await assert.rejects(ui.loadSnapshot({...client,chain:{id:56}},metadata,0n),/INVALID_METADATA/)
})
test('RH history keeps uint256 quantities as strings, with ETH units and chain headers',async()=>{
 const raw=(2n**256n-1n).toString(),requests=[]
 globalThis.__rhUi.get=async(...a)=>{requests.push(a);return {c:0,d:{chainId:4663,token:creator,trades:[{buyer:committee,is_buy:1,token_amount:raw,eth_amount:'1000000000000000000',block_timestamp:1000,transaction_hash:'hash'}]}}}
 const [trade]=await ui.readRhIndexTrades(creator,'RH14',2)
 assert.equal(trade.amountRaw,raw);assert.equal(trade.ethAmount,'1');assert.equal(trade.quoteSymbol,'ETH')
 assert.equal(requests[0][1].page,2);assert.equal(requests[0][2].headers['X-Chain-Id'],'4663')
})
test('RH curve quote uses its Pump and refuses a wallet transaction after chain changes during simulation',async()=>{
 const reads=[],writes=[]
 globalThis.__rhUi.client={getBlockNumber:async()=>123n,multicall:async req=>{
  assert.equal(req.blockNumber,123n);return [false,false,100n,0n,[100n,100n],creator,committee,zeroAddress]
 },readContract:async req=>{reads.push(req);return 50n},simulateContract:async request=>{globalThis.__rhUi.chainId=56;return {request}},waitForTransactionReceipt:async()=>({status:'success'})}
 globalThis.__rhUi.wallet={writeContract:async req=>{writes.push(req);return 'hash'}}
 const q=await ui.quoteCurve(creator,true,10000n,14)
 assert.equal(q.state.chainId,4663);assert.equal(reads[0].address,profile.pump);assert.equal(reads[0].blockNumber,123n)
 await assert.rejects(ui.executeCurve(q,creator,100),/QUOTE_EXPIRED/);assert.equal(writes.length,0)
})
test('RH listed trade refuses a BSC executor before requesting the wallet',async()=>{
 const q={metadata:{chainId:4663,version:14,token:creator,executor:ui.getIndexDeployment(56).executor},snapshot:{fetchedAt:Date.now(),executable:true},plan:{isBuy:true,amountIn:1n}}
 await assert.rejects(ui.executeQuote(q,creator,100),/EXECUTOR_UNAVAILABLE/)
 assert.deepEqual(globalThis.__rhUi.clientIds,[])
})
test('RH quote metadata is routed by chain and rejects a BSC response before pool reads',async()=>{
 let header
 globalThis.__rhUi.get=async(_url,_params,config)=>{header=config.headers['X-Chain-Id'];return {c:0,d:{token:creator,chainId:56,version:14,pump:ui.getIndexDeployment(56).pump}}}
 const session=ui.createQuoteSession()
 try{await assert.rejects(session.quote(creator,true,1n),/INVALID_METADATA/);assert.equal(header,'4663');assert.deepEqual(globalThis.__rhUi.clientIds,[])}finally{session.reset()}
})
