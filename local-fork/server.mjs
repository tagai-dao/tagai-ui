import http from 'node:http'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {createRequire} from 'node:module'
import ethers from './ethers.cjs'
const {Contract,JsonRpcProvider,FetchRequest,Interface,ZeroAddress,parseEther,formatEther,isAddress,keccak256,toUtf8Bytes}=ethers
const require=createRequire(import.meta.url)
const config=require('./config.cjs'),d=require('../../TagAI-contract-V2/deployments/56/version13.json')
const {verifyCreation,loadCreationOptions}=require('./vendor/creation.cjs')
const {createMetadataService}=require('./vendor/metadata.cjs')
const tokenAbi=require('../src/utils/v13/Token13.json'),pumpAbi=require('../src/utils/v13/Pump13.json')
const catalog=require('../src/utils/v13/creation-assets.json')
// Keep status/metadata requests independent from slow cold-tick reads. Ethers
// JSON-RPC batches otherwise wait for the slowest response in the batch.
const rpcRequest=new FetchRequest('http://127.0.0.1:18545');rpcRequest.timeout=100000
export const provider=new JsonRpcProvider(rpcRequest,560013,{staticNetwork:true,cacheTimeout:-1,batchMaxCount:1})
const pump=new Contract(config.pump,pumpAbi,provider),tokenInterface=new Interface(tokenAbi)
const dir=new URL('../.local-fork/',import.meta.url)
await mkdir(dir,{recursive:true})
const stringify=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v)
let state={communities:[],autoKeeper:false,keeperLog:[],epoch:Date.now(),forkBlock:0},snapshot,baseline,mutating=false,checkpointAt=null
if(process.env.LOCAL_FORK_RESUME==='1'){
 const saved=JSON.parse(await readFile(new URL('checkpoint.json',dir),'utf8'))
 state=saved.api;state.autoKeeper=false;checkpointAt=saved.savedAt
}
const save=async()=>{await writeFile(new URL('state.tmp',dir),stringify(state));await rename(new URL('state.tmp',dir),new URL('state.json',dir))}
async function checkpoint(){
 const chain=await provider.send('anvil_dumpState',[false])
 const savedAt=Date.now()
 await writeFile(new URL('checkpoint.tmp',dir),stringify({version:1,savedAt,chain,api:state}),{mode:0o600})
 await rename(new URL('checkpoint.tmp',dir),new URL('checkpoint.json',dir));checkpointAt=savedAt
 return {ok:true,savedAt}
}
const lower=a=>String(a).toLowerCase()
const find=value=>state.communities.find(c=>lower(c.token)===lower(value)||lower(c.tick)===lower(value))
export async function assertLocal(){
 const [id,version]=await Promise.all([provider.send('eth_chainId',[]),provider.send('web3_clientVersion',[])])
 if(Number(id)!==560013||!String(version).toLowerCase().includes('anvil'))throw new Error('Refusing operation outside local Anvil chain 560013')
}
async function asAccount(address,fn){
 await assertLocal();await provider.send('anvil_setBalance',[address,'0x'+parseEther('1000').toString(16)])
 await provider.send('anvil_impersonateAccount',[address])
 try{return await fn(await provider.getSigner(address))}finally{
  try{await provider.send('anvil_stopImpersonatingAccount',[address])}catch{console.error('Local impersonation cleanup failed; restart clears impersonated accounts.')}
 }
}
async function bootstrap(){
 await assertLocal();if(process.env.LOCAL_FORK_RESUME!=='1'){
  const info=await provider.send('anvil_nodeInfo',[])
  state.forkBlock=Number(info.forkConfig.forkBlockNumber)
  if(!Number.isSafeInteger(state.forkBlock)||state.forkBlock<=0)throw new Error('Missing fork origin block')
 }
 for(const address of [config.pump,config.executor,config.liquidityRouter,config.multicall])if(await provider.getCode(address)==='0x')throw new Error('Required V13 contract not found on fork')
 if(process.env.LOCAL_FORK_RESUME==='1'){
  baseline=structuredClone(state);snapshot=await provider.send('evm_snapshot',[]);await save();return
 }
 // Only local fork: complete outstanding external integration permissions if needed.
 const registry=new Contract(d.BasketRegistry,['function owner() view returns(address)','function isRegistrarApproved(address) view returns(bool)','function setRegistrarApproval(address,bool)','function setCreatorForwarderApproval(address,bool)'],provider)
 await asAccount(await registry.owner(),async signer=>{
  const r=registry.connect(signer)
  await (await r.setRegistrarApproval(d.BasketHookV4,true)).wait()
  for(const a of [d.Pump,d.BasketSwapRouterV4])await(await r.setCreatorForwarderApproval(a,true)).wait()
 })
 const committee=new Contract(d.Committee,['function owner() view returns(address)','function adminAddContract(address)'],provider)
 await asAccount(await committee.owner(),async signer=>{for(const a of [d.HourlyTickCalculator,d.ERC20StakingFactory]){
  // Existing entries may reject duplicates. No permission is removed.
  try{await(await committee.connect(signer).adminAddContract(a)).wait()}catch(e){if(!String(e).includes('revert'))throw e}
 }})
 baseline=structuredClone(state);snapshot=await provider.send('evm_snapshot',[]);await save()
}
let metadata
const refreshCache=new Map()
function resetMetadata(){refreshCache.clear();metadata=createMetadataService({config,provider,ttlMs:60000,loadToken:async token=>find(token)?{version:13}:null})}
resetMetadata()
// A cold aggregate executes tick reads serially inside Anvil. Warm the remote
// storage with bounded concurrency before handing the listed token to the UI.
// This is fork infrastructure only; frontend snapshots remain one aggregate3.
async function warmTicks(m){
 const calls=[]
 for(const p of m.pools){
  if(p.kind==='v2')continue
  const contract=new Contract(p.address,p.kind==='v4'
   ?['function getPoolTickInfo(bytes32,int24) view returns((uint128,int128,uint256,uint256))']
   :['function ticks(int24) view returns(uint128,int128,uint256,uint256,int56,uint160,uint32,bool)'],provider)
  for(const tick of p.ticks||[])calls.push(()=>p.kind==='v4'?contract.getPoolTickInfo(p.poolId,tick):contract.ticks(tick))
 }
 let next=0
 await Promise.all(Array.from({length:6},async()=>{while(next<calls.length)await calls[next++]()}))
}
function refresh(c){
 const previous=refreshCache.get(c.token)
 if(previous&&(!previous.expires||previous.expires>Date.now()))return previous.promise
 const entry={promise:null,expires:0};entry.promise=readCommunity(c).then(value=>{entry.expires=Date.now()+1000;return value},e=>{if(refreshCache.get(c.token)===entry)refreshCache.delete(c.token);throw e});refreshCache.set(c.token,entry);return entry.promise
}
async function readCommunity(c){
 const t=new Contract(c.token,tokenAbi,provider)
 const [listed,pending,supply,index,poolId]=await Promise.all([t.listed(),t.listingPending(),t.bondingCurveSupply(),t.indexToken(),t.v4PoolId()])
 let price
 if(listed){
  const manager=new Contract(d.CLPoolManager,['function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)'],provider)
  const slot=await manager.getSlot0(poolId),ratio=Number(slot[0])/2**96;price=1/(ratio*ratio)
 }else price=Number(formatEther(await pump.getPrice(supply,parseEther('1'))))
 Object.assign(c,{listed,listingPending:pending,bondingCurveSupply:Number(formatEther(supply)),indexToken:index,pair:poolId,dexVersion:4,price,marketCap:price*1e9})
 return c
}
async function detail(c){
 await refresh(c)
 return {config:{...c.verified.indexConfig,token:c.token,name:c.verified.indexConfig.name,symbol:c.verified.indexConfig.symbol,community:c.communityAddress,index_token:c.indexToken,component_count:c.verified.components.length,basket_fee_bps:c.verified.indexConfig.basketFeeBps,creator_share_bps:c.verified.indexConfig.creatorShareBps,retain_community_ownership:Number(c.verified.indexConfig.retainCommunityOwnership),source_block:String(await provider.getBlockNumber())},
 components:c.verified.components.map(x=>({asset:x.asset,pair:x.pair,staking_pool:x.stakingPool,position:x.position,target_weight:x.targetWeight,asset_decimals:x.decimals,asset_symbol:catalog.find(a=>lower(a.address)===lower(x.asset))?.symbol,pool_status:'OPENED'})),buyback:null}
}
async function register(form){
 const v=await verifyCreation(provider,form.createHash)
 if(v.tick!==form.tick||(form.token&&lower(form.token)!==v.token))throw new Error('Creation receipt does not match form')
 const prev=find(v.tick);if(prev){if(prev.token!==v.token)throw new Error('Tick already exists');return v}
 state.communities.unshift({...form,...v,verified:v,chainId:56,version:13,name:form.tick,description:form.desc||'',logo:form.logoUrl,creator:v.creator,ipshare:v.creator,tags:JSON.stringify(form.tags||[]),createAt:v.timestamp*1000,distribution:'[]',isImport:false,listed:false,listingPending:false,bondingCurveSupply:0,totalSupply:1e9,price:0,marketCap:0,holderCount:null})
 await save();resetMetadata();return v
}
async function listing(c){
 await assertLocal();await refresh(c);if(!c.listingPending||c.listed)throw new Error('Token is not pending listing')
 const t=new Contract(c.token,tokenAbi,provider),n=Number(await t.componentCount()),total=await t.componentListingNativeBudget()
 const infrastructure=await t.listingInfrastructure(),router=new Contract(infrastructure[0],['function quote(address,address,uint256) view returns(uint256)'],provider)
 const slip=await pump.listingSwapSlippageBps();let allocated=0n
 const mins=[]
 for(let i=0;i<n;i++){
  const [asset,weight]=await t.componentAt(i),budget=i===n-1?total-allocated:total*weight/10000n;allocated+=budget
  const quote=await router.quote(ZeroAddress,asset,budget),min=quote*(10000n-slip)/10000n
  if(min<=0n)throw new Error('Listing quote is zero');mins.push(min)
 }
 const keeper=await pump.listingKeeper(),block=await provider.getBlock('latest')
 const hash=await asAccount(keeper,async signer=>{
  const p=pump.connect(signer),args=[c.token,mins,block.timestamp+180]
  await p.finalizeTokenListing.staticCall(...args)
  const gas=await p.finalizeTokenListing.estimateGas(...args)
  const tx=await p.finalizeTokenListing(...args,{gasLimit:gas*120n/100n});await tx.wait();return tx.hash
 })
 resetMetadata();await refresh(c)
 return hash
}
async function keeperRun(token){
 const targets=token?[find(token)]:state.communities
 for(const c of targets){if(!c)throw new Error('Unknown local community');await refresh(c);if(!c.listingPending||c.listed)continue
  let hash
  try{hash=await listing(c)}
  catch(e){state.keeperLog.unshift({token:c.token,tick:c.tick,error:e.shortMessage||e.message,time:Date.now(),ok:false});await save();if(token)throw e;continue}
  state.keeperLog.unshift({token:c.token,tick:c.tick,hash,time:Date.now(),ok:true});await save()
  // A failed backup/warmup must not turn a successful listing into a failed tx.
  try{await checkpoint()}catch{console.error('Post-listing checkpoint failed; periodic backup will retry.')}
  try{await warmTicks(await metadata(c.token))}catch(e){console.error('Local pool warmup:',e.shortMessage||e.message)}
 }
 state.keeperLog=state.keeperLog.slice(0,50);await save()
}
async function exclusive(fn){if(mutating)throw new Error('Local operation is busy');mutating=true;try{return await fn()}finally{mutating=false}}
const tradeInterface=new Interface(require('../src/utils/v13/TradeRouter.json'))
async function trades(c){
 const range={fromBlock:c.verified.blockNumber,toBlock:'latest'}
 const [curve,external]=await Promise.all([
  provider.getLogs({...range,address:c.token,topics:[tokenInterface.getEvent('Trade').topicHash]}),
  provider.getLogs({...range,address:config.executor,topics:[tradeInterface.getEvent('TradeExecuted').topicHash,'0x'+c.token.slice(2).padStart(64,'0')]})
 ])
 const blocks=new Map()
 return Promise.all([...curve,...external].sort((a,b)=>b.blockNumber-a.blockNumber||b.index-a.index).map(async l=>{
  const main=lower(l.address)===lower(config.executor),a=(main?tradeInterface:tokenInterface).parseLog(l).args
  if(!blocks.has(l.blockNumber))blocks.set(l.blockNumber,provider.getBlock(l.blockNumber))
  const block=await blocks.get(l.blockNumber)
  const tokens=main?(a.isBuy?a.amountOut:a.amountIn):a.tokenAmount
  const native=main?(a.isBuy?a.amountIn-a.refundAmount:a.amountOut):a.ethAmount
  return {token:c.token,tick:c.tick,trader:main?a.payer:a.buyer,isBuy:a.isBuy,amount:formatEther(tokens),ethAmount:formatEther(native),transHash:l.transactionHash,timestamp:block.timestamp*1000,blockNumber:l.blockNumber,quoteSymbol:'BNB'}
 }))
}
async function holders(c){
 const logs=await provider.getLogs({address:c.token,fromBlock:c.verified.blockNumber,toBlock:'latest',topics:[tokenInterface.getEvent('Transfer').topicHash]})
 const addresses=[...new Set(logs.flatMap(l=>{const a=tokenInterface.parseLog(l).args;return[a.from,a.to]}))].filter(a=>a!==ZeroAddress)
 const t=new Contract(c.token,tokenAbi,provider)
 return (await Promise.all(addresses.map(async holder=>({holder,amount:String(await t.balanceOf(holder))}))))
  .filter(x=>BigInt(x.amount)>0n).sort((a,b)=>BigInt(a.amount)>BigInt(b.amount)?-1:1)
}
const readBody=async req=>{const chunks=[];let n=0;for await(const x of req){n+=x.length;if(n>3*1024*1024)throw new Error('Body too large');chunks.push(x)}return Buffer.concat(chunks)}
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(stringify(value))}
const allowedOrigins=new Set(['http://127.0.0.1:15173','http://localhost:15173'])
const server=http.createServer(async(req,res)=>{
 try{
  const origin=req.headers.origin;if(origin&&!allowedOrigins.has(origin))return json(res,{error:'Local origin required'},403)
  if(!['127.0.0.1:19900','localhost:19900'].includes(req.headers.host))return json(res,{error:'Local host required'},403)
  res.setHeader('Access-Control-Allow-Origin',origin||'http://127.0.0.1:15173');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,AccessToken,X-Chain-Id,Cache-Control,Pragma');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  const u=new URL(req.url,'http://127.0.0.1:19900'),p=u.pathname,q=Object.fromEntries(u.searchParams)
  if(p==='/logo.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fe913f"/><text x="12" y="62" font-size="30">Fork</text></svg>')}
  if(p.startsWith('/images/')){if(!/^\/images\/[a-f0-9]+\.png$/.test(p))throw new Error('Invalid image');res.setHeader('Content-Type','image/png');return res.end(await readFile(new URL(p.slice(1),dir)))}
  if(p==='/files/upload'&&req.method==='PUT'){
   const raw=await readBody(req),marker=raw.indexOf(Buffer.from('\r\n\r\n')),end=raw.lastIndexOf(Buffer.from('\r\n--'))
   if(marker<0||end<=marker)throw new Error('Invalid multipart upload')
   const bytes=raw.subarray(marker+4,end),id=keccak256(bytes).slice(2);await mkdir(new URL('images/',dir),{recursive:true});await writeFile(new URL(`images/${id}.png`,dir),bytes)
   return json(res,`http://127.0.0.1:19900/images/${id}.png`)
  }
  const body=['POST','PUT','DELETE'].includes(req.method)?JSON.parse((await readBody(req)).toString()||'{}'):{}
  if(p==='/__fork/status')return json(res,{...state,checkpointAt,communities:await Promise.all(state.communities.map(refresh)),block:await provider.getBlockNumber(),timestamp:(await provider.getBlock('latest')).timestamp,chainId:560013})
  if(p.startsWith('/__fork/')&&req.method==='POST')return json(res,await exclusive(async()=>{
   await assertLocal()
   if(p==='/__fork/checkpoint')return checkpoint()
   if(p==='/__fork/fund'){if(!isAddress(body.address))throw new Error('Invalid wallet');await provider.send('anvil_setBalance',[body.address,'0x'+parseEther('1000').toString(16)]);return {ok:true}}
   if(p==='/__fork/mine'){const blocks=Number(body.blocks||1),seconds=Number(body.seconds||0);if(!Number.isSafeInteger(blocks)||blocks<1||blocks>10000||!Number.isSafeInteger(seconds)||seconds<0||seconds>31536000)throw new Error('Invalid time range');if(seconds)await provider.send('evm_increaseTime',[seconds]);await provider.send('anvil_mine',['0x'+blocks.toString(16)]);return {ok:true}}
   if(p==='/__fork/keeper'){await keeperRun(body.token);return {ok:true,log:state.keeperLog}}
   if(p==='/__fork/auto'){state.autoKeeper=!!body.enabled;await save();return {ok:true}}
   if(p==='/__fork/delete'){state.communities=state.communities.filter(c=>c.token!==body.token);await save();resetMetadata();return {ok:true}}
   if(p==='/__fork/clear'){state.communities=[];state.keeperLog=[];state.autoKeeper=false;state.epoch=Date.now();await save();resetMetadata();return {ok:true}}
   if(p==='/__fork/reset'){if(!await provider.send('evm_revert',[snapshot]))throw new Error('Snapshot unavailable');snapshot=await provider.send('evm_snapshot',[]);state=structuredClone(baseline);state.autoKeeper=false;state.epoch=Date.now();await save();resetMetadata();await checkpoint();return {ok:true}}
   throw new Error('Unknown admin action')
  }))
  if(p.startsWith('/pump/v13/creation/'))return json(res,{c:0,d:await loadCreationOptions(provider,p.split('/').at(-1))})
  if(p==='/pump/v13/register'&&req.method==='POST')return json(res,{c:0,d:await exclusive(()=>register(body))})
  if(p.startsWith('/pump/v13/metadata/'))return json(res,{c:0,d:await metadata(p.split('/').at(-1))})
  if(p.startsWith('/pump/v13/detail/')){const c=find(p.split('/').at(-1));return json(res,c?{c:0,d:await detail(c)}:{c:1,error:'Unknown local token'},c?200:404)}
  if(p==='/community/detail')return json(res,find(q.tick)?await refresh(find(q.tick)):null)
  if(p==='/community/isTokenExist')return json(res,!!find(q.tick))
  if(p==='/community/search'||p==='/community/searchTickOnly')return json(res,await Promise.all(state.communities.filter(c=>lower(c.tick).includes(lower(q.tick||''))).map(refresh)))
  if(['/community/communityByMarketCap','/community/communitiesByTrending','/community/communitiesByNew','/community/createdList'].includes(p))return json(res,await Promise.all(state.communities.map(refresh)))
  if(p==='/community/trade'){const c=find(q.token||q.tick);if(c)await refresh(c);return json(res,{c:0})}
  if(p==='/community/tradeList'){const c=find(q.token),page=Math.max(0,Number(q.pages)||0);return json(res,c?(await trades(c)).slice(page*30,page*30+30):[])}
  if(p==='/community/getTokenTradeData'){
   const c=find(q.tick),rows=c?await trades(c):[]
   return json(res,rows.reverse().filter(t=>Number(t.amount)>0&&(!q.timestamp||t.timestamp>=Number(q.timestamp))).map(t=>{const price=Number(t.ethAmount)/Number(t.amount)*1e18;return{timestamp:t.timestamp,open:price,close:price,low:price,high:price}}))
  }
  if(p==='/community/holderList'){const c=find(q.token);return json(res,c?await holders(c):[])}
  if(p==='/tiptag/getETHPrice'){
   const router=new Contract(config.nutboxRouter,['function quote(address,address,uint256) view returns(uint256)'],provider)
   return json(res,Number(formatEther(await router.quote(ZeroAddress,d.SettlementToken,parseEther('1')))))
  }
  if(p==='/user/getUserProfile'){const a=String(q.twitterId||'').replace('fork-','');return json(res,{twitterId:q.twitterId,twitterName:'Local Tester',twitterUsername:'local_tester',ethAddr:a,walletType:0,op:10000,vp:10000,profile:'http://127.0.0.1:19900/logo.svg'})}
  // Explicit empty peripheral reads; no requests are forwarded to production APIs.
  if(req.method==='GET')return json(res,[])
  return json(res,{c:1,error:'This peripheral API is not available in local fork mode'},501)
 }catch(e){json(res,{c:1,error:e.shortMessage||e.message},400)}
})
await bootstrap()
await checkpoint()
server.listen(19900,'127.0.0.1',()=>console.log(`Local data service ready. BSC fork block ${state.forkBlock}, wallet chain 560013.`))
setInterval(()=>{if(state.autoKeeper&&!mutating)exclusive(()=>keeperRun()).catch(e=>console.error('Local keeper:',e.shortMessage||e.message))},5000).unref()
setInterval(()=>{if(!mutating)exclusive(checkpoint).catch(()=>console.error('Checkpoint failed; previous checkpoint retained.'))},30000).unref()
