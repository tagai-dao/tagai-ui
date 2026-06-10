/**
 * 全站数字/金额格式化（基于 Intl，为 P1 多语言做准备：locale 参数留位）。
 * 货币符号由 formatter 输出，调用方不要再手工拼 "$"（历史上的 $$ bug 即由此而来）。
 */

const LOCALE = 'en-US'

const usdFull = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const usdCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberCompact = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** 美元金额，完整千分位：$1,169,644.00 → 整数省略小数 */
export function formatUsd(value: number | string | undefined): string {
  const n = Number(value)
  if (!isFinite(n) || n === 0) return '$0.00'
  // 小额代币价格保留有效数字（$0.000042）
  if (Math.abs(n) < 0.01) {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'USD',
      maximumSignificantDigits: 2,
    }).format(n)
  }
  if (Number.isInteger(n)) {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n)
  }
  return usdFull.format(n)
}

/** 美元金额，紧凑缩写：$79.1K / $1.2M（列表、ticker 等窄空间用） */
export function formatUsdCompact(value: number | string | undefined): string {
  const n = Number(value)
  if (!isFinite(n) || n === 0) return '$0'
  if (Math.abs(n) < 1000) return formatUsd(n)
  return usdCompact.format(n)
}

/** 代币数量，紧凑缩写（不带货币符号）：9.4K / 1.2M */
export function formatTokenAmount(value: number | string | undefined): string {
  const n = Number(value)
  if (!isFinite(n) || n === 0) return '0'
  if (Math.abs(n) < 1000) {
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(n)
  }
  return numberCompact.format(n)
}
