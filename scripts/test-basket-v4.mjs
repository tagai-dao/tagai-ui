import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {toFunctionSelector,toEventSelector} from 'viem'
const dir=await mkdtemp(join(tmpdir(),'basket-v4-'))
await build({entryPoints:['src/utils/baskets/abis.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'abis.cjs'),logLevel:'silent'})
const abis=createRequire(import.meta.url)(join(dir,'abis.cjs'))
await rm(dir,{recursive:true,force:true})
const outputType=x=>x.type.startsWith('tuple')?`${x.type}(${(x.components||[]).map(outputType).join(',')})`:x.type
for(const [name,file]of [['bscV3BasketTokenAbi','BasketToken4'],['bscV3BasketSwapRouterAbi','BasketSwapRouter4'],['bscV3RebalanceExecutorAbi','BasketRebalanceExecutor4']])test(`${name} selectors and outputs match V4 artifacts`,async()=>{
 const artifact=JSON.parse(await readFile(`src/utils/v13/${file}.json`,'utf8'))
 for(const item of abis[name]){
  if(!['function','event'].includes(item.type))continue
  const selector=item.type==='function'?toFunctionSelector:toEventSelector
  const target=artifact.find(f=>f.type===item.type&&selector(f)===selector(item))
  assert.ok(target,`Missing ${item.name}`)
  if(item.type==='function')assert.deepEqual(item.outputs.map(outputType),target.outputs.map(outputType),item.name)
 }
})
