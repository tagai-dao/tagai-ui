import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {createPublicClient,custom,parseAbi,decodeFunctionData,encodeFunctionResult} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'import-v2-'))
await build({entryPoints:['src/utils/import-fee.ts','src/config/chains.ts'],outdir:dir,bundle:true,platform:'node',format:'cjs',define:{'import.meta.env':'{}'},logLevel:'silent'})
const require=createRequire(import.meta.url),{readImportFee,IMPORT_MULTICALL}=require(join(dir,'utils/import-fee.js')),{getChainDeployment}=require(join(dir,'config/chains.js'))
after(()=>rm(dir,{recursive:true,force:true}))
const abi=parseAbi(['function getCreateCommunityFee() view returns(uint256)','function getCommunitySettingsFee() view returns(uint256)','function VERSION() view returns(uint256)','function defaultPoolCount() view returns(uint256)'])
const mc=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns((bool success,bytes returnData)[])'])
for(const chainId of [56,4663]) test(`${chainId}: actual eth_call targets Multicall3, ordered children and fixed block; no IPShare calls`,async()=>{
  const d=getChainDeployment(chainId),requests=[]
  const client=createPublicClient({transport:custom({request:async({method,params})=>{
    requests.push({method,params})
    if(method==='eth_blockNumber')return '0x64'
    assert.equal(method,'eth_call');assert.equal(params[0].to.toLowerCase(),IMPORT_MULTICALL.toLowerCase());assert.equal(params[1],'0x64')
    const children=decodeFunctionData({abi:mc,data:params[0].data}).args[0]
    assert.equal(children.length,4)
    const names=['getCreateCommunityFee','getCommunitySettingsFee','VERSION','defaultPoolCount']
    return encodeFunctionResult({abi:mc,functionName:'aggregate3',result:children.map((c,i)=>{
      assert.equal(c.target.toLowerCase(),(i<2?d.contracts.nutboxCommittee:d.contracts.importHelper).toLowerCase())
      assert.equal(decodeFunctionData({abi,data:c.callData}).functionName,names[i])
      return {success:true,returnData:encodeFunctionResult({abi,functionName:names[i],result:[100n,20n,2n,3n][i]})}
    })})
  }})})
  const fee=await readImportFee(client,{committee:d.contracts.nutboxCommittee,helper:d.contracts.importHelper,ipshare:d.contracts.ipshare3,importer:'0x'+'11'.repeat(20),enhanced:d.features.enhancedImportHelper,v2:true})
  assert.deepEqual(fee,{createFee:100n,settingsFee:20n,ipshareCreateFee:0n,total:160n,createsIPShare:false})
  assert.equal(requests.filter(r=>r.method==='eth_call').length,1)
})
test('failed required child or invalid helper/default count refuses fee without standalone RPC fallback',async()=>{
  for(const values of [[100n,20n,1n,1n],[100n,20n,2n,0n],[100n,20n,2n,7n],[100n,20n,2n,null]]) {
    let calls=0
    const client=createPublicClient({transport:custom({request:async({method,params})=>{
      if(method==='eth_blockNumber')return '0x64'
      assert.equal(method,'eth_call');calls++;assert.equal(params[0].to.toLowerCase(),IMPORT_MULTICALL.toLowerCase())
      return encodeFunctionResult({abi:mc,functionName:'aggregate3',result:decodeFunctionData({abi:mc,data:params[0].data}).args[0].map((c,i)=>({success:values[i]!==null,returnData:values[i]===null?'0x':encodeFunctionResult({abi,functionName:decodeFunctionData({abi,data:c.callData}).functionName,result:values[i]})}))})
    }})})
    const d=getChainDeployment(4663)
    await assert.rejects(readImportFee(client,{committee:d.contracts.nutboxCommittee,helper:d.contracts.importHelper,ipshare:d.contracts.ipshare3,importer:'0x'+'11'.repeat(20),enhanced:false,v2:true}))
    assert.equal(calls,1)
  }
})
test('RH uses deployed V2 address and exact two-address create selector',async()=>{
  assert.equal(getChainDeployment(4663).contracts.importHelper,'0x70eD7C79d80dEDE1828a09B3c526df283111Cb82')
  assert.equal(getChainDeployment(4663).features.enhancedImportHelper,false)
  const source=await readFile('src/utils/pump.ts','utf8')
  assert.match(source,/args = deployment.features.enhancedImportHelper[\s\S]*?: \[token, zeroAddress\]/)
  assert.match(source,/address: deployment.contracts.importHelper,[\s\S]*?beforeWrite:[\s\S]*?functionName: 'createCommunityAndPool'/)
  assert.match(source,/tx.logs.filter\(log => log.address.toLowerCase\(\) === helper.toLowerCase\(\)\)/)
})
