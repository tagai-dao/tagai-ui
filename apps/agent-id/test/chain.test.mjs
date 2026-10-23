import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keccak256,toHex} from 'viem';
import {resolveAgent,REGISTRY,MULTICALL} from '../server/chain.mjs';
const owner='0x309101721cc2c614d3684751a00a5cca2b98bb9e';
function client(result,check=()=>{}){return {getBlockNumber:async()=>129229515n,multicall:async call=>{assert.equal(call.multicallAddress,MULTICALL);assert.equal(call.blockNumber,129229515n);assert.equal(call.contracts.length,1);assert.equal(call.contracts[0].address,REGISTRY);check(call.contracts[0]);return [result];}};}
test('name is read via pinned Multicall ownerOf, not the cached owner',async()=>{const r=await resolveAgent('TagAI.ai',client({status:'success',result:owner},c=>{assert.equal(c.functionName,'ownerOf');assert.deepEqual(c.args,[BigInt(keccak256(toHex('tagai')))]);}));assert.equal(r.owner,owner);assert.equal(r.name,'tagai.ai');assert.equal(r.block,129229515);});
test('address uses the same pinned Multicall registry target',async()=>{const r=await resolveAgent(owner,client({status:'success',result:'tagai'},c=>{assert.equal(c.functionName,'handleOf');assert.deepEqual(c.args,[owner]);}));assert.equal(r.name,'tagai.ai');});
test('missing names require a contract revert; infrastructure errors are never absence',async()=>{assert.equal(await resolveAgent('missing.ai',client({status:'failure',error:{cause:{name:'ContractFunctionRevertedError'}}})),null);await assert.rejects(()=>resolveAgent('tagai.ai',client({status:'failure',error:new Error('RPC down')})),/读取失败/);});
test('invalid inputs never invoke the RPC',async()=>{await assert.rejects(()=>resolveAgent('https://example.com',{getBlockNumber:()=>assert.fail('RPC must not run')}),/请输入/);});
