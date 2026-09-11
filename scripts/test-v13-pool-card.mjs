import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createRenderer,nextTick} from 'vue'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),dir=await mkdtemp(join(tmpdir(),'v13-card-'))
const filename='src/views/tag-detail/V13PoolCard.vue'
const {descriptor}=parse(await readFile(filename,'utf8'),{filename})
const script=compileScript(descriptor,{id:'card-test'})
await build({stdin:{contents:script.content,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'card.cjs'),logLevel:'silent',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^vue$/},()=>({path:require.resolve('vue'),external:true}))
 b.onResolve({filter:/liquidity-preview\.ts$/,namespace:'fixture'},a=>({path:a.path,namespace:'file'}))
 b.onResolve({filter:/^@\/utils\/v13\/liquidity-preview$/},()=>({path:join(process.cwd(),'src/utils/v13/liquidity-preview.ts')}))
 b.onResolve({filter:/^@\/utils\/v13\/operation-error$/},()=>({path:join(process.cwd(),'src/utils/v13/operation-error.ts')}))
 b.onResolve({filter:/^(@\/|vue-i18n$)/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 export default {};export const useI18n=()=>({t:k=>k,locale:{value:'en'}});
 export const useAccountStore=()=>({ethConnectAddress:globalThis.__cardFixture.address});export const useChainStore=()=>({activeChainId:56});
 export const GlobalModalType={ChoseWallet:1};export const useModalStore=()=>({setModalVisible:(...args)=>globalThis.__cardFixture.modalCalls.push(args)});
 export const presetBasketAssetLogo=()=>null;export const resolveBasketAssetLogo=async()=>null;
 export const readPool=async()=>globalThis.__cardFixture.state;export const readPoolRewards=async()=>({daily:0n,ratio:10000});
 export const poolAprBps=()=>0n;
 export const notify=options=>globalThis.__cardFixture.notices.push(options);
 export {afterPairTax,previewLiquidityAdd} from ${JSON.stringify(join(process.cwd(),'src/utils/v13/liquidity-preview.ts'))};
 export const operatePool=(...a)=>globalThis.__cardFixture.execute(...a);export const liquidity=(...a)=>globalThis.__cardFixture.execute(...a);
 export const quoteZap=async()=>undefined;export const executeZap=(...a)=>globalThis.__cardFixture.execute(...a);`}))
}}]})
const Card=require(join(dir,'card.cjs')).default;Card.render=()=>null
const renderer=createRenderer({createComment:()=>({}),createElement:()=>({}),createText:()=>({}),insert:()=>{},remove:()=>{},setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null,patchProp:()=>{}})
const address='0x'+'22'.repeat(20)
function mount(execute,walletAddress='0x'+'11'.repeat(20)){
 globalThis.__cardFixture={execute,address:walletAddress,modalCalls:[],notices:[],state:{supply:10n**18n,reserveToken:10n**18n,reserveAsset:10n**18n,lpBalance:10n**18n,staked:0n,total:0n,active:true,symbol:'STOCK',decimals:18,pending:0n,fee:0n,nativeBalance:10n**18n,assetBalance:0n,tokenBalance:0n}}
 const app=renderer.createApp(Card,{token:address,community:address,symbol:'T',liquidityRouter:address,leg:{asset:address,pair:address,staking_pool:address,position:0,target_weight:10000,asset_decimals:18,pool_status:'OPENED'}})
 const vm=app.mount({});return {app,s:vm.$.setupState}
}
const event={currentTarget:{isConnected:true,focus:()=>{}}}
after(async()=>{delete globalThis.__cardFixture;await rm(dir,{recursive:true,force:true})})
for(const wallet of ['', '0x'+'00'.repeat(20)])test(`disconnected wallet ${wallet||'(empty)'} opens wallet selection without entering a transaction`,async()=>{
 const {app,s}=mount(()=>assert.fail('must not submit a transaction'),wallet)
 try{
  assert.equal(s.connected,false)
  s.connectWallet();assert.deepEqual(globalThis.__cardFixture.modalCalls,[[true,1]])
  s.openAction('deposit',event);assert.equal(s.expanded,false)
  await s.operate();await s.operate(true)
  assert.deepEqual(globalThis.__cardFixture.modalCalls,[[true,1],[true,1]])
 }finally{app.unmount()}
})
for(const action of ['deposit','withdraw','add','remove','bnb'])test(`${action}: keep back face during confirmation; return only after successful transaction`,async()=>{
 let finish;const pending=new Promise(r=>finish=r),{app,s}=mount(()=>pending)
 try{
  await nextTick();s.openAction(action,event);s.amount='1';if(action==='bnb')s.zap={amount:10n**18n,quote:{metadata:{subject:address}},zap:{}};assert.equal(s.expanded,true)
  const operation=s.operate();assert.equal(s.busy,true);s.closeAction();assert.equal(s.expanded,true)
  finish('0xhash');await operation;assert.equal(s.expanded,false);assert.equal(s.amount,'');assert.equal(s.busy,false)
 }finally{app.unmount()}
})
test('wallet cancellation uses the existing notification and preserves the form for retry',async()=>{
 const {app,s}=mount(async()=>{throw Error('User rejected request')})
 try{s.openAction('deposit',event);s.amount='1';await s.operate();assert.equal(s.expanded,true);assert.equal(s.amount,'1');assert.equal(s.error,'');assert.deepEqual(globalThis.__cardFixture.notices,[{title:'v13Operation.title',message:'v13Operation.cancelled',type:'info'}]);assert.equal(s.busy,false);s.closeAction();assert.equal(s.expanded,false)}finally{app.unmount()}
})
test('verbose contract failures use a concise existing notification without card text or repeated refresh notices',async()=>{
 const {app,s}=mount(async()=>{throw Error('The contract function "add" reverted. Error: Expired() Contract Call: address: 0x123 args: (123,456) Docs: https://viem.sh Version: viem@2.50.3')})
 try{
  await nextTick();s.openAction('add',event);s.amount='1';await s.operate()
  assert.equal(s.error,'');assert.equal(s.amount,'1')
  assert.deepEqual(globalThis.__cardFixture.notices,[{title:'v13Operation.title',message:'v13Operation.expired',type:'error'}])
  await s.refresh();assert.equal(globalThis.__cardFixture.notices.length,1)
 }finally{app.unmount()}
})
test('either asset can drive the form; stock decimals and refresh preserve the entered side',async()=>{
 const {app,s}=mount(async()=>{})
 try{
  await nextTick();s.openAction('add',event)
  s.state={...s.state,decimals:6,reserveToken:1000000n*10n**18n,reserveAsset:2000n*10n**6n,assetBalance:3000000n}
  s.stockInput='1.998000';assert.equal(s.inputSide,'asset');assert.equal(s.stockInput,'1.998000');assert.equal(s.assetUnits,1998000n)
  assert.ok(s.units>999n*10n**18n);assert.equal(s.addPreview.assetAmount,1998000n)
  const previous=s.units;s.state={...s.state,reserveToken:2000000n*10n**18n}
  assert.equal(s.stockInput,'1.998000');assert.ok(s.units>previous)
  s.amount='1000';assert.equal(s.inputSide,'token');assert.equal(s.stockInput,'0.999');assert.equal(s.amount,'1000')
  s.stockInput='1.0000001';assert.equal(s.assetUnits,0n);assert.equal(s.units,0n)
  s.stockInput='';assert.equal(s.amount,'');assert.equal(s.stockInput,'')
 }finally{app.unmount()}
})
test('reopening another operation clears stock input and asset-driven balance errors',async()=>{
 const {app,s}=mount(async()=>{})
 try{
  await nextTick();s.openAction('add',event);s.stockInput='2';assert.equal(s.assetShort,true)
  s.closeAction();s.openAction('deposit',event)
  assert.equal(s.amount,'');assert.equal(s.stockInput,'');assert.equal(s.assetShort,false);assert.equal(s.inputSide,'token')
 }finally{app.unmount()}
})
