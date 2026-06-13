/** OSS 缩略图宽度，与详情页保持一致 */
export const COMMUNITY_LOGO_OSS_WIDTH = 200

/** 社区 logo URL，tiptag OSS 图片统一加 resize 参数 */
export function getCommunityLogoUrl(logo?: string | null, width = COMMUNITY_LOGO_OSS_WIDTH): string {
  if (!logo) return ''
  if (logo.startsWith('https://tiptag')) {
    return `${logo}?x-oss-process=image/resize,w_${width}`
  }
  return logo
}
