import { useI18n } from 'vue-i18n'

import { getTeamFlagUrl } from '@/data/world-cup-2026/flags'

/** 世界杯球队/赛果文案 — 队名走 i18n key：worldCup2026.teams.{FIFA_CODE} */
export const useWorldCupTeam = () => {
  const { t } = useI18n()

  const getTeamName = (code: string) => t(`worldCup2026.teams.${code}`)

  const getMatchTitle = (leftCode: string, rightCode: string) =>
    t('worldCup2026.matchTitle', {
      left: getTeamName(leftCode),
      right: getTeamName(rightCode),
    })

  /** 左胜 / 平 / 右胜 */
  const getOutcomeLabels = (leftCode: string, rightCode: string) => [
    t('worldCup2026.outcome.win', { team: getTeamName(leftCode) }),
    t('worldCup2026.outcome.draw'),
    t('worldCup2026.outcome.win', { team: getTeamName(rightCode) }),
  ]

  return { getTeamName, getMatchTitle, getOutcomeLabels, getTeamFlagUrl }
}
