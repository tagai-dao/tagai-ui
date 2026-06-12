import dayjs from 'dayjs'
import fixtures from './fixtures.json'
import { getTeamByCode, WC_TEAMS, type WcTeam } from './teams'

export type WcFixture = {
  fixtureId: string
  group: string
  home: string
  away: string
  /** 球场所在地时间，仅数据参考；前端展示请用 kickoffUtc + formatKickoffUtcToLocal */
  kickoffLocal: string
  venue: string
  kickoffUtc: string
}

/** UTC 开球时间 → 用户浏览器本地时区（对手选择器等短格式） */
export const formatKickoffUtcToLocal = (kickoffUtc: string): string => {
  const d = dayjs(kickoffUtc)
  return d.isValid() ? d.format('MM/DD HH:mm') : ''
}

/** UTC 开球时间 → el-date-picker 所需的本地时间字符串 */
export const kickoffUtcToLocalDatePicker = (kickoffUtc: string): string => {
  const d = dayjs(kickoffUtc)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : ''
}

/** 队伍 + 对阵赛程信息，用于右侧 Picker 展示 */
export type WcTeamWithFixture = WcTeam & {
  kickoffUtc: string | null
  kickoffStarted: boolean
}

const WC_FIXTURES = fixtures as WcFixture[]

/** fixtureId = {group}-{code1}-{code2}，两 code 字典序 */
export const buildFixtureId = (group: string, codeA: string, codeB: string): string => {
  const [c1, c2] = [codeA, codeB].sort()
  return `${group}-${c1}-${c2}`
}

/** 无序查找小组赛赛程 */
export const getFixtureByPair = (teamA: string, teamB: string): WcFixture | undefined => {
  const team1 = getTeamByCode(teamA)
  const team2 = getTeamByCode(teamB)
  if (!team1 || !team2 || team1.group !== team2.group || teamA === teamB) return undefined
  const fixtureId = buildFixtureId(team1.group, teamA, teamB)
  return WC_FIXTURES.find(f => f.fixtureId === fixtureId)
}

export const getGroupMates = (teamCode: string): WcTeam[] => {
  const team = getTeamByCode(teamCode)
  if (!team) return []
  return WC_TEAMS.filter(t => t.group === team.group && t.code !== teamCode)
}

/** 获取同组对手，附带与指定队伍的赛程信息及是否已开赛 */
export const getGroupMatesWithFixture = (teamCode: string): WcTeamWithFixture[] => {
  const team = getTeamByCode(teamCode)
  if (!team) return []
  const now = Date.now()
  return WC_TEAMS
    .filter(t => t.group === team.group && t.code !== teamCode)
    .map(t => {
      const fixture = getFixtureByPair(teamCode, t.code)
      const kickoffUtc = fixture?.kickoffUtc ?? null
      const kickoffStarted = kickoffUtc ? new Date(kickoffUtc).getTime() <= now : false
      return { ...t, kickoffUtc, kickoffStarted }
    })
}

export const DEFAULT_WC_DISTRIBUTION_HINT = [34, 33, 33] as const
