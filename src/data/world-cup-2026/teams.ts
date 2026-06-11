/** 2026 世界杯 48 队静态数据（FIFA 三字母代码；队名见 i18n worldCup2026.teams） */
export type WcTeam = {
  code: string
  group: string
}

export const WC_TEAMS: WcTeam[] = [
  { code: 'MEX', group: 'A' },
  { code: 'RSA', group: 'A' },
  { code: 'KOR', group: 'A' },
  { code: 'CZE', group: 'A' },
  { code: 'CAN', group: 'B' },
  { code: 'BIH', group: 'B' },
  { code: 'QAT', group: 'B' },
  { code: 'SUI', group: 'B' },
  { code: 'BRA', group: 'C' },
  { code: 'MAR', group: 'C' },
  { code: 'HAI', group: 'C' },
  { code: 'SCO', group: 'C' },
  { code: 'USA', group: 'D' },
  { code: 'PAR', group: 'D' },
  { code: 'AUS', group: 'D' },
  { code: 'TUR', group: 'D' },
  { code: 'GER', group: 'E' },
  { code: 'CUW', group: 'E' },
  { code: 'CIV', group: 'E' },
  { code: 'ECU', group: 'E' },
  { code: 'NED', group: 'F' },
  { code: 'JPN', group: 'F' },
  { code: 'SWE', group: 'F' },
  { code: 'TUN', group: 'F' },
  { code: 'BEL', group: 'G' },
  { code: 'EGY', group: 'G' },
  { code: 'IRN', group: 'G' },
  { code: 'NZL', group: 'G' },
  { code: 'ESP', group: 'H' },
  { code: 'CPV', group: 'H' },
  { code: 'KSA', group: 'H' },
  { code: 'URU', group: 'H' },
  { code: 'FRA', group: 'I' },
  { code: 'SEN', group: 'I' },
  { code: 'IRQ', group: 'I' },
  { code: 'NOR', group: 'I' },
  { code: 'ARG', group: 'J' },
  { code: 'ALG', group: 'J' },
  { code: 'AUT', group: 'J' },
  { code: 'JOR', group: 'J' },
  { code: 'POR', group: 'K' },
  { code: 'COD', group: 'K' },
  { code: 'UZB', group: 'K' },
  { code: 'COL', group: 'K' },
  { code: 'ENG', group: 'L' },
  { code: 'CRO', group: 'L' },
  { code: 'GHA', group: 'L' },
  { code: 'PAN', group: 'L' },
]

const teamByCode = new Map(WC_TEAMS.map(t => [t.code, t]))

export const getTeamByCode = (code: string): WcTeam | undefined => teamByCode.get(code)

export const getTeamsByGroup = (group: string): WcTeam[] =>
  WC_TEAMS.filter(t => t.group === group)
