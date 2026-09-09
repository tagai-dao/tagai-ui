import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {encodeAbiParameters,keccak256} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'pump-salt-'))
await build({stdin:{contents:"export * from './src/utils/pumpSaltSearch.ts';export * from './src/utils/ozClones.ts';export {getChainDeployment} from './src/config/chains.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),logLevel:'silent'})
const {createSaltSearcher,predictDeterministicAddress,getChainDeployment}=createRequire(import.meta.url)(join(dir,'test.cjs'))
await rm(dir,{recursive:true,force:true})
const creator='0x76B713f30734450CE566C170Fda27E8dce63b1F6'
const reference=(c,salt)=>predictDeterministicAddress(c.tokenImplementation,keccak256(encodeAbiParameters([{type:'address'},{type:'bytes32'}],[c.deployer,salt])),c.pump)
for(const version of [9,11,13])test(`optimized search preserves CREATE2 prediction for V${version}`,()=>{
 const addresses=getChainDeployment(56).contracts,c={pump:addresses['pump'+version],tokenImplementation:addresses['tokenImplementation'+version],deployer:creator}
 const search=createSaltSearcher(c,0n);const salt=search(500000);assert.ok(salt);assert.ok(reference(c,salt).toLowerCase().endsWith('3333'))
})
test('chunking preserves search cursor and byte carries',()=>{
 const c={pump:'0x'+'12'.repeat(20),tokenImplementation:'0x'+'34'.repeat(20),deployer:'0x'+'56'.repeat(20)}
 const start=0xffffn,single=createSaltSearcher(c,start)(500000),chunked=createSaltSearcher(c,start);let found
 for(let n=0;n<500000&&!found;n+=1000)found=chunked(1000)
 assert.equal(found,single);assert.ok(reference(c,found).toLowerCase().endsWith('3333'));assert.ok(BigInt(found)>start)
})
test('uint256 overflow is rejected rather than reusing zero salt',()=>{
 const c={pump:'0x'+'12'.repeat(20),tokenImplementation:'0x'+'34'.repeat(20),deployer:'0x'+'56'.repeat(20)}
 assert.throws(()=>createSaltSearcher(c,(1n<<256n)-1n)(1),/overflow/)
})
