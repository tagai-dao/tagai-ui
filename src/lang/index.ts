import { createI18n } from 'vue-i18n'
import en from './en.json'
import zh from './zh.json'

// export type MessageSchema = typeof en

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: localStorage.getItem('language') || 'en',
  messages: {
    en: en,
    cn: zh,
  },
  fallbackLocale: 'en'
})
console.log('i18n', i18n)
export default i18n
