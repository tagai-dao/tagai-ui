import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {createPublicClient,custom,parseAbi,decodeFunctionData,encodeFunctionResult,zeroAddress} from 'viem'
import {bsc} from 'viem/chains'
import ts from 'typescript'
const dir=await mkdtemp(join(tmpdir(),'v15-eligibility-'))
await build({entryPoints:['src/utils/v13/lifecycle.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),alias:{'@':join(process.cwd(),'src')},logLevel:'silent',plugins:[{name:'wallets',setup(b){
 b.onResolve({filter:/^@\/(utils\/wallets|stores\/(web3|chain))$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const getReadOnlyClient=()=>globalThis.__v15.client;export const getPreparedWalletClient=async()=>{throw Error('No wallet expected')};export const useAccountStore=()=>({ethConnectAddress:globalThis.__v15.account});export const useChainStore=()=>({activeChainId:56});`}))
}}]})
const {quoteCurve}=createRequire(import.meta.url)(join(dir,'test.cjs'))
after(async()=>{delete globalThis.__v15;await rm(dir,{recursive:true,force:true})})
const token='0x'+'11'.repeat(20),account='0x'+'22'.repeat(20),mc='0xca11bde05977b3631167028862be2a173976ca11'
const aggregate=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])'])
const abi=parseAbi(['function listed() view returns(bool)','function listingPending() view returns(bool)','function bondingCurveSupply() view returns(uint256)','function createdAt() view returns(uint256)','function getBuyFeeRatios() view returns(uint256,uint256)','function ipshareSubject() view returns(address)','function nutboxCommunity() view returns(address)','function indexToken() view returns(address)','function getBuyAmountByValue(uint256,uint256) view returns(uint256)','function handleOf(address) view returns(string)','function innerMarketBought(address) view returns(uint256)','function INNER_MARKET_BUY_LIMIT() view returns(uint256)'])
function fixture(handle,fail=false,version=15,bought=0n,supply=100n){
 const requests=[]
 const client=createPublicClient({chain:bsc,transport:custom({request:async({method,params})=>{
  if(method==='eth_blockNumber')return '0x1312d00'
  assert.equal(method,'eth_call');assert.equal(params[0].to.toLowerCase(),mc);assert.equal(params[1],'0x1312d00')
  const children=decodeFunctionData({abi:aggregate,data:params[0].data}).args[0];requests.push(children)
  const rows=children.map(c=>{
   const f=decodeFunctionData({abi,data:c.callData});const values={listed:false,listingPending:false,bondingCurveSupply:supply,createdAt:0n,getBuyFeeRatios:[100n,200n],ipshareSubject:account,nutboxCommunity:token,indexToken:zeroAddress,getBuyAmountByValue:50n,handleOf:handle,innerMarketBought:bought,INNER_MARKET_BUY_LIMIT:10_000_000n*10n**18n}
   if(f.functionName==='handleOf'){assert.equal(c.target,'0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F');assert.deepEqual(f.args,[account])}
   if(f.functionName==='getBuyAmountByValue')assert.equal(c.target,version===17?'0x01B2308653c7e371B28A862444a40c12ca18b353':version===16?'0xee8D16f44c89B5F858e223Ab77c6091E184AaDf8':'0x97f35B4631F4FFBF8050B17fAd6579D6F60A289D')
   return {success:!(fail&&f.functionName==='handleOf'),returnData:encodeFunctionResult({abi,functionName:f.functionName,result:values[f.functionName]})}
  })
  return encodeFunctionResult({abi:aggregate,functionName:'aggregate3',result:rows})
 }},{retryCount:0})})
 globalThis.__v15={client,account};return requests
}
test('real viem transport sends both quote phases only to Multicall at one block',async()=>{
 const calls=fixture('registered');assert.equal((await quoteCurve(token,true,1000n,15)).amountOut,50n)
 assert.equal(calls.length,2);assert.equal(calls[0].length,8);assert.equal(calls[1].length,2)
 assert.deepEqual(calls[1].map(c=>decodeFunctionData({abi,data:c.callData}).functionName),['getBuyAmountByValue','handleOf'])
})
test('empty handle and failed required handle read cannot produce a V15 buy quote',async()=>{
 fixture('');await assert.rejects(quoteCurve(token,true,1000n,15),/V15_HANDLE_NOT_REGISTERED/)
 fixture('registered',true);await assert.rejects(quoteCurve(token,true,1000n,15))
})
test('any nonempty handle including whitespace is accepted by the actual quote path',async()=>{
 fixture(' ');assert.equal((await quoteCurve(token,true,1000n,15)).amountOut,50n)
})
test('the real creation submission callback persists V15 before receipt and API completion',async()=>{
 const source=await readFile('src/components/common/CreateCoinModal.vue','utf8')
 const match=source.match(/await createCoin\(submittedForm, (\(hash, version\) => \{[\s\S]*?\n    \})\);/);assert.ok(match)
 const code=ts.transpileModule(`const callback=${match[1]};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const saved=[];const submittedForm={chainId:56,tick:'TEST',initAmount:1n,initEth:1n,logoUrl:'logo'}
 const callback=new Function('submittedForm','enqueueV13Registration',`${code};return callback`)(submittedForm,form=>saved.push(form))
 callback('0x'+'aa'.repeat(32),15)
 assert.equal(saved.length,1);assert.equal(saved[0].version,15);assert.equal(saved[0].createHash,'0x'+'aa'.repeat(32));assert.equal(saved[0].initAmount,undefined)
 callback('0x'+'bb'.repeat(32),14);assert.equal(saved[1].version,14)
})

test('registration errors produce localized copy for decoded names and raw revert selectors',async()=>{
 const source=await readFile('src/utils/notify.ts','utf8')
 const body=source.slice(source.indexOf('const getFriendlyRevertMessage = '),source.indexOf('const showRevertNotify = '))
 const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 const friendly=new Function('t',`${code};return getFriendlyRevertMessage`)(key=>key)
 for(const reason of ['V15_HANDLE_NOT_REGISTERED','HandleNotRegistered','0x64bd20bf'+'0'.repeat(64)])assert.equal(friendly(reason),'v15Trade.registrationRequired')
})

for(const handle of ['', ' ', 'registered'])test(`V16 curve quote preserves registration enforcement (${JSON.stringify(handle)})`,async()=>{
 const calls=fixture(handle,false,16);
 if(handle)assert.equal((await quoteCurve(token,true,1000n,16)).amountOut,50n);else await assert.rejects(quoteCurve(token,true,1000n,16),/V15_HANDLE_NOT_REGISTERED/);
 assert.equal(calls.length,2)
})

for(const handle of ['', 'registered'])test(`V17 curve buy reads its own Pump and lifetime quota in the pinned Multicall (${handle})`,async()=>{
 const calls=fixture(handle,false,17);
 if(handle)assert.equal((await quoteCurve(token,true,1000n,17)).amountOut,50n);else await assert.rejects(quoteCurve(token,true,1000n,17),/V15_HANDLE_NOT_REGISTERED/);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1].map(c=>decodeFunctionData({abi,data:c.callData}).functionName),['getBuyAmountByValue','handleOf','innerMarketBought','INNER_MARKET_BUY_LIMIT']);
 assert.deepEqual(calls[1].slice(2).map(c=>c.target.toLowerCase()),[token,token]);
 assert.deepEqual(decodeFunctionData({abi,data:calls[1][2].callData}).args,[account]);
});
test('V17 quota allows the exact lifetime boundary and rejects overspend',async()=>{
 const limit=10_000_000n*10n**18n;
 fixture('registered',false,17,limit-50n);assert.equal((await quoteCurve(token,true,1000n,17)).amountOut,50n);
 fixture('registered',false,17,limit-49n);await assert.rejects(quoteCurve(token,true,1000n,17),/V17_BUY_LIMIT_EXCEEDED/);
 fixture('registered',false,17,limit-5n,650_000_000n*10n**18n-5n);assert.equal((await quoteCurve(token,true,1000n,17)).amountOut,5n);
});
