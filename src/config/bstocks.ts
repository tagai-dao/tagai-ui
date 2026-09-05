import { reactive } from 'vue'
import { isAddress, parseAbi, zeroAddress, type Address } from 'viem'
import { getChainDeployment } from '@/config/chains'
import { getReadOnlyClient } from '@/utils/wallets'

/**
 * Canonical BNB Chain bStocks contract addresses. RH is intentionally not
 * hard-coded: its supported set is read from the active ImportedTokenSwapWrapper
 * and NutboxRouter when the app starts.
 *
 * Community classification must use the token contract address, never the
 * community tick: imported communities may choose a different display symbol.
 */
export const BSC_BSTOCK_TOKEN_ADDRESSES = [
  '0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436', // NVIDIA
  '0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A', // Apple
  '0x5b1910eAaD6450E50f816082Aa078C41F10C292f', // Tesla
  '0x80f3D493EBCe97e343c53D29a137942416B4ffC0', // Circle
  '0xcdf2f3e0fa43C47A6662a91C9E4a7C5f69762699', // Micron
  '0x3eE4dF61bd4F867E349BEaE8bFE07bc31b4850fb', // SanDisk
  '0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0', // Microsoft
  '0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0', // Meta
  '0xCA750eF65f295BBECd685Abf54e82CAf297BDB61', // SK Hynix
  '0x1a4b499833A79A09ad7Cf1D42D7DacF71e92eb00', // Amazon
  '0x3F53De71c126BdaBAe20f9cD64848d317f6C3238', // Alphabet
  '0xbe9D156892E55e7154BcD3cB0FEA677F9D3103E1', // SpaceX
  '0x205812CdBed920aFf76C6580abD681a46D11efc7', // Invesco QQQ
  '0x7138b48df7D98D7e3cc221BfE7192D0a178182D8', // SPDR S&P 500 ETF
  '0x93862d63fd9Fd488B1328E9b47717d75e994a84B', // Roundhill Memory ETF
  '0x46cEeFDa28Dd7207059ed19B0acdc026955bb15C', // GameStop
  '0x64748bea17b6d19e242adf20425de2440c656142', // Litecoin ETF
  '0x0ca5d51d0277bd006fd9607d3e560785ebad8222', // Palantir
  '0x75fd4cf6f8392e41e70391d60c90c0d5211603a1', // AMD
  '0xbe82f76637dba2c114c41df856c2c51e522e2cb8', // iShares South Korea ETF
  '0xe614e2fc6c787035ff51f452e8e826bfd32d5283', // Intel
  '0xe87afb3076aeb0f9b14e368de8145ae6a2826a14', // MicroStrategy
  // Binance bStocks expansion (2026-07-15).
  '0x10343ef7da3301493d7ecb647d68a288c6c1db2f', // Applied Optoelectronics
  '0xd42a79ebb7f527f40faecd196ffb47ad5e8d6f8c', // Arm
  '0x76682c454467b3a1150ad8b6a92fc5ee2c21d7ed', // Broadcom
  '0x4ef9d3062c7f6eba4aae4990c5036598c6eff4ec', // Alibaba
  '0xa394dcea3fd3847fd793afbfd163e2e3858b7c65', // Robinhood
  '0xfa273b076feb8c0fb34e554ae341082323d016a3', // IBM
  '0x16cd4fe7e8880ecc3ba222795229e20489fc2c76', // Marvell
  '0x7c4d7a180d737dd5a70d8065a90e6746a69c37ea', // Nokia
  '0xc8da12cbcce7c45180692a6420b0076e03a5179a', // Rocket Lab
  '0xab78b89b5bb00236be0b4b20704cbfa04efc711c', // TSMC
  // Binance bStocks expansion (2026-09-02).
  '0x2e065f65f1699964f4092de1d39a8efe6c8d6f32', // Seagate
  '0x25e572b466d152604d9e6c3e53b432b978825342', // ProShares UltraPro Short QQQ
  '0x5fd86da9b05abe396fe9d02a4a213a7c00556503', // Moderna
  '0x814981cf5df4a14d4d7328f9abf0d02e9ed54cd1', // CrowdStrike
] as const

const BSC_BSTOCK_TOKEN_ADDRESS_SET = new Set<string>(
  BSC_BSTOCK_TOKEN_ADDRESSES.map((address) => address.toLowerCase()),
)

export const isBscBStockToken = (address?: string | null): boolean =>
  !!address && BSC_BSTOCK_TOKEN_ADDRESS_SET.has(address.toLowerCase())

const ROBINHOOD_CHAIN_ID = 4663
const importedTokenSwapWrapperAbi = parseAbi([
  'function nutboxRouter() view returns (address)',
])
const nutboxRouterAbi = parseAbi([
  'function wrappedNative() view returns (address)',
  'function hasRoute(address tokenIn, address tokenOut) view returns (bool)',
])

export type RobinhoodBStockRegistryStatus = 'idle' | 'loading' | 'loaded' | 'error'

/**
 * Mutable snapshots are replaced instead of edited so Vue computed values that
 * call isBStockCommunity() are invalidated after the on-chain reads complete.
 */
export const robinhoodBStockRegistry = reactive({
  status: 'idle' as RobinhoodBStockRegistryStatus,
  supportedTokens: new Set<string>(),
})

const checkedRobinhoodTokens = new Set<string>()
let pendingRobinhoodRefresh: Promise<ReadonlySet<string>> | null = null

const normalizeAddresses = (addresses: Iterable<string | null | undefined>): Address[] => {
  const unique = new Map<string, Address>()
  for (const address of addresses) {
    if (!address || !isAddress(address)) continue
    const normalized = address.toLowerCase()
    if (normalized === zeroAddress) continue
    unique.set(normalized, address as Address)
  }
  return [...unique.values()]
}

/**
 * Resolve which candidate RH tokens are currently supported by the Router.
 *
 * NutboxRouter does not expose an enumerable route list, so the frontend asks
 * hasRoute(token, wrappedNative) in one multicall for the imported communities
 * returned by the API. The Router address itself is read from the deployed
 * wrapper, keeping classification aligned with the contract used for trading.
 */
export async function refreshRobinhoodBStockRegistry(
  addresses: Iterable<string | null | undefined>,
  options: { force?: boolean } = {},
): Promise<ReadonlySet<string>> {
  const candidates = normalizeAddresses(addresses)

  if (pendingRobinhoodRefresh) {
    await pendingRobinhoodRefresh
    return refreshRobinhoodBStockRegistry(candidates, options)
  }

  const targets = options.force
    ? candidates
    : candidates.filter((address) => !checkedRobinhoodTokens.has(address.toLowerCase()))

  if (!targets.length) {
    if (robinhoodBStockRegistry.status === 'idle') robinhoodBStockRegistry.status = 'loaded'
    return robinhoodBStockRegistry.supportedTokens
  }

  robinhoodBStockRegistry.status = 'loading'
  pendingRobinhoodRefresh = (async () => {
    const deployment = getChainDeployment(ROBINHOOD_CHAIN_ID)
    const client = getReadOnlyClient(ROBINHOOD_CHAIN_ID)
    const router = await client.readContract({
      address: deployment.contracts.importedTokenSwapWrapper,
      abi: importedTokenSwapWrapperAbi,
      functionName: 'nutboxRouter',
    })
    if (!isAddress(router) || router === zeroAddress) {
      throw new Error('RH ImportedTokenSwapWrapper returned an invalid NutboxRouter')
    }

    const wrappedNative = await client.readContract({
      address: router,
      abi: nutboxRouterAbi,
      functionName: 'wrappedNative',
    })
    if (!isAddress(wrappedNative) || wrappedNative === zeroAddress) {
      throw new Error('RH NutboxRouter returned an invalid wrapped-native token')
    }

    const results = await client.multicall({
      allowFailure: true,
      contracts: targets.map((token) => ({
        address: router,
        abi: nutboxRouterAbi,
        functionName: 'hasRoute' as const,
        args: [token, wrappedNative] as const,
      })),
    })

    const nextSupported = new Set(robinhoodBStockRegistry.supportedTokens)
    targets.forEach((token, index) => {
      const normalized = token.toLowerCase()
      checkedRobinhoodTokens.add(normalized)
      if (results[index]?.status === 'success' && results[index].result === true) {
        nextSupported.add(normalized)
      } else if (options.force) {
        nextSupported.delete(normalized)
      }
    })
    robinhoodBStockRegistry.supportedTokens = nextSupported
    robinhoodBStockRegistry.status = 'loaded'
    return nextSupported
  })()

  try {
    return await pendingRobinhoodRefresh
  } catch (error) {
    robinhoodBStockRegistry.status = 'error'
    throw error
  } finally {
    pendingRobinhoodRefresh = null
  }
}

export const isRobinhoodBStockToken = (address?: string | null): boolean =>
  !!address && robinhoodBStockRegistry.supportedTokens.has(address.toLowerCase())

type BStockCommunityLike = {
  token?: string | null
  chainId?: number | string | null
  assetCategory?: string | null
  isStockToken?: boolean | null
}

/**
 * Seed canonical Robinhood stock addresses returned by the API registry.
 * This makes sibling TagCoin lists classify the same contracts immediately,
 * without waiting for the optional Router capability check.
 */
export function registerRobinhoodStockCommunities(communities: BStockCommunityLike[]) {
  const nextSupported = new Set(robinhoodBStockRegistry.supportedTokens)
  for (const community of communities) {
    if (community.assetCategory !== 'stock' && community.isStockToken !== true) continue
    if (community.token && isAddress(community.token)) nextSupported.add(community.token.toLowerCase())
  }
  robinhoodBStockRegistry.supportedTokens = nextSupported
}

/** Chain-aware bStock classification shared by the main and sidebar lists. */
export const isBStockCommunity = (
  community: BStockCommunityLike,
  fallbackChainId: number,
): boolean => {
  const declaredChainId = Number(community.chainId)
  const chainId = Number.isFinite(declaredChainId) && declaredChainId > 0
    ? declaredChainId
    : fallbackChainId

  const isOfficialStock = community.assetCategory === 'stock' || community.isStockToken === true
  if (chainId === 56) return isOfficialStock || isBscBStockToken(community.token)
  if (chainId !== ROBINHOOD_CHAIN_ID) return false

  const isRouterSupported = isRobinhoodBStockToken(community.token)
  if (robinhoodBStockRegistry.status === 'loaded') return isOfficialStock || isRouterSupported

  // Avoid briefly leaking stocks into TagCoin while the startup multicall is in flight.
  return isRouterSupported || isOfficialStock
}
