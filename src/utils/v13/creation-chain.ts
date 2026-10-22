import { isAddress, parseAbi, zeroAddress, type Address, type PublicClient } from 'viem'
import { getChainDeployment } from '@/config/chains'
import bscCandidates from './creation-assets.json'
import rhCandidates from '../v14/rh-creation-assets.json'
import { sortBasketAssetOptions } from '@/utils/baskets/asset-order'
import type { CreationOptions } from './creation'

const pumpAbi = parseAbi([
  'function getIPShare() view returns (address)',
  'function nutboxCommittee() view returns (address)',
  'function createFee() view returns (uint256)',
  'function tokenImplementation() view returns (address)',
  'function approvedConstituent(address) view returns (bool)',
  'function optionalPoolFactories(address) view returns (string name, uint16 maxRewardRatio, bool enabled)',
])
const feeAbi = parseAbi([
  'function ipshareCreated(address) view returns (bool)',
  'function createFee() view returns (uint256)',
  'function getCreateCommunityFee() view returns (uint256)',
  'function getCommunitySettingsFee() view returns (uint256)',
  'function verifyContract(address) view returns (bool)',
])

/** Bootstrap fallback only. Candidates are never offered without on-chain approval. */
export async function readCreationOptions(client: PublicClient, creator: Address, selectedVersion?: 14 | 15 | 16): Promise<CreationOptions> {
  const chainId = client.chain?.id
  if (!chainId || ![56,4663].includes(chainId) || !isAddress(creator)) throw new Error('Invalid creation chain or account')
  const d = getChainDeployment(chainId), version = selectedVersion ?? d.latestPumpVersion
  if (![14, 15, 16].includes(version) || (chainId !== 56 && version !== 14)) throw new Error('Unsupported creation version')
  const pump = (version === 16 ? d.contracts.pump16 : version === 15 ? d.contracts.pump15 : d.contracts.pump14)
  const { tradeCurationFactory: factory } = d.contracts
  if (!pump || pump === zeroAddress) throw new Error('Creation is unavailable')
  const candidates = chainId === 4663 ? rhCandidates : bscCandidates
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
  if (String(implementation).toLowerCase() !== (version === 16 ? d.contracts.tokenImplementation16 : version === 15 ? d.contracts.tokenImplementation15 : d.contracts.tokenImplementation14)?.toLowerCase()) throw new Error('Token template changed; refresh the app')
  if (!factory) throw new Error('Trade pool factory is missing')
  const [hasShare, ipFee, communityFee, settingsFee, registration, verified] = await client.multicall({
    blockNumber, allowFailure: false,
    contracts: [
      { address: ipshare as Address, abi: feeAbi, functionName: 'ipshareCreated', args: [creator] },
      { address: ipshare as Address, abi: feeAbi, functionName: 'createFee' },
      { address: committee as Address, abi: feeAbi, functionName: 'getCreateCommunityFee' },
      { address: committee as Address, abi: feeAbi, functionName: 'getCommunitySettingsFee' },
      { address: pump, abi: pumpAbi, functionName: 'optionalPoolFactories', args: [factory] },
      { address: committee as Address, abi: feeAbi, functionName: 'verifyContract', args: [factory] },
    ],
  })
  if ([15, 16].includes(version)) {
    const abi = parseAbi(['function operators(address) view returns(bool)', 'function approvedCreatorForwarders(address) view returns(bool)'])
    const router = version === 16 ? d.contracts.nutboxRouter16 : d.contracts.nutboxRouter15
    const registry = version === 16 ? d.contracts.basketRegistry16 : d.contracts.basketRegistry15
    if (!router || !registry) throw new Error(`V${version}_CREATION_NOT_READY`)
    const [operator, forwarder] = await client.multicall({blockNumber, allowFailure:false, contracts:[
      {address:router,abi,functionName:'operators',args:[pump]},
      {address:registry,abi,functionName:'approvedCreatorForwarders',args:[pump]},
    ]})
    if (!operator || !forwarder) throw new Error(`V${version}_CREATION_NOT_READY`)
  }
  return {
    chainId, version, pump, sourceBlock: Number(blockNumber), tokenImplementation: implementation as string,
    tradePool: { factory, enabled: registration[2] && verified === true, maxRewardRatio: Math.min(8000, Number(registration[1])) },
    assets: sortBasketAssetOptions(candidates.filter((_, i) => approved[i] === true).map(a => ({ ...a, address: a.address as Address }))),
    pumpFee: String(pumpFee), ipshareFee: hasShare ? '0' : String(ipFee), communityFee: String(communityFee), settingsFee: String(settingsFee),
  }
}
