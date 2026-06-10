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

// 四语 SEO 描述（meta description / og:description 随 locale）
const SEO_DESCRIPTION: Record<LocaleCode, string> = {
  en: 'TagAI — social fair launch and trading on BNB Chain. Turn tweets into TagCoins, curate to earn, trade and predict with your community.',
  zh: 'TagAI — BNB Chain 上的社交公平发射与交易平台。推文变代币，策展即收益，与社区一起交易和预测。',
  ko: 'TagAI — BNB Chain 기반 소셜 페어런치 & 트레이딩 플랫폼. 트윗을 TagCoin으로, 큐레이션으로 수익을, 커뮤니티와 함께 거래와 예측을.',
  ja: 'TagAI — BNB Chain上のソーシャルフェアローンチ＆取引プラットフォーム。ツイートをTagCoinに、キュレーションで報酬を、コミュニティと一緒に取引と予測を。',
}

/**
 * 语言切换的副作用统一在这里：持久化、<html lang>、SEO 描述、涨跌色习惯。
 * 东亚（zh/ko/ja）交易习惯为红涨绿跌，欧美为绿涨红跌。
 */
export function applyLocaleSideEffects(code: LocaleCode) {
  localStorage.setItem('language', code)
  document.documentElement.lang = code

  // meta description / og:description 随语言
  const desc = SEO_DESCRIPTION[code]
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    let el = document.querySelector(selector) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      const m = selector.match(/\[(name|property)="([^"]+)"\]/)
      if (m) el.setAttribute(m[1], m[2])
      document.head.appendChild(el)
    }
    el.setAttribute('content', desc)
  }

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
