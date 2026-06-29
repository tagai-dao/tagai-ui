import dayjs from 'dayjs'
import knockoutFixtures from './knockout-fixtures.json'

/** UTC 开球时间 → 用户浏览器本地时区（短格式） */
export const formatKickoffUtcToLocal = (kickoffUtc: string): string => {
  const d = dayjs(kickoffUtc)
  return d.isValid() ? d.format('MM/DD HH:mm') : ''
}

/** UTC 开球时间 → el-date-picker 所需的本地时间字符串 */
export const kickoffUtcToLocalDatePicker = (kickoffUtc: string): string => {
  const d = dayjs(kickoffUtc)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : ''
}

// ===== 淘汰赛（32强→决赛）赛程访问 =====

export type WcKnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | 'F'

export type WcKnockoutFixture = {
  fixtureId: string
  round: WcKnockoutRound
  teamA: string
  teamB: string
  kickoffUtc: string
  venue: string
}

const KNOCKOUT_DATA = knockoutFixtures as {
  rounds: Array<{ round: WcKnockoutRound; fixtures: Array<Omit<WcKnockoutFixture, 'round'>> }>
}

/** 扁平化所有淘汰赛 fixture，注入 round 字段 */
const ALL_KNOCKOUT_FIXTURES: WcKnockoutFixture[] = KNOCKOUT_DATA.rounds.flatMap(r =>
  r.fixtures.map(f => ({ ...f, round: r.round })),
)

/** 按 round 获取淘汰赛对阵列表 */
export const getKnockoutFixturesByRound = (round: WcKnockoutRound): WcKnockoutFixture[] =>
  ALL_KNOCKOUT_FIXTURES.filter(f => f.round === round)

/** 已配置赛程的轮次列表（用于轮次选择器，仅返回有对阵数据的轮次） */
export const getAvailableKnockoutRounds = (): WcKnockoutRound[] =>
  KNOCKOUT_DATA.rounds.filter(r => r.fixtures.length > 0).map(r => r.round)

/** 按 fixtureId 反查淘汰赛对阵（round 由 fixtureId 反查得出） */
export const getKnockoutFixtureById = (fixtureId: string): WcKnockoutFixture | undefined =>
  ALL_KNOCKOUT_FIXTURES.find(f => f.fixtureId === fixtureId)

/** 构造淘汰赛市场 event_tag：2026FWC-KO-{round}-{code1}-{code2}（两 code 字典序，语言无关，用作去重键） */
export const buildKnockoutEventTag = (round: WcKnockoutRound, teamA: string, teamB: string): string => {
  const [c1, c2] = [teamA, teamB].sort()
  return `2026FWC-KO-${round}-${c1}-${c2}`
}
