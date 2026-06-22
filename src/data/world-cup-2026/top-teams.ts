import { getTeamByCode, type WcTeam } from './teams'

/**
 * 世界杯冠军市场热门 32 队（FIFA 三字母代码）。
 * 按夺冠实力分四档，热门在前；档位仅用于 Favorites 预设赋初始权重。
 * 全部 code 必须与 teams.ts 的 48 队集合相交（队名走 i18n worldCup2026.teams）。
 */
export const WC_TOP_TEAM_CODES = [
  // 档位 0：争冠热门
  'ARG', 'FRA', 'ESP', 'ENG', 'BRA', 'POR', 'NED', 'GER',
  // 档位 1：有力竞争者
  'BEL', 'URU', 'COL', 'CRO', 'MEX', 'USA', 'ECU', 'MAR',
  // 档位 2：淘汰赛常客
  'JPN', 'KOR', 'SUI', 'SWE', 'NOR', 'AUT', 'SEN', 'CAN',
  // 档位 3：黑马 / 外卡
  'PAR', 'AUS', 'TUR', 'CIV', 'GHA', 'PAN', 'ALG', 'NZL',
] as const

/** 冠军市场 outcome 数量 */
export const WC_CHAMPION_OUTCOME_COUNT = WC_TOP_TEAM_CODES.length

/** 每档队伍数量（用于计算档位索引） */
const TIER_SIZE = 8

/** 档位 → Favorites 预设权重（档 0 最热，权重最高） */
export const WC_CHAMPION_TIER_WEIGHTS = [10, 5, 2, 1] as const

/** 取热门 32 队的 WcTeam 对象（保留档位顺序） */
export const getTopTeams = (): WcTeam[] =>
  WC_TOP_TEAM_CODES
    .map(code => getTeamByCode(code))
    .filter((t): t is WcTeam => !!t)

/** 给定 code 在热门 32 队中的档位索引（0-3）；不在热门清单返回 -1 */
export const getTeamTier = (code: string): number => {
  const idx = WC_TOP_TEAM_CODES.indexOf(code as (typeof WC_TOP_TEAM_CODES)[number])
  if (idx < 0) return -1
  return Math.floor(idx / TIER_SIZE)
}
