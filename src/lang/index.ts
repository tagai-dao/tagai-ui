import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ko from './locales/ko.json'
import ja from './locales/ja.json'
import es from './locales/es.json'
import hi from './locales/hi.json'
import id from './locales/id.json'

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

function isSupported(code: string | null | undefined): code is LocaleCode {
  return !!code && SUPPORTED_LOCALES.some(l => l.code === code)
}

/** 首选语言：?lang= 显式指定 > localStorage 记忆 > 浏览器语言 > en */
function detectLocale(): LocaleCode {
  const urlLang = new URLSearchParams(window.location.search).get('lang')
  if (isSupported(urlLang)) return urlLang
  const saved = localStorage.getItem('language')
  if (isSupported(saved)) return saved
  const nav = (navigator.language || '').toLowerCase()
  for (const l of SUPPORTED_LOCALES) {
    if (l.code !== 'en' && nav.startsWith(l.code)) return l.code
  }
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
    es,
    hi,
    id,
  },
  fallbackLocale: 'en'
})

export function getCurrentLocale(): LocaleCode {
  const code = (i18n.global.locale as any).value ?? i18n.global.locale
  return isSupported(code) ? code : 'en'
}

// 各语言 SEO 描述（meta description / og:description 随 locale）
const SEO_DESCRIPTION: Record<LocaleCode, string> = {
  en: 'TagAI — social fair launch and trading on BNB Chain. Turn tweets into TagCoins, curate to earn, trade and predict with your community.',
  zh: 'TagAI — BNB Chain 上的社交公平发射与交易平台。推文变代币，策展即收益，与社区一起交易和预测。',
  ko: 'TagAI — BNB Chain 기반 소셜 페어런치 & 트레이딩 플랫폼. 트윗을 TagCoin으로, 큐레이션으로 수익을, 커뮤니티와 함께 거래와 예측을.',
  ja: 'TagAI — BNB Chain上のソーシャルフェアローンチ＆取引プラットフォーム。ツイートをTagCoinに、キュレーションで報酬を、コミュニティと一緒に取引と予測を。',
  es: 'TagAI — lanzamiento justo social y trading en BNB Chain. Convierte tweets en TagCoins, cura para ganar, opera y predice con tu comunidad.',
  hi: 'TagAI — BNB Chain पर सोशल फेयर लॉन्च और ट्रेडिंग। ट्वीट्स को TagCoins में बदलें, क्यूरेट करके कमाएँ, अपनी कम्युनिटी के साथ ट्रेड और प्रेडिक्ट करें।',
  id: 'TagAI — peluncuran adil sosial dan trading di BNB Chain. Ubah tweet menjadi TagCoin, kurasi untuk dapat reward, trading dan prediksi bersama komunitas.',
}

/**
 * 语言切换的副作用统一在这里：持久化、<html lang>、SEO 描述、hreflang。
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

  // hreflang alternates：?lang= 形式的可索引多语言 URL
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
  const base = `${window.location.origin}${window.location.pathname}`
  for (const l of SUPPORTED_LOCALES) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = l.code
    link.href = `${base}?lang=${l.code}`
    document.head.appendChild(link)
  }
  const xDefault = document.createElement('link')
  xDefault.rel = 'alternate'
  xDefault.hreflang = 'x-default'
  xDefault.href = base
  document.head.appendChild(xDefault)

}

export function setLocale(code: LocaleCode) {
  (i18n.global.locale as any).value = code
  applyLocaleSideEffects(code)
}

// 启动时同步一次（html lang / SEO）
applyLocaleSideEffects(detectLocale())

export default i18n
