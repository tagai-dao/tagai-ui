import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ko from './locales/ko.json'
import ja from './locales/ja.json'

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

function isSupported(code: string | null | undefined): code is LocaleCode {
  return !!code && SUPPORTED_LOCALES.some(l => l.code === code)
}

/** 首选语言：localStorage 记忆 > 浏览器语言 > en */
function detectLocale(): LocaleCode {
  const saved = localStorage.getItem('language')
  if (isSupported(saved)) return saved
  const nav = (navigator.language || '').toLowerCase()
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('ko')) return 'ko'
  if (nav.startsWith('ja')) return 'ja'
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  allowComposition: true,
  messages: {
    en,
    zh,
    ko,
    ja,
  },
  fallbackLocale: 'en'
})

export function getCurrentLocale(): LocaleCode {
  const code = (i18n.global.locale as any).value ?? i18n.global.locale
  return isSupported(code) ? code : 'en'
}

/**
 * 语言切换的副作用统一在这里：持久化、<html lang>、涨跌色习惯。
 * 东亚（zh/ko/ja）交易习惯为红涨绿跌，欧美为绿涨红跌。
 */
export function applyLocaleSideEffects(code: LocaleCode) {
  localStorage.setItem('language', code)
  document.documentElement.lang = code
  const redUp = code === 'zh' || code === 'ko' || code === 'ja'
  const root = document.documentElement.style
  root.setProperty('--color-up', redUp ? '#E6374D' : '#16A34A')
  root.setProperty('--color-down', redUp ? '#16A34A' : '#E6374D')
}

export function setLocale(code: LocaleCode) {
  (i18n.global.locale as any).value = code
  applyLocaleSideEffects(code)
}

// 启动时同步一次（html lang / 涨跌色）
applyLocaleSideEffects(detectLocale())

export default i18n
