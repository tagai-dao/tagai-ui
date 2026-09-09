// Developer smoke check for the isolated environment, not a replacement test UI.
// Requires an empty local session. The user still performs all interactions in the original pages.
import ethers from './ethers.cjs'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import {createPublicClient,http,defineChain} from 'viem'
const require=createRequire(import.meta.url),{JsonRpcProvider,Contract,parseEther,ZeroAddress,randomBytes,hexlify}=ethers
const config=require('./config.cjs'),pumpAbi=require('../src/utils/v13/Pump13.json'),tokenAbi=require('../src/utils/v13/Token13.json')
const provider=new JsonRpcProvider('http://127.0.0.1:18545',560013,{staticNetwork:true,cacheTimeout:-1})
async function api(path,body){const r=await fetch('http://127.0.0.1:19900'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d}
const initial=await api('/__fork/status');assert.equal(initial.chainId,560013);assert.equal(initial.communities.length,0,'Smoke check requires an empty local session')
const signer=await provider.getSigner(0),who=await signer.getAddress(),pump=new Contract(config.pump,pumpAbi,signer)
const options=(await api('/pump/v13/creation/'+who)).d
const asset=options.assets.find(a=>a.symbol==='QQQB');assert.ok(asset)
const index={name:'ForkSmoke',symbol:'FSM',constituentAssets:[asset.address],targetWeights:[10000],basketFeeBps:100,creatorShareBps:3000,retainCommunityOwnership:true}
const value=['pumpFee','ipshareFee','communityFee','settingsFee'].reduce((s,k)=>s+BigInt(options[k]),0n)
try{
 const tx=await pump.createToken('ForkSmoke',hexlify(randomBytes(32)),index,{value,gasLimit:16000000});await tx.wait()
 const v=(await api('/pump/v13/register',{createHash:tx.hash,tick:'ForkSmoke',logoUrl:'http://127.0.0.1:19900/logo.svg',desc:'Local integration check',chainId:56})).d
 assert.equal((await api('/community/detail?tick=ForkSmoke')).token,v.token)
 const t=new Contract(v.token,tokenAbi,signer)
 await api('/__fork/mine',{seconds:20,blocks:1})
 await(await t.buyToken(0,who,0,{value:parseEther('100'),gasLimit:2500000})).wait()
 assert.equal(await t.listingPending(),true)
 console.log('PASS creation receipt registration, community read, curve purchase, pendinglist')
 await api('/__fork/keeper',{token:v.token})
 assert.equal(await t.listed(),true)
 const detail=(await api('/pump/v13/detail/'+v.token)).d
 assert.equal(detail.components.length,1);assert.notEqual(detail.config.index_token,ZeroAddress)
 const metadata=(await api('/pump/v13/metadata/'+v.token)).d
 assert.equal(metadata.listed,true);assert.ok(metadata.routes.length>=2);assert.ok(metadata.pools.length>=2)
 console.log('PASS keeper simulation + listing, Basket V4, component staking associations, live routing metadata')
 const trade=new Contract(config.executor,require('../src/utils/v13/TradeRouter.json'),signer)
 const hash=await trade.routeHash(ZeroAddress,v.token),block=await provider.getBlock('latest')
 await(await trade.buy(v.token,[[0,parseEther('.1'),0,1,hash]],1,block.timestamp+120,who,who,{value:parseEther('.1'),gasLimit:2000000})).wait()
 const balance=await t.balanceOf(who);await(await t.approve(config.executor,parseEther('100'))).wait()
 await(await trade.sell(v.token,parseEther('100'),[[0,parseEther('100'),0,1,await trade.routeHash(v.token,ZeroAddress)]],1,block.timestamp+120,who,who,{gasLimit:2000000})).wait()
 assert.ok(await t.balanceOf(who)<balance)
 const rows=await api('/community/tradeList?token='+v.token)
 assert.ok(rows.some(r=>r.isBuy)&&rows.some(r=>!r.isBuy))
 assert.ok((await api('/community/holderList?token='+v.token)).length>0)
 assert.ok((await api('/community/getTokenTradeData?tick=ForkSmoke')).length>0)
 const liq=new Contract(config.liquidityRouter,require('../src/utils/v13/LiquidityRouter.json'),signer)
 await build({stdin:{contents:"export * from './src/utils/v13/snapshot.ts';export * from './src/utils/v13/math.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.local-fork/core-check.cjs',plugins:[{name:'local-chain',setup(b){b.onLoad({filter:/v13\/snapshot\.ts$/},async a=>({loader:'ts',contents:(await readFile(a.path,'utf8')).replace('[56n, m.nutboxRouter','[560013n, m.nutboxRouter')}))}}]})
 const {loadSnapshot,optimizeZap}=require('../.local-fork/core-check.cjs')
 const client=createPublicClient({chain:defineChain({id:560013,name:'Local',nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:{default:{http:['http://127.0.0.1:18545']}}}),transport:http('http://127.0.0.1:18545',{timeout:120000})})
 const m=(await api('/pump/v13/metadata/'+v.token)).d,snap=await loadSnapshot(client,m,await client.getGasPrice())
 assert.equal(snap.executable,true);assert.equal(snap.hashes['0:true'],await trade.routeHash(ZeroAddress,v.token))
 const quote=optimizeZap(m,snap,parseEther('.2'),0),min=n=>{const v=n*95n/100n;return v>0n?v:1n}
 assert.ok(quote.lp>0n)
 const b=await provider.getBlock('latest')
 const z=[v.token,0,quote.tokenBnb,min(quote.plan.amountOut),min(quote.assetOut),min(quote.lp),b.timestamp+120,who,hash,snap.hashes['1:true'],min(quote.tokenRefundRateX128),min(quote.assetRefundRateX128)]
 console.log('PASS original frontend snapshot + LP optimizer against local fork; route hash matches local chain')
 await(await liq.addWithBNB(z,{value:parseEther('.2'),gasLimit:4000000})).wait()
 const lp=new Contract(detail.components[0].pair,['function balanceOf(address) view returns(uint256)','function approve(address,uint256) returns(bool)'],signer)
 const amount=await lp.balanceOf(who);assert.ok(amount>0n)
 const stake=new Contract(detail.components[0].staking_pool,require('../src/utils/v13/ERC20Staking.json'),signer)
 const com=new Contract(v.communityAddress,['function getCommittee() view returns(address)'],provider),committee=new Contract(await com.getCommittee(),['function getPoolOperationFee() view returns(uint256)'],provider),fee=await committee.getPoolOperationFee()
 await(await lp.approve(await stake.getAddress(),amount)).wait();await(await stake.deposit(amount,{value:fee,gasLimit:2000000})).wait()
 assert.equal(await stake.getUserStakedAmount(who),amount)
 await api('/__fork/mine',{seconds:7200,blocks:20})
 const later=await provider.getBlock('latest')
 await(await trade.buy(v.token,[[0,parseEther('.01'),0,1,hash]],1,later.timestamp+120,who,who,{value:parseEther('.01'),gasLimit:2500000})).wait()
 const deployment=require('../../TagAI-contract-V2/deployments/56/version13.json')
 const calculator=new Contract(deployment.HourlyTickCalculator,['function totalInjected(address) view returns(uint256)'],provider)
 assert.ok(await calculator.totalInjected(v.communityAddress)>0n,'The hook must actually inject rewards')
 // Injection starts vesting across subsequent hourly boundaries, not immediately.
 await api('/__fork/mine',{seconds:3600,blocks:1})
 const rewards=new Contract(v.communityAddress,['function getPoolPendingRewards(address,address) view returns(uint256)','function withdrawPoolsRewards(address[]) payable'],signer)
 const pending=await rewards.getPoolPendingRewards(await stake.getAddress(),who)
 assert.ok(pending>0n,'Staking emissions should accrue after time travel and a hook-triggering swap')
 const beforeClaim=await t.balanceOf(who)
 await(await rewards.withdrawPoolsRewards([await stake.getAddress()],{value:fee,gasLimit:2000000})).wait()
 assert.ok(await t.balanceOf(who)>beforeClaim)
 console.log('PASS staking reward accrual and claim using actual mining contracts')
 await(await stake.withdraw(amount,{value:fee,gasLimit:2000000})).wait()
 await(await lp.approve(config.liquidityRouter,amount)).wait();await(await liq.remove(v.token,0,amount,1,1,(await provider.getBlock('latest')).timestamp+120,{gasLimit:2000000})).wait()
 assert.equal(await lp.balanceOf(who),0n)
 console.log('PASS deployed trade router buy/sell, BNB zap, LP stake, fast-forward, withdraw and remove')
}finally{
 await api('/__fork/reset',{});assert.equal((await api('/__fork/status')).communities.length,0)
 console.log('Local fork + temporary records reset; no production changes')
}
