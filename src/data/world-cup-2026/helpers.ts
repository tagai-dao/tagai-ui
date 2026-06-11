import fixtures from './fixtures.json'
import { getTeamByCode, WC_TEAMS, type WcTeam } from './teams'

export type WcFixture = {
  fixtureId: string
  group: string
  home: string
  away: string
  kickoffLocal: string
  venue: string
  kickoffUtc: string
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

export const DEFAULT_WC_DISTRIBUTION_HINT = [34, 33, 33] as const
