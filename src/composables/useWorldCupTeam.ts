import { useI18n } from 'vue-i18n'

import { getTeamFlagUrl } from '@/data/world-cup-2026/flags'

/** 世界杯球队/赛果文案 — 队名走 i18n key：worldCup2026.teams.{FIFA_CODE} */
export const useWorldCupTeam = () => {
  const { t } = useI18n()

  const getTeamName = (code: string) => t(`worldCup2026.teams.${code}`)

  const getMatchTitle = (leftCode: string, rightCode: string, round?: string) => {
    const base = t('worldCup2026.matchTitle', {
      left: getTeamName(leftCode),
      right: getTeamName(rightCode),
    })
    if (round) {
      const roundName = t(`worldCup2026.knockout.round.${round}`)
      return `${base} · ${roundName}`
    }
    return base
  }

  /** 淘汰赛：左胜 / 右胜（无平局，复用 outcome.win 保国旗反查） */
  const getOutcomeLabels = (leftCode: string, rightCode: string) => [
    t('worldCup2026.outcome.win', { team: getTeamName(leftCode) }),
    t('worldCup2026.outcome.win', { team: getTeamName(rightCode) }),
  ]

  return { getTeamName, getMatchTitle, getOutcomeLabels, getTeamFlagUrl }
}
