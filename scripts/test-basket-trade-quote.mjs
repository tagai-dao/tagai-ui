import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {decodeAbiParameters,encodeErrorResult,parseAbi} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'basket-trade-'))
const addr=n=>'0x'+n.toString(16).padStart(40,'0')
const [basket,settlement,asset1,asset2]=[1,2,3,4].map(addr)
await build({entryPoints:['src/utils/baskets/trade.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'trade.cjs'),plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^@\/utils\/v13\/operation-error$/},()=>({path:join(process.cwd(),'src/utils/v13/operation-error.ts')}))
 b.onResolve({filter:/^@\//},a=>({path:a.path,namespace:'stub'}))
 b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:`
 export const BASKET_DEFAULT_SLIPPAGE_BPS=100,BASKET_MAX_SLIPPAGE_BPS=500,BASKET_FRONTEND_FEE_WALLET='${addr(0)}';
 export const getBasketDeployment=()=>({settlementDecimals:18,contracts:{settlementToken:'${settlement}'}});
 export const getBasketProtocol=()=>({swapRouter:'${addr(9)}',hook:'${addr(8)}'});
 export const getChainDeployment=()=>({dex:{v4Quoter:'${addr(7)}'}});
 export const toContractPoolKey=x=>x;
 export const getReadOnlyClient=()=>globalThis.__basketQuote.client;
 export const getWalletClient=()=>({writeContract:()=>{globalThis.__basketQuote.sent++;return '0xhash'}});export const waitForTx=async()=>true;
 `}))
 b.onResolve({filter:/^\.\/bsc-v3-routing$/},()=>({path:'routing',namespace:'routing'}))
 b.onLoad({filter:/.*/,namespace:'routing'},()=>({contents:'export const quoteBscV3SettlementToAsset=async()=>1000n;'}))
}}]})
const {quoteBasketSwap,executeBasketSwap,basketTradeErrorKey}=createRequire(import.meta.url)(join(dir,'trade.cjs'))
const tuple=[{type:'tuple',components:[{type:'address'},{type:'uint256'},{type:'uint256'},{type:'uint256[]'},{type:'uint160[]'},{type:'uint160'},{type:'bool[]'}]}]
const detail={chainId:56,version:4,address:basket,decimals:18,basketLength:2,basketFeeBps:300,effectiveSupply:0,navPerToken:1,holdings:[{asset:asset1,targetWeightPct:50,route:{}},{asset:asset2,targetWeightPct:50,route:{}}]}
function fixture(){
 const f={supply:1000n,reserves:[1001n,2077n],output:482n*10n**18n,simulations:[],reads:[],sent:0,fail:false}
 f.client={getBlockNumber:async()=>123n,readContract:async p=>{
  f.reads.push(p)
  if(p.functionName==='selfPoolKey')return {currency0:settlement,currency1:basket,hooks:addr(8),poolManager:addr(6),fee:0,parameters:'0x'+'0'.repeat(64)}
  if(p.functionName==='effectiveSupply')return f.supply
  if(p.functionName==='assetAt'){const i=Number(p.args[0]);return [detail.holdings[i].asset,5000,f.reserves[i]]}
  throw Error('Unexpected read '+p.functionName)
 },simulateContract:async p=>{f.simulations.push(p);if(f.fail)throw Error('execution reverted: 0x8199f5f3');return {result:[f.output,1n],request:p}}}
 globalThis.__basketQuote=f;return f
}
after(async()=>{delete globalThis.__basketQuote;await rm(dir,{recursive:true,force:true})})
test('V4 uses complete executable output, chain supply, and exact reserve-relative constituent bounds',async()=>{
 const f=fixture(),q=await quoteBasketSwap({side:'buy',amount:'600',detail,slippageBps:100})
 assert.equal(q.source,'quoter');assert.equal(q.estimatedOut,482);assert.equal(q.minOutRaw,f.output*99n/100n)
 assert.equal(f.simulations.length,2)
 const [preview]=decodeAbiParameters(tuple,f.simulations[0].args[0].hookData)
 const [protectedData]=decodeAbiParameters(tuple,f.simulations[1].args[0].hookData)
 assert.equal(preview[1],1n);assert.deepEqual(preview[3],[1n,1n]);assert.equal(protectedData[1],q.minOutRaw)
 assert.deepEqual(q.legMins,f.reserves.map(r=>(q.minOutRaw*r+999n)/1000n))
 assert.deepEqual(protectedData[3],q.legMins)
 for(const p of [...f.simulations,...f.reads.filter(p=>p.functionName!=='selfPoolKey')])assert.equal(p.blockNumber,123n)
 assert.equal(f.sent,0)
})
test('failed simulation never produces a NAV quote or sends a transaction',async()=>{
 const f=fixture();f.fail=true
 await assert.rejects(()=>quoteBasketSwap({side:'buy',amount:'600',detail,slippageBps:100}),/reverted/)
 assert.equal(f.sent,0)
})
test('first mint retains independently protected constituent bounds',async()=>{
 const f=fixture();f.supply=0n
 const q=await quoteBasketSwap({side:'buy',amount:'600',detail,slippageBps:100})
 assert.deepEqual(q.legMins,[990n,990n]);assert.deepEqual(decodeAbiParameters(tuple,f.simulations[0].args[0].hookData)[0][3],[990n,990n])
})
test('sell uses complete settlement quote and no buy-leg minima',async()=>{
 fixture();const q=await quoteBasketSwap({side:'sell',amount:'1',detail,slippageBps:100})
 assert.deepEqual(q.legMins,[]);assert.equal(q.source,'quoter')
})
test('invalid slippage, dust output and inactive reserves cannot create executable quotes',async()=>{
 for(const slippageBps of [0,10000,NaN,1.5]){fixture();await assert.rejects(()=>quoteBasketSwap({side:'buy',amount:'1',detail,slippageBps}),/slippage/)}
 const f=fixture();f.output=1n;await assert.rejects(()=>quoteBasketSwap({side:'buy',amount:'1',detail,slippageBps:100}),/small/)
 f.output=100n;f.reserves[0]=0n;await assert.rejects(()=>quoteBasketSwap({side:'buy',amount:'1',detail,slippageBps:100}),/InvalidPool/)
})
test('legacy NAV quotes cannot be submitted for V4; nested Hook errors have a concise localized key',async()=>{
 const f=fixture();await assert.rejects(()=>executeBasketSwap({side:'buy',detail,quote:{source:'nav',minOutRaw:1n},account:addr(10)}),/EXPIRED/)
 assert.equal(f.sent,0)
 const raw=encodeErrorResult({abi:parseAbi(['error WrappedError(address target,bytes4 selector,bytes reason,bytes details)']),errorName:'WrappedError',args:[addr(8),'0xee592dc9','0x8199f5f3','0xa9e35b2f']})
 assert.equal(basketTradeErrorKey({cause:{data:raw}}),'v13Operation.slippage')
 assert.equal(basketTradeErrorKey({details:`execution reverted: custom error ${raw.slice(0,10)}: ${raw.slice(10)}` }),'v13Operation.slippage')
 assert.equal(basketTradeErrorKey({cause:{details:'execution reverted: custom error 0x8199f5f3'}}),'v13Operation.slippage')
})
