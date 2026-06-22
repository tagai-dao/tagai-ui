import { ref, computed } from 'vue'
import { targetPercentsToDistributionHint } from '@/composables/useEventMarketOutcomes'
import { WC_TOP_TEAM_CODES, WC_CHAMPION_TIER_WEIGHTS, getTeamTier } from '@/data/world-cup-2026/top-teams'

/**
 * 世界杯冠军市场逐队赔率编辑器（直接百分比，与小组赛 ratioPercents 同语义）。
 * 前 N-1 队各填一个百分比（0~100），最后一队 = 100 − 前 N-1 队之和（只读），
 * 总和恒为 100。distributionHint 复用 N 元通用换算 targetPercentsToDistributionHint。
 */
export const useChampionOddsEditor = () => {
  const TOTAL = WC_TOP_TEAM_CODES.length
  /** 前 N-1 队可编辑百分比；默认全 0（最后一队 = 100，方便用户逐队设置） */
  const percents = ref<number[]>(
    WC_TOP_TEAM_CODES.slice(0, TOTAL - 1).map(() => 0),
  )

  /** 前 N-1 队百分比之和 */
  const firstSum = computed(() =>
    percents.value.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0),
  )

  /** 最后一队百分比 = 100 − 前 N-1 队之和（可为负，展示时由调用方 clamp；汇总条用 clamp 后值） */
  const lastPercent = computed(() => 100 - firstSum.value)

  /** 全部 N 队百分比（前 N-1 + 最后一队，原始值，可能含超 100/负值） */
  const allPercents = computed(() => [...percents.value, lastPercent.value])

  /** 夹值后的合法百分比：每队 clamp 到 [0, 100]，最后一队 = max(0, 100 − 前 N-1 队夹值后之和) */
  const clampedPercents = computed(() => {
    const clamped = percents.value.map(p => Math.max(0, Math.min(100, Number(p) || 0)))
    const sum = clamped.reduce((a, b) => a + b, 0)
    const last = Math.max(0, 100 - sum)
    return [...clamped, last]
  })

  /** 链上 distributionHint（用夹值后的合法百分比，内部按权重归一化） */
  const distributionHint = computed(() => targetPercentsToDistributionHint(clampedPercents.value))

  /** 设置第 index 队百分比（仅前 N-1 队可设；只存数值，不夹值，避免破坏 input 流） */
  const setPercent = (index: number, raw: number) => {
    if (index < 0 || index >= TOTAL - 1) return
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0) {
      percents.value[index] = 0
      return
    }
    percents.value[index] = v
  }

  /** 均势预设：每队 100/N */
  const equalSplit = () => {
    const each = +(100 / TOTAL).toFixed(2)
    percents.value = WC_TOP_TEAM_CODES.slice(0, TOTAL - 1).map(() => each)
  }

  /** 清零预设：前 N-1 队全 0（最后一队 = 100） */
  const clearAll = () => {
    percents.value = WC_TOP_TEAM_CODES.slice(0, TOTAL - 1).map(() => 0)
  }

  /** Favorites 预设：按档位权重换算成百分比，取前 N-1 队 */
  const applyFavoritesPreset = () => {
    const weights = WC_TOP_TEAM_CODES.map(code => WC_CHAMPION_TIER_WEIGHTS[getTeamTier(code)] ?? 1)
    const sum = weights.reduce((a, b) => a + b, 0)
    const pcts = weights.map(w => +((w / sum) * 100).toFixed(2))
    percents.value = pcts.slice(0, TOTAL - 1)
  }

  /** 合法：每队都是有限数值（夹值由 clampedPercents 保证上链合法，不阻断编辑/提交） */
  const valid = computed(() =>
    percents.value.every(p => Number.isFinite(Number(p)) && Number(p) >= 0),
  )

  return {
    percents,
    lastPercent,
    allPercents,
    distributionHint,
    setPercent,
    equalSplit,
    clearAll,
    applyFavoritesPreset,
    valid,
  }
}
