import i18n, { SUPPORTED_LOCALES } from '@/lang'
import { WC_TEAMS } from '@/data/world-cup-2026/teams'
import { getTeamFlagUrl } from '@/data/world-cup-2026/flags'
import { getOutcomeList } from '@/composables/useEventMarketOutcomes'
import type { EventPredictData } from '@/types'

/**
 * 世界杯市场识别：链上/库里没有 fixture 字段，只能靠 outcome 文案反推。
 * 创建时 label 由 worldCup2026.outcome.* 模板生成（创建者语言），
 * 这里用全部 7 语模板 × 48 队预生成反查表，识别与语言无关。
 */
let winLabelToCode: Map<string, string> | null = null
let drawLabels: Set<string> | null = null

const ensureLabelMaps = () => {
  if (winLabelToCode && drawLabels) return
  winLabelToCode = new Map()
  drawLabels = new Set()
  const t = i18n.global.t as (key: string, named?: Record<string, unknown>, options?: { locale: string }) => string
  for (const { code: locale } of SUPPORTED_LOCALES) {
    drawLabels.add(t('worldCup2026.outcome.draw', {}, { locale }).trim())
    for (const team of WC_TEAMS) {
      const name = t(`worldCup2026.teams.${team.code}`, {}, { locale })
      winLabelToCode.set(t('worldCup2026.outcome.win', { team: name }, { locale }).trim(), team.code)
    }
  }
}

/** "{队名}胜" 类 label → FIFA 三字母代码；非世界杯胜负 label 返回 null */
export const getOutcomeTeamCode = (label?: string | null): string | null => {
  if (!label) return null
  ensureLabelMaps()
  return winLabelToCode!.get(label.trim()) ?? null
}

/** outcome label 对应的国旗 URL；非球队 outcome（如"平局"）返回空串 */
export const getOutcomeFlagUrl = (label?: string | null, width = 40): string => {
  const code = getOutcomeTeamCode(label)
  return code ? getTeamFlagUrl(code, width) : ''
}

/** 三元 [左胜, 平, 右胜] 且两个胜负 label 均能反查到球队 → 世界杯小组赛市场 */
export const isWorldCupMarket = (market: EventPredictData): boolean => {
  if (market.factoryVersion !== 2) return false
  const outcomes = getOutcomeList(market)
  if (outcomes.length !== 3) return false
  ensureLabelMaps()
  return getOutcomeTeamCode(outcomes[0].label) != null
    && drawLabels!.has((outcomes[1].label ?? '').trim())
    && getOutcomeTeamCode(outcomes[2].label) != null
}
