import { parseAbi, parseEther, type Address, type PublicClient } from 'viem'
import { getIndexDeployment } from './chain'
import { stateSlot, decodeSlot0 } from './uniswap-state'

const stateAbi=parseAbi(['function getSlot0(bytes32) view returns(uint160,int24,uint24,uint24)','function extsload(bytes32) view returns(bytes32)'])
export async function readIndexTokenStates(client:PublicClient,chainId:number,tokens:string[],versions:Record<string,number>) {
  const blockNumber=await client.getBlockNumber()
  const states=await client.multicall({blockNumber,allowFailure:true,contracts:tokens.flatMap(token=>
    ['listed','listingPending','bondingCurveSupply','v4PoolId'].map(functionName=>({address:token as Address,abi:getIndexDeployment(chainId,Number(versions[token])).tokenAbi,functionName})),
  )})
  const result:Record<string,any>={},prices:any[]=[],owners:string[]=[]
  for(let i=0;i<tokens.length;i++) {
    const values=states.slice(i*4,i*4+4)
    if(values.slice(0,3).some(v=>v.status!=='success'))continue
    const token=tokens[i],profile=getIndexDeployment(chainId,Number(versions[token]))
    const listed=values[0].result===true,supply=values[2].result as bigint
    result[token]={bondingCurveSupply:supply,listed,listingPending:values[1].result===true}
    if(listed&&values[3].status!=='success')continue
    owners.push(token)
    prices.push(listed?{address:profile.deployment.dex.v4PoolManager,abi:stateAbi,functionName:chainId===4663?'extsload':'getSlot0',args:[chainId===4663?stateSlot(values[3].result as `0x${string}`):values[3].result]}:
      {address:profile.pump,abi:profile.pumpAbi,functionName:'getPrice',args:[supply,parseEther('1')]})
  }
  const values=await client.multicall({blockNumber,allowFailure:true,contracts:prices})
  values.forEach((value,i)=>{
    if(value.status!=='success')return
    const state=result[owners[i]]
    if(!state.listed)state.price=Number(value.result as bigint)/1e18
    else {
      const sqrt=chainId===4663?decodeSlot0(value.result as `0x${string}`)[0]:(value.result as readonly bigint[])[0]
      if(sqrt>0n)state.price=Number(2n**192n)/Number(sqrt*sqrt)
    }
  })
  return result
}
