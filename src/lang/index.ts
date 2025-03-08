import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: localStorage.getItem('language') || 'en',
  allowComposition: true,
  messages: {
    en: en,
    zh: zh,
  },
  fallbackLocale: 'en'
})
export default i18n
