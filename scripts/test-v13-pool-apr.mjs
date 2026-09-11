import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const dir=await mkdtemp(join(tmpdir(),'v13-apr-'))
const calculator='0x1111111111111111111111111111111111111111'
await build({entryPoints:['src/utils/v13/pool-apr.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'apr.cjs'),logLevel:'silent',plugins:[{name:'read-only-fixture',setup(b){
 b.onResolve({filter:/^(@\/utils\/wallets|@\/config\/chains)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`export const getReadOnlyClient=()=>globalThis.__aprClient;export const getChainDeployment=()=>({contracts:{hourlyTickCalculator:'${calculator}'}});`}))
}}]})
const {poolAprBps,readPoolRewards,annualizeRewards}=createRequire(import.meta.url)(join(dir,'apr.cjs'))
after(async()=>{delete globalThis.__aprClient;await rm(dir,{recursive:true,force:true})})
test('APR values both sides of staked LP, not all LP in circulation',()=>{
 // 10% of all LP is staked: 100 T + 100 T worth of stock; 1 T/day => 182.5% APR.
 assert.equal(poolAprBps(365n,1000n,100n,10n,true),18250n)
 assert.equal(poolAprBps(365n,1000n,100n,20n,true),9125n)
})
test('no stake or empty liquidity has no APR; inactive or zero rewards returns zero',()=>{
 for(const args of [[1n,100n,10n,0n],[1n,0n,10n,1n],[1n,100n,0n,1n]])assert.equal(poolAprBps(...args,true),undefined)
 assert.equal(poolAprBps(100n,100n,10n,1n,false),0n)
 assert.equal(poolAprBps(0n,100n,10n,1n,true),0n)
})
test('large token supplies use integer arithmetic with no loss from JS numbers',()=>{
 const scale=10n**30n
 assert.equal(poolAprBps(365n*scale,1000n*scale,100n*scale,10n*scale,true),18250n)
})
function fixture(ratio=8000n){
 const requests=[]
 globalThis.__aprClient={getBlock:async()=>({number:123n,timestamp:36123n}),getStorageAt:async p=>{requests.push(p);return '0x'+ratio.toString(16).padStart(64,'0')},readContract:async p=>{requests.push(p);return p.functionName==='feeRatio'?1000:p.functionName==='rewardCalculator'?calculator:p.args[2]-p.args[1]===3600n?10n:1000n}}
 return requests
}
const community='0x2222222222222222222222222222222222222222',pool='0x3333333333333333333333333333333333333333'
test('reads 24 hourly buckets at the chain clock, subtracts community fee and applies live pool ratio',async()=>{
 const requests=fixture(),r=await readPoolRewards(community,pool)
 assert.deepEqual(r,{hourly:7n,daily:720n,annual:262800n,ratio:8000,block:123n})
 assert.ok(requests.every(r=>r.blockNumber===123n))
 assert.deepEqual(requests.filter(r=>r.functionName==='calculateReward').map(r=>r.args),[[community,36000n,39600n],[community,36000n,122400n]])
})
test('zero allocation remains zero and unavailable ratio is not invented',async()=>{
 fixture(0n);assert.equal((await readPoolRewards(community,pool)).daily,0n)
 fixture();globalThis.__aprClient.getStorageAt=async()=>undefined
 await assert.rejects(readPoolRewards(community,pool),/RATIO_UNAVAILABLE/)
 fixture(10001n);await assert.rejects(readPoolRewards(community,pool),/RATIO_UNAVAILABLE/)
})
test('unknown calculator is not treated as an hourly schedule',async()=>{
 fixture();const read=globalThis.__aprClient.readContract
 globalThis.__aprClient.readContract=async p=>p.functionName==='rewardCalculator'?community:read(p)
 await assert.rejects(readPoolRewards(community,pool),/CALCULATOR_UNSUPPORTED/)
})

test('annualization chooses either horizon, including declining and increasing schedules',()=>{
 assert.equal(annualizeRewards(10n,100n),87600n)
 assert.equal(annualizeRewards(1n,100n),36500n)
 assert.equal(annualizeRewards(10n,240n),87600n)
 assert.equal(annualizeRewards(0n,0n),0n)
})
test('readPoolRewards selects the hourly projection when rewards expire during the day',async()=>{
 fixture();const read=globalThis.__aprClient.readContract
 globalThis.__aprClient.readContract=async p=>p.functionName==='calculateReward'?1000n:read(p)
 const r=await readPoolRewards(community,pool)
 assert.equal(r.hourly,720n)
 assert.equal(r.daily,720n)
 assert.equal(r.annual,6307200n)
})
