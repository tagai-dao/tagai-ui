import { encodeAbiParameters, keccak256, toHex, type Hex } from 'viem'

// Uniswap v4-core StateLibrary: pools=6, liquidity=3, ticks=4, bitmap=5.
export const stateSlot = (poolId: Hex): Hex => keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[poolId,6n]))
export const liquiditySlot = (poolId: Hex): Hex => toHex(BigInt(stateSlot(poolId))+3n,{size:32})
const mappingSlot = (poolId: Hex, offset: bigint, key: number): Hex => keccak256(encodeAbiParameters(
  [{type:'int256'},{type:'bytes32'}],[BigInt(key),toHex(BigInt(stateSlot(poolId))+offset,{size:32})],
))
export const tickSlot = (poolId: Hex, tick: number): Hex => mappingSlot(poolId,4n,tick)
export const bitmapSlot = (poolId: Hex, word: number): Hex => mappingSlot(poolId,5n,word)
export const decodeSlot0 = (raw: Hex) => {
  const n=BigInt(raw)
  return [n&((1n<<160n)-1n),Number(BigInt.asIntN(24,n>>160n)),Number((n>>184n)&0xffffffn),Number((n>>208n)&0xffffffn)] as const
}
export const decodeTick = (raw: Hex) => ({liquidityGross:BigInt(raw)&((1n<<128n)-1n),liquidityNet:BigInt.asIntN(128,BigInt(raw)>>128n)})
