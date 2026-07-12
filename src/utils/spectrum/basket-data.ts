/**
 * Spectrum basket 只读数据层（RH）
 * - factory 枚举发现
 * - 列表轻读 + 详情加深；全部走 multicall，减少 RH 公共 RPC 往返
 * - 短时内存缓存，列表→详情可复用
 */
import { formatUnits, isAddress, type Address, type PublicClient } from 'viem'
import { getReadOnlyClient } from '@/utils/wallets'
import { SPECTRUM_CHAIN_ID, SPECTRUM_USDC_DECIMALS } from '@/config/spectrum'
import { getSpectrumDeployment } from './deployments'
import { basketAbi, erc20Abi, factoryAbi } from './abis'

export type BasketHolding = {
  asset: Address
  symbol: string
  decimals: number
  targetWeightPct: number
  balance: number
  priceUsd: number
  valueUsd: number
  priced: boolean
}

export type BasketSummary = {
  chainId: number
  address: Address
  name: string
  symbol: string
  basketLength: number
  navPerToken: number
  aumUsd: number
  pricedCount: number
  top: { address: Address; symbol: string; weightPct: number }[]
  deployer: Address | null
}

export type BasketDetail = BasketSummary & {
  decimals: number
  totalSupply: number
  effectiveSupply: number | null
  fullyPriced: boolean
  basketFeeBps: number
  creatorShareBps: number
  launcher: Address | null
  holdings: BasketHolding[]
  updatedAt: string
}

export type BasketReadOptions = {
  /** true 时绕过短时缓存 */
  force?: boolean
  /**
   * 列表首屏回调：meta（name/NAV/AUM）就绪即触发，top 可能仍为空。
   * 用于渐进渲染，避免等成分 symbol 才出卡片。
   */
  onShell?: (shell: BasketSummary[]) => void
}

/** Multicall3 标准地址（RH 已部署） */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const
const MULTICALL_BATCH = 80
/** 列表 / 详情短时缓存 TTL（列表可稍长，减重复冷启动） */
const CACHE_TTL_MS = 120_000

type CacheEntry<T> = { at: number; data: T }

let listCache: CacheEntry<BasketSummary[]> | null = null
const detailCache = new Map<string, CacheEntry<BasketDetail>>()

const cacheKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`

const isFresh = (at: number) => Date.now() - at < CACHE_TTL_MS

/** 手动清空（切链 / 交易成功后可调） */
export const invalidateBasketCache = (address?: Address) => {
  if (!address) {
    listCache = null
    detailCache.clear()
    return
  }
  const lower = address.toLowerCase()
  for (const key of detailCache.keys()) {
    if (key.endsWith(`:${lower}`)) detailCache.delete(key)
  }
  listCache = null
}

type MulticallContract = {
  address: Address
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

/** allowFailure:true 时单行结果 */
type MulticallRow =
  | { status: 'success'; result: unknown }
  | { status: 'failure'; error: Error }

/** 分批 multicall，单批失败不拖死整页 */
const multicallBatched = async (
  client: PublicClient,
  contracts: MulticallContract[],
): Promise<MulticallRow[]> => {
  const out: MulticallRow[] = []
  for (let i = 0; i < contracts.length; i += MULTICALL_BATCH) {
    const batch = contracts.slice(i, i + MULTICALL_BATCH)
    const rows = await client.multicall({
      contracts: batch as Parameters<PublicClient['multicall']>[0]['contracts'],
      allowFailure: true,
      multicallAddress: MULTICALL3,
    })
    out.push(...(rows as MulticallRow[]))
  }
  return out
}

const ok = <T>(row: MulticallRow | undefined): T | null => {
  if (!row || row.status !== 'success') return null
  return row.result as T
}

/** basket(i) 返回值：asset / weight(bps) / decimals */
const parseBasketEntry = (raw: unknown) => {
  if (!Array.isArray(raw) || raw.length < 7) return null
  const asset = raw[0]
  if (!isAddress(asset)) return null
  return {
    asset: asset as Address,
    weightBps: Number(raw[5]),
    decimals: Number(raw[6]),
  }
}

const discoverBaskets = async (chainId: number): Promise<Address[]> => {
  const dep = getSpectrumDeployment(chainId)
  if (!dep) return []
  const client = getReadOnlyClient(chainId)
  /** 单次 multicall：length + 前 N 个地址（N 小，避免大量 revert） */
  const DISCOVER_CHUNK = 8
  try {
    const first = await multicallBatched(client, [
      {
        address: dep.factory,
        abi: factoryAbi,
        functionName: 'allBasketsLength',
      },
      ...Array.from({ length: DISCOVER_CHUNK }, (_, i) => ({
        address: dep.factory,
        abi: factoryAbi,
        functionName: 'allBaskets',
        args: [BigInt(i)] as const,
      })),
    ])
    const len = Number(ok<bigint>(first[0]) ?? 0n)
    if (!Number.isFinite(len) || len <= 0) return []

    const pick = (rows: MulticallRow[], offset: number, count: number) =>
      rows
        .slice(offset, offset + count)
        .map((r) => ok<Address>(r))
        .filter((a): a is Address => !!a && isAddress(a))

    let addrs = pick(first, 1, Math.min(len, DISCOVER_CHUNK))
    if (len > DISCOVER_CHUNK) {
      const rest = await multicallBatched(
        client,
        Array.from({ length: len - DISCOVER_CHUNK }, (_, i) => ({
          address: dep.factory,
          abi: factoryAbi,
          functionName: 'allBaskets',
          args: [BigInt(i + DISCOVER_CHUNK)] as const,
        })),
      )
      addrs = addrs.concat(pick(rest, 0, rest.length))
    }
    return addrs
  } catch (e) {
    console.warn('[spectrum] discoverBaskets failed', e)
    return []
  }
}

/** 批量读 ERC20 symbol */
const readSymbols = async (
  client: PublicClient,
  assets: Address[],
  usdc: Address,
  usdcSymbol: string,
): Promise<Map<string, string>> => {
  const map = new Map<string, string>()
  const usdcLower = usdc.toLowerCase()
  const unique = Array.from(new Set(assets.map((a) => a.toLowerCase())))
    .filter((a) => isAddress(a))
    .map((a) => a as Address)

  const needRpc = unique.filter((a) => {
    if (a.toLowerCase() === usdcLower) {
      map.set(a.toLowerCase(), usdcSymbol)
      return false
    }
    return true
  })

  if (needRpc.length === 0) return map

  const rows = await multicallBatched(
    client,
    needRpc.map((a) => ({
      address: a,
      abi: erc20Abi,
      functionName: 'symbol',
    })),
  )
  needRpc.forEach((a, i) => {
    const s = ok<string>(rows[i])
    map.set(a.toLowerCase(), typeof s === 'string' ? s.slice(0, 24) : '?')
  })
  return map
}

/**
 * 列表轻读：先出 name/NAV/AUM（onShell），再后台补成分 top。
 * 不拉 quoteLeg / idleHeld / fee（详情页再加深）
 */
export const listBaskets = async (
  chainId: number = SPECTRUM_CHAIN_ID,
  opts: BasketReadOptions = {},
): Promise<BasketSummary[]> => {
  if (!opts.force && listCache && isFresh(listCache.at)) {
    opts.onShell?.(listCache.data)
    return listCache.data
  }

  const dep = getSpectrumDeployment(chainId)
  if (!dep) return []

  const client = getReadOnlyClient(chainId)
  const discovered = await discoverBaskets(chainId)
  const unique = Array.from(new Set(discovered.map((a) => a.toLowerCase())))
    .filter((a) => isAddress(a))
    .map((a) => a as Address)

  if (unique.length === 0) {
    listCache = { at: Date.now(), data: [] }
    opts.onShell?.([])
    return []
  }

  // —— 首屏：只读卡片必需字段（不含 deployer / legs）——
  const META = 5
  const metaContracts: MulticallContract[] = []
  for (const addr of unique) {
    metaContracts.push(
      { address: addr, abi: basketAbi, functionName: 'name' },
      { address: addr, abi: basketAbi, functionName: 'symbol' },
      { address: addr, abi: basketAbi, functionName: 'basketLength' },
      { address: addr, abi: basketAbi, functionName: 'exchangeRate' },
      { address: addr, abi: basketAbi, functionName: 'totalReserve' },
    )
  }
  const metaRows = await multicallBatched(client, metaContracts)

  type Meta = {
    address: Address
    name: string
    symbol: string
    basketLength: number
    navPerToken: number
    aumUsd: number
    fullyPriced: boolean
  }

  const metas: Meta[] = []
  unique.forEach((addr, i) => {
    const base = i * META
    const name = ok<string>(metaRows[base])
    const symbol = ok<string>(metaRows[base + 1])
    if (!name || !symbol) return

    const len = Number(ok<bigint>(metaRows[base + 2]) ?? 0n)
    const rate = ok<readonly [bigint, boolean]>(metaRows[base + 3])
    const reserve = ok<readonly [bigint, boolean]>(metaRows[base + 4])

    let navPerToken = 0
    let fullyPriced = false
    if (rate) {
      const onchainNav = Number(formatUnits(rate[0], 18))
      if (onchainNav > 0) {
        navPerToken = onchainNav
        fullyPriced = rate[1]
      }
    }
    let aumUsd = 0
    if (reserve) {
      const onchainAum = Number(formatUnits(reserve[0], SPECTRUM_USDC_DECIMALS))
      if (onchainAum > 0) aumUsd = onchainAum
    }

    metas.push({
      address: addr,
      name,
      symbol,
      basketLength: Number.isFinite(len) ? len : 0,
      navPerToken,
      aumUsd,
      fullyPriced,
    })
  })

  // 先抛出无 top 的壳，让 UI 立刻出卡片
  const shell: BasketSummary[] = metas
    .map((m) => ({
      chainId,
      address: m.address,
      name: m.name,
      symbol: m.symbol,
      basketLength: m.basketLength,
      navPerToken: m.navPerToken,
      aumUsd: m.aumUsd,
      pricedCount: m.fullyPriced ? m.basketLength : 0,
      top: [],
      deployer: null,
    }))
    .sort((a, b) => b.aumUsd - a.aumUsd)
  opts.onShell?.(shell)

  // —— 后台：成分权重 + symbol ——
  const legContracts: MulticallContract[] = []
  const legIndex: { metaIdx: number; legIdx: number }[] = []
  metas.forEach((m, metaIdx) => {
    for (let legIdx = 0; legIdx < m.basketLength; legIdx++) {
      legIndex.push({ metaIdx, legIdx })
      legContracts.push({
        address: m.address,
        abi: basketAbi,
        functionName: 'basket',
        args: [BigInt(legIdx)],
      })
    }
  })
  const legRows = legContracts.length
    ? await multicallBatched(client, legContracts)
    : []

  const legsByMeta = metas.map(() => [] as { asset: Address; weightBps: number }[])
  legIndex.forEach((ref, i) => {
    const parsed = parseBasketEntry(ok(legRows[i]))
    if (!parsed) return
    legsByMeta[ref.metaIdx].push({
      asset: parsed.asset,
      weightBps: parsed.weightBps,
    })
  })

  const allAssets = legsByMeta.flatMap((legs) => legs.map((l) => l.asset))
  const symbolMap = await readSymbols(client, allAssets, dep.usdc, dep.usdcSymbol)

  const list: BasketSummary[] = metas.map((m, i) => {
    const legs = legsByMeta[i]
    const top = [...legs]
      .sort((a, b) => b.weightBps - a.weightBps)
      .map((l) => ({
        address: l.asset,
        symbol: symbolMap.get(l.asset.toLowerCase()) ?? '?',
        weightPct: l.weightBps / 100,
      }))

    return {
      chainId,
      address: m.address,
      name: m.name,
      symbol: m.symbol,
      basketLength: m.basketLength,
      navPerToken: m.navPerToken,
      aumUsd: m.aumUsd,
      pricedCount: m.fullyPriced ? m.basketLength : 0,
      top,
      deployer: null,
    }
  })

  const sorted = list.sort((a, b) => b.aumUsd - a.aumUsd)
  listCache = { at: Date.now(), data: sorted }
  return sorted
}

/** 读取单个 basket 详情（两阶段 multicall） */
export const getBasketDetail = async (
  address: Address,
  chainId: number = SPECTRUM_CHAIN_ID,
  opts: BasketReadOptions = {},
): Promise<BasketDetail> => {
  const dep = getSpectrumDeployment(chainId)
  if (!dep) throw new Error('Spectrum is not configured on this chain')
  if (!isAddress(address)) throw new Error('Invalid basket address')

  const key = cacheKey(chainId, address)
  if (!opts.force) {
    const hit = detailCache.get(key)
    if (hit && isFresh(hit.at)) return hit.data
  }

  const client = getReadOnlyClient(chainId)
  const usdcLower = dep.usdc.toLowerCase()

  // 波次 1：固定元数据
  const metaRows = await multicallBatched(client, [
    { address, abi: basketAbi, functionName: 'name' },
    { address, abi: basketAbi, functionName: 'symbol' },
    { address, abi: basketAbi, functionName: 'decimals' },
    { address, abi: basketAbi, functionName: 'basketLength' },
    { address: dep.factory, abi: factoryAbi, functionName: 'tokens', args: [address] },
    { address, abi: basketAbi, functionName: 'basketFeeBps' },
    { address, abi: basketAbi, functionName: 'creatorShareBps' },
    { address, abi: basketAbi, functionName: 'launcher' },
    { address, abi: basketAbi, functionName: 'totalSupply' },
    { address, abi: basketAbi, functionName: 'effectiveSupply' },
    { address, abi: basketAbi, functionName: 'exchangeRate' },
    { address, abi: basketAbi, functionName: 'totalReserve' },
  ])

  const name = ok<string>(metaRows[0])
  const symbol = ok<string>(metaRows[1])
  if (!name || !symbol) throw new Error('Failed to read basket metadata')

  const decimals = Number(ok<number>(metaRows[2]) ?? 18)
  const len = Number(ok<bigint>(metaRows[3]) ?? 0n)
  const deployerRaw = ok<Address>(metaRows[4])
  const feeBps = Number(ok<number>(metaRows[5]) ?? 100)
  const creatorShare = Number(ok<number>(metaRows[6]) ?? 0)
  const launcherRaw = ok<Address>(metaRows[7])
  const supplyRaw = ok<bigint>(metaRows[8]) ?? 0n
  const effRaw = ok<bigint>(metaRows[9])
  const exchangeRate = ok<readonly [bigint, boolean]>(metaRows[10])
  const totalReserve = ok<readonly [bigint, boolean]>(metaRows[11])

  // 波次 2：成分 + 定价腿
  const phase2: MulticallContract[] = []
  for (let i = 0; i < len; i++) {
    phase2.push({
      address,
      abi: basketAbi,
      functionName: 'basket',
      args: [BigInt(i)],
    })
  }
  for (let i = 0; i < len; i++) {
    phase2.push({
      address,
      abi: basketAbi,
      functionName: 'quoteLeg',
      args: [BigInt(i)],
    })
  }
  const phase2Rows = len > 0 ? await multicallBatched(client, phase2) : []
  const entryRows = phase2Rows.slice(0, len)
  const quoteRows = phase2Rows.slice(len, len * 2)

  const entries = entryRows.map((r) => parseBasketEntry(ok(r)))
  const assets = entries.map((e) => e?.asset).filter((a): a is Address => !!a)
  const targetBps = entries.map((e) => e?.weightBps ?? 0)
  const assetDecimals = entries.map((e) => e?.decimals ?? 18)

  // 波次 3：symbol + idleHeld
  const phase3: MulticallContract[] = [
    ...assets.map((a) => ({
      address: a,
      abi: erc20Abi,
      functionName: 'symbol',
    })),
    ...assets.map((a) => ({
      address,
      abi: basketAbi,
      functionName: 'idleHeld',
      args: [a] as const,
    })),
  ]
  const phase3Rows = assets.length ? await multicallBatched(client, phase3) : []
  const symbolRows = phase3Rows.slice(0, assets.length)
  const balanceRows = phase3Rows.slice(assets.length)

  // idleHeld 失败时回退 balanceOf（再打一小批）
  const balances: number[] = []
  const needBalanceOf: { idx: number; asset: Address }[] = []
  assets.forEach((a, i) => {
    const raw = ok<bigint>(balanceRows[i])
    if (raw != null) {
      balances[i] = Number(formatUnits(raw, assetDecimals[i]))
    } else {
      balances[i] = 0
      needBalanceOf.push({ idx: i, asset: a })
    }
  })
  if (needBalanceOf.length) {
    const fallback = await multicallBatched(
      client,
      needBalanceOf.map(({ asset }) => ({
        address: asset,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address] as const,
      })),
    )
    needBalanceOf.forEach(({ idx }, j) => {
      const raw = ok<bigint>(fallback[j])
      if (raw != null) balances[idx] = Number(formatUnits(raw, assetDecimals[idx]))
    })
  }

  const holdings: BasketHolding[] = assets.map((a, i) => {
    const low = a.toLowerCase()
    const balance = balances[i] ?? 0
    let priceUsd = 0
    if (low === usdcLower) {
      priceUsd = 1
    } else {
      const q = ok<readonly [bigint, boolean]>(quoteRows[i])
      if (q) {
        const [usdcValue, priced] = q
        const usd = Number(formatUnits(usdcValue, SPECTRUM_USDC_DECIMALS))
        if (priced && balance > 0 && usd > 0) priceUsd = usd / balance
      }
    }
    const sym =
      low === usdcLower
        ? dep.usdcSymbol
        : (() => {
            const s = ok<string>(symbolRows[i])
            return typeof s === 'string' ? s.slice(0, 24) : '?'
          })()

    return {
      asset: a,
      symbol: sym,
      decimals: assetDecimals[i],
      targetWeightPct: targetBps[i] / 100,
      balance,
      priceUsd,
      valueUsd: balance * priceUsd,
      priced: priceUsd > 0,
    }
  })

  const reconAum = holdings.reduce((s, h) => s + h.valueUsd, 0)
  const totalSupply = Number(formatUnits(supplyRaw, decimals))
  const effectiveSupply = effRaw != null ? Number(formatUnits(effRaw, decimals)) : null
  const navDenom = effectiveSupply && effectiveSupply > 0 ? effectiveSupply : totalSupply

  let navPerToken = navDenom > 0 ? reconAum / navDenom : 0
  let aumUsd = reconAum
  let fullyPriced = false
  if (exchangeRate != null) {
    const [rate1e18, priced] = exchangeRate
    const onchainNav = Number(formatUnits(rate1e18, 18))
    if (onchainNav > 0) {
      navPerToken = onchainNav
      fullyPriced = priced
    }
  }
  if (totalReserve != null) {
    const [usdcValue] = totalReserve
    const onchainAum = Number(formatUnits(usdcValue, SPECTRUM_USDC_DECIMALS))
    if (onchainAum > 0) aumUsd = onchainAum
  }

  const top = [...holdings]
    .sort((a, b) => b.targetWeightPct - a.targetWeightPct)
    .map((h) => ({ address: h.asset, symbol: h.symbol, weightPct: h.targetWeightPct }))

  const detail: BasketDetail = {
    chainId,
    address,
    name,
    symbol,
    decimals,
    basketLength: len,
    navPerToken,
    aumUsd,
    pricedCount: holdings.filter((h) => h.priced).length,
    top,
    deployer: deployerRaw && isAddress(deployerRaw) ? deployerRaw : null,
    totalSupply,
    effectiveSupply,
    fullyPriced,
    basketFeeBps: feeBps,
    creatorShareBps: creatorShare,
    launcher: launcherRaw && isAddress(launcherRaw) ? launcherRaw : null,
    holdings,
    updatedAt: new Date().toISOString(),
  }

  detailCache.set(key, { at: Date.now(), data: detail })
  return detail
}

/** 用户持仓份额 */
export const getBasketBalance = async (
  basket: Address,
  account: Address,
  chainId: number = SPECTRUM_CHAIN_ID,
): Promise<bigint> => {
  const client = getReadOnlyClient(chainId)
  return client.readContract({
    address: basket,
    abi: basketAbi,
    functionName: 'balanceOf',
    args: [account],
  })
}

export const getErc20Balance = async (
  token: Address,
  account: Address,
  chainId: number = SPECTRUM_CHAIN_ID,
): Promise<bigint> => {
  const client = getReadOnlyClient(chainId)
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })
}
