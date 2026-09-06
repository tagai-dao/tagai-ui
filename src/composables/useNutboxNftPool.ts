import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { formatUnits, getAddress, zeroAddress, type Address } from 'viem'
import { useAccountStore } from '@/stores/web3'
import { useChainStore } from '@/stores/chain'
import { resolveContractAddress } from '@/utils/contract'
import type { NutboxIndexBrokerPool } from '@/types/nutbox'
import { getNutboxNftRewardSummary } from '@/apis/nutbox'
import {
  erc20NutboxAbi,
  getNutboxReadClient,
  imageCandidatesFromTokenUri,
  indexBrokerNftAbi,
  indexBrokerNftAmmAbi,
  indexBrokerNftRendererAbi,
  nutboxCommitteeAbi,
  nutboxCommunityAbi,
  nutboxRouterAbi,
  readNutboxContract,
  svgDataUrl,
  withFeeBuffer,
  writeNutboxContract,
} from '@/utils/nutboxNft'

export interface NutboxNftInfo {
  tokenId: bigint
  image: string
  imageFallbacks: string[]
  owner: Address
  level: number
  referrerTokenId: bigint
  referralCount: bigint
  miningWeight: bigint
  miningActive: boolean
  indexMiningActive: boolean
  indexMiningWeight: bigint
  pendingIndexRewards: bigint
  seed: bigint
  revealBlock: bigint
  revealPending: boolean
  approved: Address
}

const toBigInt = (value: unknown) => {
  try { return BigInt(String(value ?? 0)) } catch { return 0n }
}

export const formatToken = (value: bigint, decimals = 18, maximumFractionDigits = 4) => {
  const numeric = Number(formatUnits(value, decimals))
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(numeric)
}

const safe = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
  try { return await promise } catch { return fallback }
}

const normalizeAddress = (value: string) => getAddress(value.toLowerCase())

export function useNutboxNftPool(pool: Ref<NutboxIndexBrokerPool> | { value: NutboxIndexBrokerPool }) {
  const accountStore = useAccountStore()
  const loading = ref(true)
  const ready = ref(false)
  const error = ref('')
  const action = ref('')
  const ownedNfts = ref<NutboxNftInfo[]>([])
  const inventory = ref<NutboxNftInfo[]>([])
  const mintPreviewImage = ref('')
  const state = reactive({
    name: '', symbol: '', communitySymbol: '', communityDecimals: 18,
    miningSymbol: '', miningDecimals: 18, indexSymbol: '', indexDecimals: 18,
    communityTokenPrice: 0n, activationPrice: 0n, minimumWeight: 0n,
    nativePrice: 0n, maxSupply: 0n, totalSupply: 0n, referralBps: 0,
    levelRules: [] as { level: number; threshold: bigint; weight: bigint }[],
    totalWeight: 0n, totalActiveIndexWeight: 0n, queuedRewards: 0n,
    whitelistRemaining: 0n, remainingPaidMints: 0n,
    communityBalance: 0n, miningBalance: 0n,
    mintAllowance: 0n, ammAllowance: 0n, miningAllowance: 0n,
    pendingCommunityRewards: 0n, poolOperationFee: 0n,
    holderPoolDailyRewards: 0n,
    injectedRewards24h: 0n, distributedRewards24h: 0n, burnedMiningTotal: 0n,
    rewardSummaryAvailable: false, indexNativeQuote: 0n, miningNativeQuote: 0n,
    ammActive: false, inventoryCount: 0n, oldestTokenId: 0n,
    tokensPerNft: 0n, normalFeeBps: 0, specificFeeBps: 0,
    normalFee: 0n, specificFee: 0n, platformFee: 0n, nativeValue: 0n,
    currentBlock: 0n,
  })
  const initialState = { ...state }
  let refreshTimer: number | undefined
  let pendingLoad: Promise<void> | undefined
  let disposed = false
  let loadedPoolAddress = ''
  let previewTokenId = 0n
  const previewSeed = (() => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
  })()

  const account = computed(() => accountStore.ethConnectAddress as Address | '')
  const connected = computed(() => Boolean(account.value))

  const nftInfo = async (tokenId: bigint): Promise<NutboxNftInfo | null> => {
    const address = normalizeAddress(pool.value.pool)
    const [raw, uri, svg, approved] = await Promise.all([
      safe(readNutboxContract<any>(address, indexBrokerNftAbi, 'getNFTInfo', [tokenId]), null),
      safe(readNutboxContract<string>(address, indexBrokerNftAbi, 'tokenURI', [tokenId]), ''),
      safe(readNutboxContract<string>(address, indexBrokerNftAbi, 'tokenSVG', [tokenId]), ''),
      safe(readNutboxContract<Address>(address, indexBrokerNftAbi, 'getApproved', [tokenId]), zeroAddress),
    ])
    if (!raw) return null
    const imageCandidates = imageCandidatesFromTokenUri(uri, svg)
    return {
      tokenId,
      image: imageCandidates[0] || '',
      imageFallbacks: imageCandidates.slice(1),
      owner: raw.owner ?? raw[0],
      level: Number(raw.level ?? raw[1] ?? 0),
      referrerTokenId: toBigInt(raw.referrerTokenId ?? raw[2]),
      referralCount: toBigInt(raw.referralCount ?? raw[3]),
      miningWeight: toBigInt(raw.miningWeight ?? raw[4]),
      miningActive: Boolean(raw.miningActive ?? raw[5]),
      indexMiningActive: Boolean(raw.indexMiningActive ?? raw[6]),
      indexMiningWeight: toBigInt(raw.indexMiningWeight ?? raw[7]),
      pendingIndexRewards: toBigInt(raw.pendingIndexRewards ?? raw[8]),
      seed: toBigInt(raw.seed ?? raw[9]),
      revealBlock: toBigInt(raw.revealBlock ?? raw[10]),
      revealPending: Boolean(raw.revealPending ?? raw[12]),
      approved,
    }
  }

  const loadOnce = async () => {
    const requestPool = pool.value
    if (!requestPool?.pool || !requestPool.amm) return
    const requestAccount = account.value
    const requestChain = useChainStore().activeChainId
    const isCurrent = () => !disposed && pool.value?.pool === requestPool.pool
      && account.value === requestAccount && useChainStore().activeChainId === requestChain
    const requestPoolAddress = `${requestChain}:${requestPool.pool.toLowerCase()}`
    // Keep the market interactive during the background refresh,
    // wallet updates, and post-transaction reloads. A blocking loading state is
    // only useful before this pool has rendered for the first time.
    if (loadedPoolAddress !== requestPoolAddress) {
      loading.value = true
      ready.value = false
      previewTokenId = 0n
      mintPreviewImage.value = ''
      ownedNfts.value = []
      inventory.value = []
      Object.assign(state, initialState)
    }
    error.value = ''
    try {
      const poolAddress = normalizeAddress(requestPool.pool)
      const ammAddress = normalizeAddress(requestPool.amm)
      const communityToken = normalizeAddress(requestPool.communityToken)
      const miningToken = normalizeAddress(requestPool.indexMiningToken || requestPool.communityToken)
      const indexToken = requestPool.indexToken ? normalizeAddress(requestPool.indexToken) : zeroAddress
      const committee = resolveContractAddress('NutboxCommittee')
      const reads = await Promise.all([
        safe(readNutboxContract<string>(poolAddress, indexBrokerNftAbi, 'name'), requestPool.name || 'NFT'),
        safe(readNutboxContract<string>(poolAddress, indexBrokerNftAbi, 'symbol'), requestPool.symbol || 'NFT'),
        safe<bigint | null>(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'communityTokenPrice'), null),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'indexMiningActivationTokenAmount'), toBigInt(requestPool.indexMiningActivationTokenAmount)),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'minimumIndexMiningWeight'), toBigInt(requestPool.minimumIndexMiningWeight)),
        safe<bigint | null>(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'nativePrice'), null),
        safe<bigint | null>(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'maxSupply'), null),
        safe<bigint | null>(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'totalSupply'), null),
        safe(readNutboxContract<number>(poolAddress, indexBrokerNftAbi, 'referralBps'), requestPool.referralBps || 0),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'getTotalStakedAmount'), 0n),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'totalActiveIndexMiningWeight'), toBigInt(requestPool.totalActiveIndexMiningWeight)),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'queuedIndexRewards'), toBigInt(requestPool.queuedIndexRewards)),
        safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'remainingPaidMints'), 0n),
        safe(readNutboxContract<Address>(poolAddress, indexBrokerNftAbi, 'renderer'), requestPool.renderer || zeroAddress),
        safe(readNutboxContract<number>(poolAddress, indexBrokerNftAbi, 'levelCount'), requestPool.levelThresholds?.length || 0),
        safe(readNutboxContract<string>(communityToken, erc20NutboxAbi, 'symbol'), 'TOKEN'),
        safe(readNutboxContract<number>(communityToken, erc20NutboxAbi, 'decimals'), 18),
        safe(readNutboxContract<string>(miningToken, erc20NutboxAbi, 'symbol'), 'TOKEN'),
        safe(readNutboxContract<number>(miningToken, erc20NutboxAbi, 'decimals'), 18),
        safe(readNutboxContract<string>(indexToken, erc20NutboxAbi, 'symbol'), 'INDEX'),
        safe(readNutboxContract<number>(indexToken, erc20NutboxAbi, 'decimals'), 18),
        safe(readNutboxContract<boolean>(ammAddress, indexBrokerNftAmmAbi, 'active'), Boolean(requestPool.ammActive)),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'inventoryCount'), toBigInt(requestPool.inventoryCount)),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'oldestTokenId'), toBigInt(requestPool.oldestTokenId)),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'tokensPerNFT'), toBigInt(requestPool.tokensPerNft)),
        safe(readNutboxContract<number>(ammAddress, indexBrokerNftAmmAbi, 'normalFeeBps'), requestPool.normalFeeBps || 0),
        safe(readNutboxContract<number>(ammAddress, indexBrokerNftAmmAbi, 'specificFeeBps'), requestPool.specificFeeBps || 0),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'quoteNormalNativeFee'), 0n),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'quoteSpecificNativeFee'), 0n),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'quotePlatformNativeFee'), 0n),
        safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'quoteNativeValue'), 0n),
        // Block height is only used for reveal eligibility, not pool pricing.
        safe(getNutboxReadClient(requestChain).getBlockNumber(), 0n),
      ])
      if (!isCurrent()) return
      const [name, symbol, communityTokenPrice, activationPrice, minimumWeight, nativePrice,
        maxSupply, totalSupply, referralBps, totalWeight, totalActiveIndexWeight, queuedRewards,
        remainingPaidMints, rendererAddress, levelCount, communitySymbol, communityDecimals, miningSymbol,
        miningDecimals, indexSymbol, indexDecimals, ammActive, inventoryCount, oldestTokenId, tokensPerNft, normalFeeBps,
        specificFeeBps, normalFee, specificFee, platformFee, nativeValue, currentBlock] = reads
      if (communityTokenPrice === null || nativePrice === null || maxSupply === null || totalSupply === null) {
        throw new Error(ready.value
          ? 'NFT network temporarily unavailable. Showing the last loaded data; retry to refresh.'
          : 'NFT network temporarily unavailable. Please retry loading the market.')
      }
      Object.assign(state, {
        name, symbol, communityTokenPrice, activationPrice, minimumWeight, nativePrice,
        maxSupply, totalSupply, referralBps: Number(referralBps), totalWeight,
        totalActiveIndexWeight, queuedRewards, remainingPaidMints, communitySymbol,
        communityDecimals: Number(communityDecimals), miningSymbol, miningDecimals: Number(miningDecimals),
        indexSymbol, indexDecimals: Number(indexDecimals),
        ammActive, inventoryCount, oldestTokenId, tokensPerNft, normalFeeBps: Number(normalFeeBps),
        specificFeeBps: Number(specificFeeBps), normalFee, specificFee, platformFee, nativeValue,
        currentBlock,
      })
      ready.value = true
      loading.value = false
      // An optional reward API must not hold prices/preview behind its timeout.
      void safe(getNutboxNftRewardSummary(poolAddress), null).then(rewardSummary => {
        if (!isCurrent() || !rewardSummary) return
        Object.assign(state, {
          injectedRewards24h: toBigInt(rewardSummary.injectedAmount),
          distributedRewards24h: toBigInt(rewardSummary.distributedAmount),
          burnedMiningTotal: toBigInt(rewardSummary.totalBurnedMiningAmount),
          rewardSummaryAvailable: true,
        })
      })

      if (requestPool.nutboxRouter) {
        const routerAddress = normalizeAddress(requestPool.nutboxRouter)
        // APR conversion quotes are optional and must not delay NFT artwork.
        void Promise.all([
          safe(readNutboxContract<bigint>(routerAddress, nutboxRouterAbi, 'quoteNative', [indexToken, 10n ** BigInt(Number(indexDecimals))]), 0n),
          safe(readNutboxContract<bigint>(routerAddress, nutboxRouterAbi, 'quoteNative', [miningToken, 10n ** BigInt(Number(miningDecimals))]), 0n),
        ]).then(([indexNativeQuote, miningNativeQuote]) => {
          if (isCurrent()) Object.assign(state, { indexNativeQuote, miningNativeQuote })
        })
      } else {
        Object.assign(state, { indexNativeQuote: 0n, miningNativeQuote: 0n })
      }

      const count = Math.min(Number(levelCount), 16)
      const levelRules = await Promise.all(Array.from({ length: count }, async (_, index) => ({
        level: index + 1,
        threshold: await safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'levelThresholds', [BigInt(index)]), toBigInt(requestPool.levelThresholds?.[index])),
        weight: await safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'levelWeights', [BigInt(index)]), toBigInt(requestPool.levelWeights?.[index])),
      })))
      if (!isCurrent()) return
      state.levelRules = levelRules

      const nextTokenId = totalSupply + 1n
      if (rendererAddress !== zeroAddress && nextTokenId !== previewTokenId) {
        previewTokenId = nextTokenId
        try {
          const svg = await readNutboxContract<string>(
            rendererAddress,
            indexBrokerNftRendererAbi,
            'renderSVG',
            [{
              collectionName: name,
              tokenId: nextTokenId,
              seed: previewSeed,
              referralCount: 0n,
              referrerTokenId: 0n,
              miningWeight: state.levelRules[0]?.weight || 0n,
              indexMiningWeight: 0n,
              indexMiningTokenUnit: minimumWeight,
              level: 1,
              miningActive: true,
              indexMiningActive: false,
            }],
          )
          if (!isCurrent()) return
          mintPreviewImage.value = svgDataUrl(svg)
        } catch {
          previewTokenId = 0n
          // Keep an existing preview during a transient RPC outage.
        }
      }

      if (account.value) {
        const [ids, whitelist, communityBalance, miningBalance, mintAllowance, ammAllowance,
          miningAllowance, pendingCommunityRewards, poolOperationFee] = await Promise.all([
          safe(readNutboxContract<bigint[]>(poolAddress, indexBrokerNftAbi, 'tokensOfOwner', [account.value, 0n, 100n]), []),
          safe(readNutboxContract<bigint>(poolAddress, indexBrokerNftAbi, 'remainingWhitelistMints', [account.value]), 0n),
          safe(readNutboxContract<bigint>(communityToken, erc20NutboxAbi, 'balanceOf', [account.value]), 0n),
          safe(readNutboxContract<bigint>(miningToken, erc20NutboxAbi, 'balanceOf', [account.value]), 0n),
          safe(readNutboxContract<bigint>(communityToken, erc20NutboxAbi, 'allowance', [account.value, poolAddress]), 0n),
          safe(readNutboxContract<bigint>(communityToken, erc20NutboxAbi, 'allowance', [account.value, ammAddress]), 0n),
          safe(readNutboxContract<bigint>(miningToken, erc20NutboxAbi, 'allowance', [account.value, poolAddress]), 0n),
          safe(readNutboxContract<bigint>(normalizeAddress(requestPool.community), nutboxCommunityAbi, 'getPoolPendingRewards', [poolAddress, account.value]), 0n),
          committee ? safe(readNutboxContract<bigint>(committee, nutboxCommitteeAbi, 'getPoolOperationFee'), 0n) : 0n,
        ])
        if (!isCurrent()) return
        Object.assign(state, { whitelistRemaining: whitelist, communityBalance, miningBalance, mintAllowance, ammAllowance, miningAllowance, pendingCommunityRewards, poolOperationFee })
        const owned = (await Promise.all(ids.map(nftInfo))).filter(Boolean) as NutboxNftInfo[]
        if (!isCurrent()) return
        ownedNfts.value = owned
      } else {
        ownedNfts.value = []
      }

      const inventoryIds: bigint[] = []
      let cursor = oldestTokenId
      for (let index = 0; index < Math.min(Number(inventoryCount), 24) && cursor > 0n; index += 1) {
        inventoryIds.push(cursor)
        cursor = await safe(readNutboxContract<bigint>(ammAddress, indexBrokerNftAmmAbi, 'nextInventoryToken', [cursor]), 0n)
      }
      const items = (await Promise.all(inventoryIds.map(nftInfo))).filter(Boolean) as NutboxNftInfo[]
      if (!isCurrent()) return
      inventory.value = items
    } catch (reason: any) {
      if (isCurrent()) error.value = reason?.shortMessage || reason?.message || 'Failed to load NFT data'
    } finally {
      if (isCurrent()) {
        loadedPoolAddress = requestPoolAddress
        loading.value = false
      }
    }
  }

  const load = (): Promise<void> => {
    if (pendingLoad) return pendingLoad
    pendingLoad = loadOnce().finally(() => { pendingLoad = undefined })
    return pendingLoad
  }

  const execute = async (key: string, fn: () => Promise<unknown>) => {
    action.value = key
    try {
      const result = await fn()
      // A read started before the transaction must not stand in for a refresh
      // of its confirmed result.
      await pendingLoad
      await load()
      return result
    } finally {
      action.value = ''
    }
  }

  const approveErc20 = (token: Address, spender: Address, amount: bigint, key = 'approve') =>
    execute(key, () => writeNutboxContract(normalizeAddress(token), erc20NutboxAbi, 'approve', [normalizeAddress(spender), amount]))
  const mint = (referrerTokenId = 0n) => execute('mint', async () => {
    const address = normalizeAddress(pool.value.pool)
    const [whitelist, nativePrice] = await Promise.all([
      readNutboxContract<bigint>(address, indexBrokerNftAbi, 'remainingWhitelistMints', [account.value]),
      readNutboxContract<bigint>(address, indexBrokerNftAbi, 'nativePrice'),
    ])
    const value = whitelist > 0n ? 0n : nativePrice
    return writeNutboxContract(normalizeAddress(pool.value.pool), indexBrokerNftAbi, 'mint', [referrerTokenId], value)
  })
  const reveal = (tokenId: bigint) => execute(`reveal-${tokenId}`, () => writeNutboxContract(normalizeAddress(pool.value.pool), indexBrokerNftAbi, 'reveal', [tokenId]))
  const approveNft = (tokenId: bigint) => execute(`approve-nft-${tokenId}`, () => writeNutboxContract(normalizeAddress(pool.value.pool), indexBrokerNftAbi, 'approve', [normalizeAddress(pool.value.amm), tokenId]))
  const buy = (tokenId?: bigint) => execute(`buy-${tokenId || 'next'}`, async () => writeNutboxContract(
    normalizeAddress(pool.value.amm),
    indexBrokerNftAmmAbi,
    tokenId ? 'buySpecificNFT' : 'buyNextNFT',
    tokenId ? [tokenId] : [],
    withFeeBuffer(await readNutboxContract<bigint>(normalizeAddress(pool.value.amm), indexBrokerNftAmmAbi,
      tokenId ? 'quoteSpecificNativeFee' : 'quoteNormalNativeFee')),
  ))
  const sell = (tokenId: bigint) => execute(`sell-${tokenId}`, async () => writeNutboxContract(
    normalizeAddress(pool.value.amm), indexBrokerNftAmmAbi, 'sellNFT', [tokenId],
    withFeeBuffer(await readNutboxContract<bigint>(normalizeAddress(pool.value.amm), indexBrokerNftAmmAbi, 'quoteNormalNativeFee')),
  ))
  const miningAction = (functionName: string, tokenId: bigint, amount?: bigint) => execute(
    `${functionName}-${tokenId}`,
    () => writeNutboxContract(normalizeAddress(pool.value.pool), indexBrokerNftAbi, functionName, amount === undefined ? [tokenId] : [tokenId, amount]),
  )
  const claimCommunityRewards = () => execute('community-rewards', () => writeNutboxContract(
    normalizeAddress(pool.value.community), nutboxCommunityAbi, 'withdrawPoolsRewards', [[normalizeAddress(pool.value.pool)]], state.poolOperationFee,
  ))

  watch([() => pool.value?.pool, account, () => useChainStore().activeChainId], async () => {
    await pendingLoad
    if (!disposed) await load()
  })
  onMounted(() => {
    load()
    refreshTimer = window.setInterval(() => {
      if (!document.hidden && !action.value) void load()
    }, 30_000)
  })
  onBeforeUnmount(() => {
    disposed = true
    if (refreshTimer) window.clearInterval(refreshTimer)
  })

  return {
    state, loading, ready, error, action, account, connected, ownedNfts, inventory, mintPreviewImage, load,
    approveErc20, mint, reveal, approveNft, buy, sell, miningAction, claimCommunityRewards,
  }
}

export type NutboxNftPoolModel = ReturnType<typeof useNutboxNftPool>
