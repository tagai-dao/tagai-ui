import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {toFunctionSelector} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'v13-creation-'))
await build({stdin:{contents:"export * from './src/utils/v13/index-config.ts';export * from './src/config/chains.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),logLevel:'silent'})
const {validateIndexConfig,getChainDeployment}=createRequire(import.meta.url)(join(dir,'test.cjs'))
await rm(dir,{recursive:true,force:true})
const config=()=>({name:'测试指数',symbol:'TIDX',constituentAssets:['0x'+ '12'.repeat(20),'0x'+'34'.repeat(20)],targetWeights:[5000,5000],basketFeeBps:100,creatorShareBps:3000,retainCommunityOwnership:true})
test('BSC uses V13 while RH stays on V11 and legacy addresses are retained',()=>{
 const bsc=getChainDeployment(56),rh=getChainDeployment(4663)
 assert.equal(bsc.latestPumpVersion,13);assert.equal(rh.latestPumpVersion,11)
 assert.equal(bsc.contracts.pump13,'0x2c2f4e8D85c02a065f109c74d9b27186AE65Adfa')
 assert.equal(bsc.contracts.pump11,'0x8fEF5b4c0f761a0cc447800e3019B089ac306F28')
 assert.equal(rh.contracts.pump13,undefined)
})
test('valid index config accepts exact bps sum',()=>assert.doesNotThrow(()=>validateIndexConfig(config())))
test('UTF-8 byte limits apply to multibyte names',()=>{const c=config();c.name='中'.repeat(22);assert.throws(()=>validateIndexConfig(c))})
for(const [name,patch]of [['duplicate assets',c=>c.constituentAssets[1]=c.constituentAssets[0]],['bad weight sum',c=>c.targetWeights=[5000,4999]],['zero weight',c=>c.targetWeights=[10000,0]],['invalid fee',c=>c.basketFeeBps=99],['invalid share',c=>c.creatorShareBps=3001]])test(name,()=>{const c=config();patch(c);assert.throws(()=>validateIndexConfig(c))})
test('creation ABI distinguishes V13 tuple overload from disabled legacy selector',async()=>{
 const abi=JSON.parse(await readFile('src/utils/v13/Pump13.json','utf8'))
 const methods=abi.filter(x=>x.type==='function'&&x.name==='createToken')
 assert.equal(methods.length,2)
 const v13=methods.find(x=>x.inputs.length===3)
 assert.equal(v13.inputs[2].components.length,7)
 assert.notEqual(toFunctionSelector(v13),toFunctionSelector(methods.find(x=>x.inputs.length===2)))
})
