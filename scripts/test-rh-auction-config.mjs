import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'rh-auction-config-'))
let getBasketProtocol
try{
 await build({entryPoints:['src/config/baskets.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'config.cjs'),logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'fee-address',setup(b){
  b.onResolve({filter:/^@\/config$/},()=>({path:'fee',namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const FeeAddress='0x0000000000000000000000000000000000000001'",loader:'js'}))
 }}]})
 ;({getBasketProtocol}=createRequire(import.meta.url)(join(dir,'config.cjs')))
}finally{await rm(dir,{recursive:true,force:true})}
test('RH V1 and V3 auction quotes, balances and approvals use the deployed TagAgent bid token',()=>{
 for(const version of [1,3]){
  const c=getBasketProtocol(4663,version)
  assert.equal(c.feeAuction,'0xC2526404423ED03Ce8D2608F5b94300F0AafA1A2')
  // Confirmed via BasketFeeAuction.bidToken() on RH mainnet.
  assert.equal(c.bidToken,'0x6419cE35e915Fd62199C472a41e34dB55b56b89d')
 }
})
test('BSC auction bid token remains BUIDL across supported versions',()=>{
 for(const version of [2,3,4])assert.equal(getBasketProtocol(56,version).bidToken,'0x32ef878D527d860339818571E8DA17005110f04E')
})
