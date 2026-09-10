import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
const result=await build({entryPoints:['src/utils/v13/operation-error.ts'],bundle:true,write:false,format:'esm',platform:'node'})
const {poolOperationErrorKey}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
test('nested wallet and contract errors map to safe translation keys',()=>{
 for(const [error,key] of [
  [{cause:{code:4001}},'cancelled'],[{cause:{data:{errorName:'Expired'}}},'expired'],
  ['execution reverted: custom error 0x203d82d8','expired'],[{cause:{data:{errorName:'Slippage'}}},'slippage'],
  [{cause:{cause:{data:'0x90bfb865000000008199f5f300000000'}}},'slippage'],
  [Error('insufficient funds for gas'),'balance'],[Error('ERC20InsufficientAllowance'),'transfer'],
  [Error('HTTP request failed'),'network'],[Error('Wallet or chain changed'),'wallet'],
  [Error('Contract Call: 0x12345 args: private data Docs: https://viem.sh'),'failed'],[null,'failed']
 ])assert.equal(poolOperationErrorKey(error),'v13Operation.'+key)
 const cyclic={message:'unknown'};cyclic.cause=cyclic;assert.equal(poolOperationErrorKey(cyclic),'v13Operation.failed')
})
test('all supported languages have concise operation messages without RPC details',async()=>{
 for(const lang of ['zh','en','es','hi','id','ja','ko']){
  const data=JSON.parse(await readFile(`src/lang/locales/${lang}.json`,'utf8')).v13Operation
  for(const key of ['title','cancelled','expired','slippage','balance','transfer','wallet','pool','amount','network','failed']){
   assert.ok(data[key]);assert.doesNotMatch(data[key],/0x[0-9a-f]+|https?:|Contract Call|viem@/i)
  }
 }
})
