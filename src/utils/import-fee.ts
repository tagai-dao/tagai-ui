import { parseAbi, type Address, type PublicClient } from 'viem'

export const IMPORT_MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const committeeAbi = parseAbi(['function getCreateCommunityFee() view returns(uint256)', 'function getCommunitySettingsFee() view returns(uint256)'])
const helperAbi = parseAbi(['function VERSION() view returns(uint256)', 'function defaultPoolCount() view returns(uint256)'])
const shareAbi = parseAbi(['function ipshareCreated(address) view returns(bool)', 'function createFee() view returns(uint256)'])
export type ImportCommunityFee = { createFee: bigint; settingsFee: bigint; ipshareCreateFee: bigint; total: bigint; createsIPShare: boolean }

/** One required Multicall snapshot for both chains. No per-contract RPC fallback. */
export async function readImportFee(client: PublicClient, config: {
  committee: Address; helper: Address; ipshare: Address; importer: Address;
  enhanced: boolean; v2: boolean;
}): Promise<ImportCommunityFee> {
  const blockNumber = await client.getBlockNumber()
  const contracts: any[] = ['getCreateCommunityFee', 'getCommunitySettingsFee'].map(functionName => ({ address: config.committee, abi: committeeAbi, functionName }))
  if (config.v2) contracts.push(...['VERSION', 'defaultPoolCount'].map(functionName => ({ address: config.helper, abi: helperAbi, functionName })))
  if (config.enhanced) contracts.push({ address: config.ipshare, abi: shareAbi, functionName: 'ipshareCreated', args: [config.importer] }, { address: config.ipshare, abi: shareAbi, functionName: 'createFee' })
  const values = await client.multicall({ multicallAddress: IMPORT_MULTICALL, blockNumber, allowFailure: false, contracts }) as unknown[]
  if (values.length !== contracts.length || values.some(v => v === undefined)) throw new Error('Incomplete import fee Multicall')
  const [createFee, settingsFee] = values as bigint[]
  let poolCount = 1n
  if (config.v2) {
    if (values[2] !== 2n) throw new Error('Unexpected import helper version')
    poolCount = values[3] as bigint
    if (poolCount < 1n || poolCount > 6n) throw new Error('Invalid default import pool count')
  }
  const offset = config.v2 ? 4 : 2
  const createsIPShare = config.enhanced && values[offset] === false
  const ipshareCreateFee = createsIPShare ? values[offset + 1] as bigint : 0n
  return { createFee, settingsFee, ipshareCreateFee, createsIPShare, total: createFee + settingsFee * poolCount + ipshareCreateFee }
}
