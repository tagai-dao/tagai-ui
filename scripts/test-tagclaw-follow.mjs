import assert from 'node:assert/strict'
import {tagclawSourceHash,verifiedTagclawSource} from '../src/utils/tagclawFollow.mjs'
const hash='0x'+'11'.repeat(32),token='0x'+'22'.repeat(20),wallet='0x'+'33'.repeat(20)
const data={success:true,status:'accepted',chainId:56,txHash:hash,token,wallet,origin:wallet,ipshareSubject:wallet,handle:'caller.ai',curationSourceId:'tr_'+'0'.repeat(50)+'_00000002'}
assert.equal(verifiedTagclawSource(data,hash,token,56).ipshareSubject,wallet)
assert.equal(tagclawSourceHash(hash.toUpperCase().replace('0X','0x')),hash)
for(const change of [{status:'queued'},{origin:token},{ipshareSubject:token},{token:wallet},{chainId:4663},{curationSourceId:'post-untrusted'}])assert.throws(()=>verifiedTagclawSource({...data,...change},hash,token,56),/MISMATCH/)
assert.throws(()=>tagclawSourceHash(['hash']),/INVALID/)
console.log('TagClaw follow source tests passed')
