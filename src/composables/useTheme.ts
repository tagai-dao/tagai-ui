import { ref } from 'vue'

/**
 * 暗色模式（v3）。在 <html> 上加/去 `dark` 类，CSS token（main.css 的 :root / html.dark）随之翻转。
 * 默认跟随系统 prefers-color-scheme；用户手动切换后记到 localStorage 持久化。
 * 注：暗色按页迁移推进，目前覆盖应用外壳 + 社区详情页，其余页面后续完善。
 */
const STORAGE_KEY = 'tagai-theme'
type ThemeMode = 'dark' | 'light'

const isDark = ref(false)

const apply = (mode: ThemeMode) => {
  isDark.value = mode === 'dark'
  const root = document.documentElement
  if (isDark.value) root.classList.add('dark')
  else root.classList.remove('dark')
}

/** 应用启动时调用一次：读取存储 → 否则跟随系统 */
export const initTheme = () => {
  let mode: ThemeMode
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (stored === 'dark' || stored === 'light') {
      mode = stored
    } else {
      mode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  } catch {
    mode = 'light'
  }
  apply(mode)
}

export const useTheme = () => {
  const setTheme = (mode: ThemeMode) => {
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
    apply(mode)
  }
  const toggleTheme = () => setTheme(isDark.value ? 'light' : 'dark')
  return { isDark, setTheme, toggleTheme }
}
