import {createPublicClient,http,keccak256,toHex,parseAbi,isAddress} from 'viem';
import {bsc} from 'viem/chains';
export const REGISTRY='0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F';
export const MULTICALL='0xcA11bde05977b3631167028862bE2a173976CA11';
export const registryAbi=parseAbi(['function handleOf(address) view returns (string)','function ownerOf(uint256) view returns (address)']);
export function createChainClient(){const rpc=process.env.BSC_RPC_URL||'https://bsc-dataseed2.binance.org';const url=new URL(rpc);if(!['https:','http:'].includes(url.protocol))throw Error('Invalid BSC_RPC_URL');return createPublicClient({chain:bsc,transport:http(rpc,{timeout:12000,retryCount:0})});}
export async function resolveAgent(input,client=createChainClient()){
 const q=String(input).trim();const address=isAddress(q);const name=q.toLowerCase().replace(/\.ai$/,'')+'.ai';
 if(!address&&!/^[a-z0-9-]{3,32}\.ai$/.test(name))throw new Error('请输入3–32位 Agent ID 或完整 EVM 地址');
 const blockNumber=await client.getBlockNumber();
 const contract={address:REGISTRY,abi:registryAbi,functionName:address?'handleOf':'ownerOf',args:address?[q]:[BigInt(keccak256(toHex(name.slice(0,-3))))]};
 const [result]=await client.multicall({multicallAddress:MULTICALL,blockNumber,allowFailure:true,contracts:[contract]});
 if(!result||result.status!=='success'){
  // Only an actual contract revert can mean unregistered. Transport/decoding failures stay errors.
  let error=result?.error;while(error){if(error.name==='ContractFunctionRevertedError')return null;error=error.cause;}
  throw new Error('BSC 链上读取失败，请稍后重试');
 }
 if(address){if(!result.result)return null;if(typeof result.result!=='string'||!/^[a-z0-9-]{3,32}$/i.test(result.result))throw new Error('链上名称响应无效');return {name:result.result.toLowerCase()+'.ai',owner:q.toLowerCase(),chainVerified:true,source:'BSC Multicall · handleOf',block:Number(blockNumber),checkedAt:new Date().toISOString()};}
 if(typeof result.result!=='string'||!isAddress(result.result)||/^0x0{40}$/i.test(result.result))throw new Error('链上归属响应无效');
 return {name,owner:result.result.toLowerCase(),chainVerified:true,source:'BSC Multicall · ownerOf(name hash)',block:Number(blockNumber),checkedAt:new Date().toISOString()};
}
