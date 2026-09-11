import { isAddress, parseAbi, zeroAddress, type Address, type PublicClient } from 'viem'
import { getChainDeployment } from '@/config/chains'
import candidates from './creation-assets.json'
import { sortBasketAssetOptions } from '@/utils/baskets/asset-order'
import type { CreationOptions } from './creation'

const pumpAbi = parseAbi([
  'function getIPShare() view returns (address)',
  'function nutboxCommittee() view returns (address)',
  'function createFee() view returns (uint256)',
  'function tokenImplementation() view returns (address)',
  'function approvedConstituent(address) view returns (bool)',
])
const feeAbi = parseAbi([
  'function ipshareCreated(address) view returns (bool)',
  'function createFee() view returns (uint256)',
  'function getCreateCommunityFee() view returns (uint256)',
  'function getCommunitySettingsFee() view returns (uint256)',
])

/** Bootstrap fallback only. Candidates are never offered without on-chain approval. */
export async function readCreationOptions(client: PublicClient, creator: Address): Promise<CreationOptions> {
  if (client.chain?.id !== 56 || !isAddress(creator)) throw new Error('Invalid creation chain or account')
  const pump = getChainDeployment(56).contracts.pump13
  if (!pump || pump === zeroAddress) throw new Error('Creation is unavailable')
  const blockNumber = await client.getBlockNumber()
  const [ipshare, committee, pumpFee, implementation, ...approved] = await client.multicall({
    blockNumber, allowFailure: false,
    contracts: [
      ...(['getIPShare', 'nutboxCommittee', 'createFee', 'tokenImplementation'] as const)
        .map(functionName => ({ address: pump, abi: pumpAbi, functionName })),
      ...candidates.map(asset => ({ address: pump, abi: pumpAbi, functionName: 'approvedConstituent' as const, args: [asset.address as Address] })),
    ],
  })
  if (![ipshare, committee, implementation].every(a => typeof a === 'string' && isAddress(a) && a !== zeroAddress)) {
    throw new Error('Incomplete creation contracts')
  }
  const [hasShare, ipFee, communityFee, settingsFee] = await client.multicall({
    blockNumber, allowFailure: false,
    contracts: [
      { address: ipshare as Address, abi: feeAbi, functionName: 'ipshareCreated', args: [creator] },
      { address: ipshare as Address, abi: feeAbi, functionName: 'createFee' },
      { address: committee as Address, abi: feeAbi, functionName: 'getCreateCommunityFee' },
      { address: committee as Address, abi: feeAbi, functionName: 'getCommunitySettingsFee' },
    ],
  })
  return {
    chainId: 56, version: 13, pump, sourceBlock: Number(blockNumber), tokenImplementation: implementation as string,
    assets: sortBasketAssetOptions(candidates.filter((_, i) => approved[i] === true).map(a => ({ ...a, address: a.address as Address }))),
    pumpFee: String(pumpFee), ipshareFee: hasShare ? '0' : String(ipFee), communityFee: String(communityFee), settingsFee: String(settingsFee),
  }
}
