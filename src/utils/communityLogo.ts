/** OSS 缩略图宽度，与详情页保持一致 */
export const COMMUNITY_LOGO_OSS_WIDTH = 200

/**
 * 已知损坏的历史社区图片替代源。
 * SPCXB 的 OSS 对象不是合法 PNG（文件头为 `?PNG`），使用 GeckoTerminal/CoinGecko
 * 返回的同一代币图片，直到后端 OSS 对象被替换。
 */
const COMMUNITY_LOGO_OVERRIDES: Record<string, string> = {
  'https://tiptag.oss-cn-shenzhen.aliyuncs.com/tagai/community/spcxb.png':
    'https://coin-images.coingecko.com/coins/images/102173888/large/bstocks_spacex.png?1781280362',
}

/** 社区 logo URL，tiptag OSS 图片统一加 resize 参数 */
export function getCommunityLogoUrl(logo?: string | null, width = COMMUNITY_LOGO_OSS_WIDTH): string {
  if (!logo) return ''
  const resolvedLogo = COMMUNITY_LOGO_OVERRIDES[logo] ?? logo
  if (resolvedLogo.startsWith('https://tiptag')) {
    return `${resolvedLogo}?x-oss-process=image/resize,w_${width}`
  }
  return resolvedLogo
}
