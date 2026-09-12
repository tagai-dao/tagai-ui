import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { parseAndroidRelease, UPDATE_CHECK_INTERVAL, UPDATE_SNOOZE } from './androidUpdatePolicy'

let started = false

export async function initAndroidUpdates() {
  if (started || Capacitor.getPlatform() !== 'android') return
  started = true
  const { App } = await import('@capacitor/app')
  const info = await App.getInfo()
  const installed = Number(info.build)
  let busy = false
  let lastCheck = 0
  let snoozedUntil = 0
  let snoozedVersion = 0
  try {
    const saved = JSON.parse(localStorage.getItem('tagai:android-update-snooze') || 'null')
    if (Number.isSafeInteger(saved?.version) && Number.isFinite(saved?.until)) {
      snoozedVersion = saved.version
      snoozedUntil = Math.min(saved.until, Date.now() + UPDATE_SNOOZE)
    }
  } catch { /* Storage is optional. */ }

  const check = async () => {
    if (busy || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return
    busy = true
    lastCheck = Date.now()
    try {
      // Native HTTP bypasses bundled tagai.fun assets and the PWA service worker.
      const response = await CapacitorHttp.get({
        url: `https://tagai.fun/app-updates/android.json?t=${Date.now()}`,
        headers: { 'Cache-Control': 'no-cache' },
        connectTimeout: 8000, readTimeout: 8000, responseType: 'json',
      })
      if (response.status !== 200) return
      const release = parseAndroidRelease(response.data, installed)
      if (!release || (release.versionCode === snoozedVersion && Date.now() < snoozedUntil)) return
      if (!(await App.getState()).isActive) return
      const zh = navigator.language.toLowerCase().startsWith('zh')
      const { ElMessageBox, ElMessage } = await import('element-plus')
      try {
        await ElMessageBox.confirm(
          `${release.notes}\n\n${zh ? '将打开下载页面。下载完成后，请点击 APK 并按系统提示覆盖安装，无需卸载。' : 'Download the APK, then open it and follow Android’s installation prompts. Do not uninstall the existing app.'}`,
          `${zh ? '发现新版本' : 'Update available'} ${release.versionName}`,
          { confirmButtonText: zh ? '下载更新' : 'Download update', cancelButtonText: zh ? '稍后提醒' : 'Later',
            closeOnClickModal: false, dangerouslyUseHTMLString: false,
            customStyle: { maxWidth: 'calc(100vw - 32px)', whiteSpace: 'pre-line' } },
        )
      } catch {
        snoozedVersion = release.versionCode
        snoozedUntil = Date.now() + UPDATE_SNOOZE
        try { localStorage.setItem('tagai:android-update-snooze', JSON.stringify({ version: snoozedVersion, until: snoozedUntil })) } catch { /* optional */ }
        return
      }
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: release.downloadUrl })
      } catch {
        ElMessage.warning(zh ? '无法打开下载页面，请稍后重试。' : 'Unable to open the download. Please try again later.')
      }
    } catch {
      // Offline, malformed manifests, and server failures must not block login/trading.
    } finally { busy = false }
  }
  await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void check() })
  void check()
}
