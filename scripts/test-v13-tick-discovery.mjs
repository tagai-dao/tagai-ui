import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { parseAbi, decodeFunctionData, encodeFunctionResult } from 'viem';
const require = createRequire(import.meta.url);
const bundled = await build({ stdin: { contents: "export * from './src/utils/v13/snapshot.ts'; export * from './src/utils/v13/gas-price.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
const module = { exports: {} };
new Function('require','module','exports',bundled.outputFiles[0].text)(require,module,module.exports);
const { loadSnapshot, quoteGasPrice } = module.exports;
const a=n=>'0x'+n.toString(16).padStart(40,'0'), h=n=>'0x'+n.toString(16).padStart(64,'0');
const ABI = parseAbi([
 'function getBlockNumber() view returns(uint256)', 'function getCurrentBlockTimestamp() view returns(uint256)',
 'function listed() view returns(bool)', 'function listingPending() view returns(bool)',
 'function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)', 'function getLiquidity(bytes32) view returns(uint128)',
 'function getPoolBitmapInfo(bytes32,int16) view returns(uint256)',
 'function getPoolTickInfo(bytes32,int24) view returns((uint128 liquidityGross,int128 liquidityNet,uint256 feeGrowthOutside0X128,uint256 feeGrowthOutside1X128))',
 'function slot0() view returns(uint160,int24,uint16,uint16,uint16,uint32,bool)', 'function liquidity() view returns(uint128)',
 'function tickBitmap(int16) view returns(uint256)', 'function ticks(int24) view returns(uint128,int128,uint256,uint256,int56,uint160,uint32,bool)',
 'function routePoolCount(address,address) view returns(uint256)',
 'function getReserves() view returns(uint112,uint112,uint32)', 'function totalSupply() view returns(uint256)', 'function balanceOf(address) view returns(uint256)',
]);
let sequence=10;
function fixture(kind='v4') {
 const id=++sequence, calls=[];let bitmap=1n,current=0,fail=false;
 const p={id:String(id),address:a(id),kind,token0:a(1),token1:a(2),poolId:h(id),tickSpacing:60,feePips:2500,decimals0:18,decimals1:18,words:[-2,-1,0,1,2],ticks:[0]};
 const m={schemaVersion:1,abiVersion:'ipshare-subject-v1',chainId:56,version:13,token:a(2),nutboxRouter:a(3),multicall:a(4),executor:null,
  tickDiscovery:'server',pools:[p],routes:[{index:0,asset:a(2),pools:[p.id],registry:[]}]};
 const client={readContract:async req=>{
  assert.equal(req.functionName,'aggregate3');calls.push(req);
  return req.args[0].map(call=>{
   const {functionName:f,args=[]}=decodeFunctionData({abi:ABI,data:call.callData});
   if(fail&&f==='getPoolBitmapInfo')return {success:false,returnData:'0x'};
   const word=Number(args.at(-1)),bits=word===0?bitmap:0n;
   const result={getBlockNumber:77n,getCurrentBlockTimestamp:1000n,listed:true,listingPending:false,
    getSlot0:[2n**96n,current,0,0],slot0:[2n**96n,current,0,0,0,0,true],
    getLiquidity:10000000000000000000000n,liquidity:10000000000000000000000n,
    getPoolBitmapInfo:bits,tickBitmap:bits,
    getPoolTickInfo:{liquidityGross:1n,liquidityNet:0n,feeGrowthOutside0X128:0n,feeGrowthOutside1X128:0n},
    ticks:[1n,0n,0n,0n,0n,0n,0,true],routePoolCount:0n,
    getReserves:[1000n,1000n,0],totalSupply:1000n,balanceOf:1000n}[f];
   assert.notEqual(result,undefined,f);
   return {success:true,returnData:encodeFunctionResult({abi:ABI,functionName:f,result})};
  });
 }};
 return {m,p,client,calls,setBitmap:b=>bitmap=b,setTick:t=>current=t,setFail:()=>fail=true};
}
for(const kind of ['v3','v4'])test(`${kind}: cold and warm quotes each use one live multicall with server tick lists`,async()=>{
 const {m,p,client,calls}=fixture(kind);
 const cold=await loadSnapshot(client,m,1n);
 assert.equal(cold.pools[p.id].valid,true);assert.equal(cold.routes.length,1);assert.equal(calls.length,1);
 assert.equal(calls[0].blockNumber,undefined);
 await loadSnapshot(client,structuredClone(m),1n);assert.equal(calls.length,2);
});
test('V2-only metadata needs one state multicall on first quote',async()=>{
 const {m,client,calls}=fixture('v2');await loadSnapshot(client,m,1n);assert.equal(calls.length,1);
});
test('new initialized tick rejects stale metadata without frontend discovery',async()=>{
 const {m,p,client,calls,setBitmap}=fixture();setBitmap(3n);
 await assert.rejects(loadSnapshot(client,m,1n),/V13_METADATA_PREPARING/);
 assert.equal(calls.length,1);assert.deepEqual(p.ticks,[0]);
 p.ticks=[0,60];const s=await loadSnapshot(client,m,1n);
 assert.equal(calls.length,2);assert.equal(s.pools[p.id].valid,true);
});
test('price outside cached window refuses to extrapolate or discover',async()=>{
 const {m,client,calls,setTick}=fixture();setTick(100000);
 await assert.rejects(loadSnapshot(client,m,1n),/V13_METADATA_PREPARING/);assert.equal(calls.length,1);
});
test('missing server tick data never triggers a frontend chain discovery',async()=>{
 const {m,p,client,calls}=fixture();delete p.ticks;
 await assert.rejects(loadSnapshot(client,m,1n),/V13_METADATA_PREPARING/);assert.equal(calls.length,0);
});
test('bitmap RPC failure invalidates the route without extra reads',async()=>{
 const {m,p,client,calls,setFail}=fixture();setFail();const s=await loadSnapshot(client,m,1n);
 assert.equal(s.pools[p.id].valid,false);assert.equal(calls.length,1);
});
test('Gas price concurrent callers and repeated quotes share one cached RPC',async()=>{
 let count=0;const client={getGasPrice:async()=>{count++;return 123n}};
 assert.deepEqual(await Promise.all([quoteGasPrice(client),quoteGasPrice(client)]),[123n,123n]);
 assert.equal(await quoteGasPrice(client),123n);assert.equal(count,1);
});
test('Gas price failure is not cached permanently',async()=>{
 let count=0;const client={getGasPrice:async()=>{if(++count===1)throw Error('offline');return 123n}};
 await assert.rejects(quoteGasPrice(client),/offline/);assert.equal(await quoteGasPrice(client),123n);assert.equal(count,2);
});
