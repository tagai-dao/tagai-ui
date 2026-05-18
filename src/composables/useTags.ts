export const tagBgColors = ['#B6EAD3', '#C1C3FF', '#FAEDAA', '#FACCAA', '#FFC1C1', '#FFC3F2', '#BCBEFF', '#9ADBFF']
export const tagTextColors = ['#6D8C7F', '#747599', '#968E66', '#968E66', '#747599', '#747599', '#747599', '#747599']

export const getTagStyle = (index: number) => ({
  backgroundColor: tagBgColors[index % tagBgColors.length],
  color: tagTextColors[index % tagTextColors.length],
})

/** 将 community.tags 等 JSON 字符串解析为标签列表（避免模板内 JSON.parse + any 索引） */
export const parseTagsJson = (tags: string | string[] | null | undefined): string[] => {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === 'string')
  try {
    const parsed: unknown = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}
