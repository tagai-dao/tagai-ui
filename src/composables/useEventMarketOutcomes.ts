import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EventPredictData, EventPredictOutcome } from '@/types'

/** K 线 / outcome 按钮配色 */
export const OUTCOME_CHART_COLORS = ['#EF5350', '#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']

export const isMultiOutcomeMarket = (market?: EventPredictData | null) => {
  if (!market) return false
  if (Number(market.factoryVersion ?? 1) >= 2) {
    return (market.outcomeCount ?? market.outcomes?.length ?? 0) > 2
  }
  return false
}

/** outcome 数量超过此阈值时启用折叠/列表式展示（冠军市场 32 触发） */
export const MANY_OUTCOMES_THRESHOLD = 8

export const isManyOutcomeMarket = (market?: EventPredictData | null) => {
  if (!market) return false
  const n = market.outcomeCount ?? market.outcomes?.length ?? 0
  return isMultiOutcomeMarket(market) && n > MANY_OUTCOMES_THRESHOLD
}

/** 归一化 outcome 列表；无 DB 记录时 fallback 为 Yes/No（仅作占位，展示请用 getOutcomeDisplayLabel） */
export const getOutcomeList = (market: EventPredictData): EventPredictOutcome[] => {
  if (market.outcomes?.length) {
    return [...market.outcomes].sort((a, b) => a.outcomeIndex - b.outcomeIndex)
  }
  return [
    { outcomeIndex: 0, label: 'Yes' },
    { outcomeIndex: 1, label: 'No' },
  ]
}

/** API 是否返回了用户自定义的 outcome 文案（V2+ 市场） */
export const hasStoredOutcomeLabels = (market?: EventPredictData | null) =>
  Boolean(market?.outcomes?.length)

/** 市场是否已结束（含投票期结束待结算） */
export const isEventMarketResolved = (market: EventPredictData) =>
  market.status === 3
  || !!market.winner
  || Date.now() >= market.endTime * 1000 + 86400000

/** 按实际投票得票选出 winning outcomeIndex；无票数据时回退 voteYes/voteNo */
export const getWinningOutcomeIndexFromVotes = (market: EventPredictData): number | null => {
  const outcomes = getOutcomeList(market)

  if (hasStoredOutcomeLabels(market) && outcomes.some(o => o.voteTotal != null)) {
    let best = outcomes[0]
    for (const o of outcomes) {
      if ((o.voteTotal ?? 0) > (best.voteTotal ?? 0)) best = o
    }
    return best.outcomeIndex
  }

  if (market.winner === 'yes') return 0
  if (market.winner === 'no') return 1
  const yes = market.voteYes ?? 0
  const no = market.voteNo ?? 0
  if (yes === 0 && no === 0) return null
  return yes >= no ? 0 : 1
}

/** 列表/卡片：已结束市场返回胜方 outcomeIndex */
export const getResolvedWinningOutcomeIndex = (market: EventPredictData): number | null => {
  if (!isEventMarketResolved(market)) return null
  return getWinningOutcomeIndexFromVotes(market)
}

/** 展示用 label：有 DB 文案用用户填写值，旧二元市场用 i18n Yes/No */
export const resolveOutcomeDisplayLabel = (
  market: EventPredictData | null | undefined,
  outcomeIndex: number,
  yesLabel: string,
  noLabel: string,
): string => {
  if (!market) return `#${outcomeIndex + 1}`
  if (hasStoredOutcomeLabels(market)) {
    const label = getOutcomeList(market).find(o => o.outcomeIndex === outcomeIndex)?.label?.trim()
    if (label) return label
  }
  if (outcomeIndex === 0) return yesLabel
  if (outcomeIndex === 1) return noLabel
  return `#${outcomeIndex + 1}`
}

/** 解析 API 返回的 endOutcomePercents（可能是 JSON 字符串） */
export const parseEndOutcomePercents = (raw: unknown): number[] | undefined => {
  if (raw == null) return undefined
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return undefined
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return undefined
  const parsed = arr.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  return parsed.length === arr.length ? parsed : undefined
}

/** 是否应使用 DB 中的 end_time 概率快照（投票期及之后） */
export const shouldUseEndOutcomeSnapshot = (market: EventPredictData) => {
  const percents = parseEndOutcomePercents(market.endOutcomePercents)
  if (!percents?.length) return false
  return market.status >= 2 || Date.now() >= market.endTime * 1000
}

/** 从 market 读取各 outcome 池子储备 */
export const getOutcomeReserves = (market: EventPredictData): number[] => {
  if (market.outcomeReserves?.length) {
    return market.outcomeReserves
  }
  return [market.reserveA ?? 0, market.reserveB ?? 0]
}

/** outcome 数量超过此阈值时用对数域计算，否则用直接乘法（二元/三元/四元更轻量） */
const LOG_CALC_MIN_OUTCOMES = 5

/** 储备抹除 18 位小数精度为整型 token 单位 */
const reservesToIntUnits = (reserves: number[]): number[] =>
  reserves.map((r) => Math.floor(Math.max(0, Number(r) || 0)))

const noLiquidityPercents = (n: number) => Array.from({ length: n }, () => 0)

/** 直接乘法：weight_i = P / r_i，适用于少量 outcome */
const calcOutcomePercentsFromScaledDirect = (scaled: number[]): number[] => {
  let product = 1
  for (const r of scaled) {
    product *= r
  }
  const weights = scaled.map((r) => product / r)
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum <= 0) return noLiquidityPercents(scaled.length)
  return weights.map((w) => w / weightSum)
}

/** 对数域：log(weight_i) = Σ log(r_j) - log(r_i)，归一化用 log-sum-exp */
const calcOutcomePercentsFromScaledLog = (scaled: number[]): number[] => {
  const logReserves = scaled.map((r) => Math.log(r))
  const totalLog = logReserves.reduce((sum, logR) => sum + logR, 0)
  const logWeights = logReserves.map((logR) => totalLog - logR)

  const maxLog = Math.max(...logWeights)
  const expWeights = logWeights.map((logW) => Math.exp(logW - maxLog))
  const sumExp = expWeights.reduce((sum, w) => sum + w, 0)
  if (sumExp <= 0) return noLiquidityPercents(scaled.length)
  return expWeights.map((w) => w / sumExp)
}

const calcOutcomePercentsFromScaled = (scaled: number[]): number[] => {
  const n = scaled.length
  if (n === 0) return []
  if (n === 1) return [1]
  if (scaled.every((r) => r === 0)) return noLiquidityPercents(n)
  if (scaled.some((r) => r <= 0)) return noLiquidityPercents(n)

  return n >= LOG_CALC_MIN_OUTCOMES
    ? calcOutcomePercentsFromScaledLog(scaled)
    : calcOutcomePercentsFromScaledDirect(scaled)
}

/**
 * 按 FPMM 池子储备计算各 outcome 边际概率（0~1）。
 * 不能用 reserve_i / Σreserve：买入 outcome i 会减少 r_i，简单占比会反向变化。
 * 正确公式：p_i = weight_i / Σ weight_k，其中 weight_i = Π_{j≠i} r_j
 * 二元时等价于 p_yes = r_no / (r_yes + r_no)
 */
export const calcOutcomePercents = (reserves: number[]) => {
  const n = reserves.length
  if (n === 0) return [] as number[]
  if (n === 1) return [1]
  return calcOutcomePercentsFromScaled(reservesToIntUnits(reserves))
}

/**
 * 买入 outcome i 后各池储备（与 Gnosis FPMM split + 转出一致；手续费按费率从投资额扣除）。
 * split 使每个 outcome 储备 +investmentMinusFees；买方提走 outcomeTokens。
 */
export const projectPoolAfterBuy = (
  reserves: number[],
  outcomeIndex: number,
  investment: number,
  outcomeTokens: number,
  feeRate: number,
) => {
  const invNet = investment * Math.max(0, 1 - feeRate)
  return reserves.map((r, j) =>
    j === outcomeIndex ? r + invNet - outcomeTokens : r + invNet,
  )
}

/**
 * 卖出 outcome i 后各池储备：卖方 outcome 代币回流池子，merge 从每个 outcome 扣减 returnPlusFees。
 */
export const projectPoolAfterSell = (
  reserves: number[],
  outcomeIndex: number,
  returnAmount: number,
  sharesSold: number,
  feeRate: number,
) => {
  const returnPlusFees = feeRate < 1 ? returnAmount / (1 - feeRate) : returnAmount
  return reserves.map((r, j) =>
    j === outcomeIndex ? r + sharesSold - returnPlusFees : r - returnPlusFees,
  )
}

/**
 * 根据当前池子储备，本地估算卖出 sharesSold 个 outcome 可拿回的最大抵押品。
 * 恒定乘积：∏ r_j 在卖出前后不变（与 projectPoolAfterSell 一致）。
 */
export const calcSellReturnFromReserves = (
  reserves: number[],
  outcomeIndex: number,
  sharesSold: number,
  feeRate: number,
): number => {
  if (sharesSold <= 0 || !reserves.length) return 0

  const product = reserves.reduce((acc, r) => acc * Math.max(r, 0), 1)
  if (product <= 0) return 0

  const fee = Math.max(0, Math.min(feeRate, 1 - 1e-9))
  const toReturnPlusFees = (returnAmt: number) => (fee < 1 ? returnAmt / (1 - fee) : returnAmt)

  const isValidReturn = (returnAmt: number) => {
    if (returnAmt <= 0) return true
    const R = toReturnPlusFees(returnAmt)
    let afterProduct = 1
    for (let j = 0; j < reserves.length; j++) {
      const next = j === outcomeIndex ? reserves[j] + sharesSold - R : reserves[j] - R
      if (next <= 0) return false
      afterProduct *= next
    }
    return afterProduct >= product * (1 - 1e-12)
  }

  const otherReserves = reserves.filter((_, j) => j !== outcomeIndex)
  const minOther = otherReserves.length ? Math.min(...otherReserves) : 0
  let high = Math.min(
    minOther * (1 - fee) * 0.99999,
    (reserves[outcomeIndex] + sharesSold) * (1 - fee) * 0.99999,
  )
  if (high <= 0) return 0
  while (high > 1e-18 && !isValidReturn(high)) high /= 2
  if (high <= 0 || !isValidReturn(high)) return 0

  let low = 0
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2
    if (isValidReturn(mid)) low = mid
    else high = mid
  }
  return low * 0.99999
}

/** 交易前后各 outcome 边际概率（0~1） */
export const calcTradeOutcomePercents = (
  reservesBefore: number[],
  reservesAfter: number[],
) => ({
  before: calcOutcomePercents(reservesBefore),
  after: calcOutcomePercents(reservesAfter),
})

/** 链上 hint 正整数下限 */
const HINT_MIN = 1

/** log 公式初值缩放；仅影响取整粒度，最终由迭代拟合修正 */
const HINT_INITIAL_SCALE = 10_000

/** 拟合目标：边际概率与 UI 目标的最大偏差（0~1 尺度，0.0005 ≈ 0.05%） */
const HINT_FIT_TOLERANCE = 0.0005

/** 拟合边际误差：各 outcome 目标概率与反算边际概率的最大绝对差（0~1 尺度） */
const maxMarginalProbError = (target: number[], marginal: number[]) =>
  Math.max(...target.map((t, i) => Math.abs(marginal[i] - t)))

/**
 * 将 UI 百分比转为 hint 计算用的权重。
 * 合法分布（非负、总和>0）保留真值，0 用极小 ε 避免 log(0)；非法输入回退均分。
 */
const percentsForHintMath = (percents: number[]): number[] => {
  const raw = percents.map(p => Math.max(0, Number(p) || 0))
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0 || !raw.every(p => Number.isFinite(p))) {
    return Array.from({ length: Math.max(percents.length, 1) }, () => 1)
  }
  return raw.map(p => (p > 0 ? p : 1e-8))
}

/** 由归一化概率 p 经 log 域求 FPMM 储备比初值（round + 较大 scale 减少取整误差） */
const hintsFromLogProbabilities = (p: number[], scale: number): number[] => {
  const n = p.length
  const logWeights = p.map((_, i) => {
    let sumLog = 0
    for (let j = 0; j < n; j++) {
      if (j !== i) sumLog += Math.log(Math.max(p[j], 1e-15))
    }
    return sumLog
  })
  const maxLog = Math.max(...logWeights)
  return logWeights.map(logW =>
    Math.max(HINT_MIN, Math.round(Math.exp(logW - maxLog) * scale)),
  )
}

/**
 * 坐标下降微调整数 hint，使 calcOutcomePercents(hint) 逼近目标边际概率。
 * 储备 ∝ hint 时：hint_i↑ → 边际 p_i↓（FPMM 恒定乘积）。
 */
const fitDistributionHints = (target: number[], initial: number[]): number[] => {
  const n = target.length
  if (n <= 1) return initial

  let hint = initial.map(h => Math.max(HINT_MIN, Math.round(h)))
  let bestErr = maxMarginalProbError(target, calcOutcomePercents(hint))

  for (let iter = 0; iter < 400; iter++) {
    const marginal = calcOutcomePercents(hint)
    const err = maxMarginalProbError(target, marginal)
    if (err <= HINT_FIT_TOLERANCE) break

    let improved = false
    for (let i = 0; i < n; i++) {
      const delta = marginal[i] - target[i]
      if (Math.abs(delta) <= HINT_FIT_TOLERANCE) continue

      const dir = delta > 0 ? 1 : -1
      const next = hint[i] + dir
      if (next < HINT_MIN) continue

      const trial = [...hint]
      trial[i] = next
      const trialErr = maxMarginalProbError(target, calcOutcomePercents(trial))
      if (trialErr < err) {
        hint = trial
        bestErr = trialErr
        improved = true
      }
    }
    if (!improved) break
    if (bestErr <= HINT_FIT_TOLERANCE) break
  }

  return hint
}

/**
 * 将 UI 上的目标概率（整数 %，和为 100）转为链上 FPMM distributionHint。
 * 合约按 hint 比例分配初始池子储备；要使边际价格等于目标概率，需 r_i ∝ ∏_{j≠i} p_j。
 * 二元市场与 createMarket 的 [100-p, p] 约定一致。
 * N≥3 时在 log 域求初值，再迭代拟合整数 hint，缩小 32 元市场的创建误差。
 */
export const targetPercentsToDistributionHint = (percents: number[]): number[] => {
  const n = percents.length
  if (n === 0) return []
  if (n === 1) return [100]

  const weights = percentsForHintMath(percents)
  const sum = weights.reduce((a, b) => a + b, 0)
  const p = weights.map(x => x / sum)

  if (n === 2) {
    const initial = [
      Math.max(HINT_MIN, Math.round((1 - p[0]) * 100)),
      Math.max(HINT_MIN, Math.round(p[0] * 100)),
    ]
    return fitDistributionHints(p, initial)
  }

  const initial = hintsFromLogProbabilities(p, HINT_INITIAL_SCALE)
  return fitDistributionHints(p, initial)
}

/** 结算后得票最高的 outcome（用于卡片/详情展示胜方） */
export const getWinningOutcomeIndex = (market: EventPredictData): number | null => {
  if (!isEventMarketResolved(market)) return null
  return getWinningOutcomeIndexFromVotes(market)
}

export const useEventMarketOutcomes = (market: MaybeRefOrGetter<EventPredictData | null | undefined>) => {
  const { t } = useI18n()
  const isMultiOutcome = computed(() => isMultiOutcomeMarket(toValue(market)))
  const hasCustomOutcomeLabels = computed(() => hasStoredOutcomeLabels(toValue(market)))
  const outcomeList = computed(() => {
    const m = toValue(market)
    return m ? getOutcomeList(m) : []
  })
  const outcomePercents = computed(() => {
    const m = toValue(market)
    if (!m) return [] as number[]
    if (shouldUseEndOutcomeSnapshot(m)) {
      return parseEndOutcomePercents(m.endOutcomePercents) ?? []
    }
    const reserves = getOutcomeReserves(m)
    // 多元市场储备未加载时（列表接口只回 reserveA/B），按均匀分布占位，避免缺段与 NaN%
    const n = getOutcomeList(m).length
    if (isMultiOutcomeMarket(m) && reserves.length !== n) {
      return Array.from({ length: n }, () => 1 / n)
    }
    return calcOutcomePercents(reserves)
  })
  const winningOutcomeIndex = computed(() => {
    const m = toValue(market)
    return m ? getWinningOutcomeIndex(m) : null
  })

  const getPercent = (outcomeIndex: number) => outcomePercents.value[outcomeIndex] ?? 0

  const getOutcomeLabel = (outcomeIndex: number) =>
    outcomeList.value.find(o => o.outcomeIndex === outcomeIndex)?.label ?? `#${outcomeIndex + 1}`

  /** 展示文案：自定义 outcome 或 i18n Yes/No */
  const getOutcomeDisplayLabel = (outcomeIndex: number) => {
    const m = toValue(market)
    return resolveOutcomeDisplayLabel(
      m,
      outcomeIndex,
      t('predictTrade.yes'),
      t('predictTrade.no'),
    )
  }

  const getVotePercent = (outcomeIndex: number, legacyYes = 0, legacyNo = 0) => {
    const m = toValue(market)
    if (!m) return 0
    if (hasStoredOutcomeLabels(m) || isMultiOutcomeMarket(m)) {
      const total = outcomeList.value.reduce((sum, o) => sum + (o.voteTotal ?? 0), 0)
      if (total <= 0) return 0
      const outcome = outcomeList.value.find(o => o.outcomeIndex === outcomeIndex)
      return Math.round(((outcome?.voteTotal ?? 0) / total) * 100)
    }
    const total = legacyYes + legacyNo
    if (total <= 0) return 0
    return outcomeIndex === 0
      ? Math.round((legacyYes / total) * 100)
      : Math.round((legacyNo / total) * 100)
  }

  const usesEndSnapshot = computed(() => {
    const m = toValue(market)
    return m ? shouldUseEndOutcomeSnapshot(m) : false
  })

  return {
    isMultiOutcome,
    hasCustomOutcomeLabels,
    outcomeList,
    outcomePercents,
    usesEndSnapshot,
    winningOutcomeIndex,
    getPercent,
    getOutcomeLabel,
    getOutcomeDisplayLabel,
    getVotePercent,
  }
}
