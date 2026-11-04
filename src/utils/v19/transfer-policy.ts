import { isAddress, parseAbi, zeroAddress, type Address, type PublicClient } from 'viem'

const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function listed() view returns (bool)',
  'function nutboxCommunity() view returns (address)',
])
export type V19TransferState = {
  token: Address; account: Address; balance: bigint; listed: boolean; community: Address; blockNumber: bigint
}

/** Balance and the sole pre-list recipient come from one required, fixed-block Multicall. */
export async function readV19TransferState(client: PublicClient, token: Address, account: Address): Promise<V19TransferState> {
  if (client.chain?.id !== 56 || !isAddress(token) || !isAddress(account)
      || token === zeroAddress || account === zeroAddress) throw new Error('V19_TRANSFER_UNAVAILABLE')
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
  const [balance, listed, community] = await client.multicall({
    blockNumber, multicallAddress: MULTICALL, batchSize: 0, allowFailure: false,
    contracts: [
      { address: token, abi, functionName: 'balanceOf', args: [account] },
      { address: token, abi, functionName: 'listed' },
      { address: token, abi, functionName: 'nutboxCommunity' },
    ],
  })
  if (typeof balance !== 'bigint' || typeof listed !== 'boolean' || !isAddress(community) || community === zeroAddress)
    throw new Error('V19_TRANSFER_UNAVAILABLE')
  return { token, account, balance, listed, community, blockNumber }
}

export function allowsV19Transfer(state: V19TransferState | undefined, recipient: string): boolean {
  return !!state && isAddress(recipient) && recipient.toLowerCase() !== zeroAddress
    && (state.listed || recipient.toLowerCase() === state.community.toLowerCase())
}
