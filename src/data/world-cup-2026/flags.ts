/** FIFA 三字母代码 → flagcdn.com 国家/地区 slug */
const FIFA_TO_FLAG: Record<string, string> = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  SCO: 'gb-sct',
  USA: 'us',
  PAR: 'py',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  CIV: 'ci',
  ECU: 'ec',
  NED: 'nl',
  JPN: 'jp',
  SWE: 'se',
  TUN: 'tn',
  BEL: 'be',
  EGY: 'eg',
  IRN: 'ir',
  NZL: 'nz',
  ESP: 'es',
  CPV: 'cv',
  KSA: 'sa',
  URU: 'uy',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  UZB: 'uz',
  COL: 'co',
  ENG: 'gb-eng',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa',
}

/** flagcdn 仅支持固定宽度档位 */
const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640] as const

const snapFlagWidth = (width: number) =>
  FLAGCDN_WIDTHS.find(w => w >= width) ?? 640

/** 获取球队国旗图片 URL（80px 宽，适合列表与对阵展示） */
export const getTeamFlagUrl = (fifaCode: string, width = 80) => {
  const slug = FIFA_TO_FLAG[fifaCode]
  if (!slug) return ''
  const w = snapFlagWidth(width)
  return `https://flagcdn.com/w${w}/${slug}.png`
}
