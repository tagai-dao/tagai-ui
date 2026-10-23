import { stockCompanyLogo } from './stockArtwork'
import aiTokenLogo from '@/assets/ai-token-logo.png'

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
export function getCommunityLogoUrl(logo?: string | null, width = COMMUNITY_LOGO_OSS_WIDTH, identity?: { chainId: number; token?: string | null }): string {
  // User-provided artwork for the independent BSC .ai token, not the Agent ID
  // namespace or other tokens sharing a symbol. Also repairs an empty API logo.
  if (identity?.chainId === 56 && identity.token?.toLowerCase() === '0x7ffcf7b3b52adcc00c76f50ce2e37bf3c7e215dc') return aiTokenLogo
  const companyLogo = identity && stockCompanyLogo(identity.chainId, identity.token)
  if (companyLogo) return companyLogo
  if (!logo) return ''
  const resolvedLogo = COMMUNITY_LOGO_OVERRIDES[logo] ?? logo
  if (resolvedLogo.startsWith('https://tiptag')) {
    return `${resolvedLogo}?x-oss-process=image/resize,w_${width}`
  }
  return resolvedLogo
}
