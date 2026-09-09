import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {applyTickBudget}=createRequire(import.meta.url)('./vendor/tick-budget.cjs')
const ticks=Array.from({length:128},(_,i)=>(i-64)*10)
const dense=id=>({id,kind:'v3',ticks:[...ticks],coverageLower:-640,coverageUpper:630})
test('four component routes exceeding 512 ticks share the budget without dropping pools',()=>{
 const pools=[{id:'main',kind:'v4',ticks:[-600,600]},...Array.from({length:5},(_,i)=>dense(String(i))),{id:'pair',kind:'v2'}]
 const current=new Map(pools.map(p=>[p.id,0]));applyTickBudget(pools,current)
 assert.equal(pools.length,7);assert.equal(pools.reduce((n,p)=>n+(p.ticks?.length||0),0),512)
 assert.deepEqual(pools[0].ticks,[-600,600]);assert.deepEqual(pools.slice(1,6).map(p=>p.ticks.length),[102,102,102,102,102])
})
test('every initialized tick inside each declared window is retained',()=>{
 for(const price of [-500,-11,0,7,510]){
  const pools=Array.from({length:6},(_,i)=>dense(String(i))),current=new Map(pools.map(p=>[p.id,price]));applyTickBudget(pools,current)
  for(const pool of pools){assert.ok(pool.coverageLower<=price&&pool.coverageUpper>price);assert.deepEqual(ticks.filter(t=>t>=pool.coverageLower&&t<=pool.coverageUpper),pool.ticks)}
 }
})
test('metadata within budget keeps the original tick coverage',()=>{
 const pools=[dense('a'),dense('b')],before=structuredClone(pools);applyTickBudget(pools,new Map([['a',0],['b',0]]));assert.deepEqual(pools,before)
})
test('one-sided initialized ticks do not invent coverage on the other side',()=>{
 const pools=Array.from({length:6},(_,i)=>({...dense(String(i)),ticks:ticks.map(t=>t+1000)}));applyTickBudget(pools,new Map(pools.map(p=>[p.id,0])))
 for(const pool of pools){assert.equal(pool.coverageLower,0);assert.ok(pool.ticks.every(t=>t>0));assert.equal(pool.coverageUpper,pool.ticks.at(-1))}
})
