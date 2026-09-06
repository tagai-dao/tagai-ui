import { createPublicClient, fallback, http, parseAbi, type Abi, type Address, type PublicClient } from 'viem'
import { getChainDeployment } from '@/config/chains'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { getChainById } from '@/utils/privy'
import { getReadOnlyClient, getWalletClient, setup, waitForTx } from '@/utils/wallets'

export const indexBrokerNftAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function factory() view returns (address)',
  'function community() view returns (address)',
  'function communityToken() view returns (address)',
  'function fundsReceiver() view returns (address)',
  'function renderer() view returns (address)',
  'function ammVault() view returns (address)',
  'function indexToken() view returns (address)',
  'function indexMiningToken() view returns (address)',
  'function communityTokenPrice() view returns (uint256)',
  'function indexMiningActivationTokenAmount() view returns (uint256)',
  'function minimumIndexMiningWeight() view returns (uint256)',
  'function nativePrice() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function referralBps() view returns (uint16)',
  'function rerollEnabled() view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function getApproved(uint256) view returns (address)',
  'function approve(address,uint256)',
  'function levelCount() view returns (uint256)',
  'function levelThresholds(uint256) view returns (uint256)',
  'function levelWeights(uint256) view returns (uint256)',
  'function getUserStakedAmount(address) view returns (uint256)',
  'function getTotalStakedAmount() view returns (uint256)',
  'function getNFTInfo(uint256 tokenId) view returns ((address owner,uint32 level,uint256 referrerTokenId,uint256 referralCount,uint256 miningWeight,bool miningActive,bool indexMiningActive,uint256 indexMiningWeight,uint256 pendingIndexRewards,uint256 seed,uint256 revealBlock,uint256 revealRound,bool revealPending) info)',
  'function tokensOfOwner(address account,uint256 offset,uint256 limit) view returns (uint256[])',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function tokenSVG(uint256 tokenId) view returns (string)',
  'function remainingWhitelistMints(address account) view returns (uint256)',
  'function remainingPaidMints() view returns (uint256)',
  'function totalActiveIndexMiningWeight() view returns (uint256)',
  'function queuedIndexRewards() view returns (uint256)',
  'function mint(uint256 referrerTokenId) payable returns (uint256)',
  'function reveal(uint256 tokenId) returns (uint256)',
  'function commitReveal(uint256 tokenId)',
  'function activateIndexMining(uint256 tokenId)',
  'function upgradeIndexMining(uint256 tokenId,uint256 tokenAmount)',
  'function stakingToken() view returns (address)',
  'function stakeIndexMining(uint256 tokenId,uint256 tokenAmount)',
  'function unstakeIndexMining(uint256 tokenId,uint256 tokenAmount)',
  'function claimIndexRewards(uint256 tokenId) returns (uint256)',
])

export const indexBrokerNftAmmAbi = parseAbi([
  'function active() view returns (bool)',
  'function inventoryCount() view returns (uint256)',
  'function oldestTokenId() view returns (uint256)',
  'function newestTokenId() view returns (uint256)',
  'function nextInventoryToken(uint256 tokenId) view returns (uint256)',
  'function tokensPerNFT() view returns (uint256)',
  'function normalFeeBps() view returns (uint16)',
  'function specificFeeBps() view returns (uint16)',
  'function quoteNativeValue() view returns (uint256)',
  'function quoteNormalNativeFee() view returns (uint256)',
  'function quoteSpecificNativeFee() view returns (uint256)',
  'function quotePlatformNativeFee() view returns (uint256)',
  'function sellNFT(uint256 tokenId) payable',
  'function buyNextNFT() payable returns (uint256)',
  'function buySpecificNFT(uint256 tokenId) payable',
])

export const erc20NutboxAbi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])

export const nutboxCommunityAbi = parseAbi([
  'function getPoolPendingRewards(address pool,address user) view returns (uint256)',
  'function withdrawPoolsRewards(address[] poolAddresses) payable',
])

export const nutboxCommitteeAbi = parseAbi([
  'function getPoolOperationFee() view returns (uint256)',
])

export const indexBrokerNftRendererAbi = parseAbi([
  'function renderSVG((string collectionName,uint256 tokenId,uint256 seed,uint256 referralCount,uint256 referrerTokenId,uint256 miningWeight,uint256 indexMiningWeight,uint256 indexMiningTokenUnit,uint32 level,bool miningActive,bool indexMiningActive) params) view returns (string)',
])

export const nutboxRouterAbi = parseAbi([
  'function quoteNative(address token,uint256 amount) view returns (uint256)',
])

// NFT screens read dozens of independent fields. JSON-RPC batching avoids a
// burst of HTTP connections; this does not require a Multicall deployment.
// Keep exported declarations portable: inferred client actions can reference
// viem internal types that cannot be named during composite declaration emit.
const nftClients = new Map<number, PublicClient>()
export const getNutboxReadClient = (chainId = useChainStore().activeChainId): PublicClient => {
  let client = nftClients.get(chainId)
  if (!client) {
    const deployment = getChainDeployment(chainId)
    client = createPublicClient({
      chain: getChainById(chainId),
      transport: fallback(
        (deployment.rpcUrls?.length ? deployment.rpcUrls : [deployment.rpc]).map(url =>
          http(url, { batch: { batchSize: 8, wait: 20 }, timeout: 8_000, retryCount: 0 })),
        { rank: false, retryCount: 1 },
      ),
    })
    nftClients.set(chainId, client)
  }
  return client
}

export const readNutboxContract = async <T = unknown>(
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> => getNutboxReadClient().readContract({
  address,
  abi,
  functionName,
  args,
} as any) as Promise<T>

export const writeNutboxContract = async (
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  value = 0n,
) => {
  const accountStore = useAccountStore()
  const wallet = getWalletClient()
  if (!wallet || !accountStore.ethConnectAddress) throw new Error('Connect wallet first')
  if (accountStore.getWalletType !== 'privy') await setup()

  const publicClient = getReadOnlyClient()
  const chain = getChainById(useChainStore().activeChainId)
  const { request } = await publicClient.simulateContract({
    account: accountStore.ethConnectAddress as Address,
    address,
    abi,
    functionName,
    args,
    value,
    chain,
  } as any)
  const estimate = await publicClient.estimateContractGas(request as any)
  const hash = await wallet.writeContract({ ...request, gas: estimate * 120n / 100n } as any)
  const receiptHash = await waitForTx(hash)
  if (!receiptHash) throw new Error('Transaction failed')
  return receiptHash
}

export const withFeeBuffer = (value: bigint) => value + value / 10n + 1n

const uniqueSources = (sources: string[]) => [...new Set(sources.filter(Boolean))]

/**
 * Return several public gateways instead of binding NFT artwork to one IPFS
 * provider.  The subdomain gateway is first because it is the same path used
 * by Nutbox and gives every CID its own origin/cache namespace.
 */
export const ipfsHttpCandidates = (value: string) => {
  if (!value.startsWith('ipfs://')) return value ? [value] : []
  const raw = value.slice(7).replace(/^ipfs\//, '')
  const [cid, ...pathParts] = raw.split('/').filter(Boolean)
  if (!cid) return []
  const suffix = pathParts.length ? `/${pathParts.join('/')}` : ''
  return uniqueSources([
    `https://${cid}.ipfs.4everland.io${suffix}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}${suffix}`,
    `https://ipfs.io/ipfs/${cid}${suffix}`,
  ])
}

export const ipfsToHttp = (value: string) => ipfsHttpCandidates(value)[0] || ''

const imageValueFromTokenUri = (uri: string) => {
  if (uri.startsWith('data:application/json;base64,')) {
    const json = JSON.parse(atob(uri.slice('data:application/json;base64,'.length)))
    return String(json.image || '')
  }
  if (uri.startsWith('data:application/json,')) {
    const json = JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)))
    return String(json.image || '')
  }
  return uri
}

/** Build an ordered image fallback chain from metadata and the on-chain SVG. */
export const imageCandidatesFromTokenUri = (uri: string, svg = '') => {
  try {
    const image = imageValueFromTokenUri(uri)
    const metadataSources = image.startsWith('ipfs://') ? ipfsHttpCandidates(image) : [image]
    return uniqueSources([...metadataSources, svgDataUrl(svg)])
  } catch {
    return uniqueSources([svgDataUrl(svg)])
  }
}

export const imageFromTokenUri = (uri: string) => {
  return imageCandidatesFromTokenUri(uri)[0] || ''
}

export const svgDataUrl = (svg: string) => svg
  ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  : ''
