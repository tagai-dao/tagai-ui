const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value)
export function tagclawSourceHash(value){
 if(typeof value!=='string'||!/^0x[0-9a-f]{64}$/i.test(value))throw new Error('INVALID_TAGCLAW_SOURCE')
 return value.toLowerCase()
}
export function verifiedTagclawSource(data,hash,token,chainId){
 if(chainId!==56||!data||data.success!==true||data.status!=='accepted'||data.chainId!==56
  ||data.txHash?.toLowerCase()!==tagclawSourceHash(hash)||!address(data.wallet)||!address(data.token)
  ||data.token.toLowerCase()!==token.toLowerCase()||data.origin?.toLowerCase()!==data.wallet.toLowerCase()
  ||data.ipshareSubject?.toLowerCase()!==data.wallet.toLowerCase()||typeof data.handle!=='string'||!data.handle
  ||!/^tr_[0-9a-z]{50}_[0-9a-f]{8}$/.test(data.curationSourceId??''))throw new Error('TAGCLAW_SOURCE_MISMATCH')
 return {sourceId:data.curationSourceId,txHash:data.txHash,token:data.token,ipshareSubject:data.wallet,handle:data.handle}
}
