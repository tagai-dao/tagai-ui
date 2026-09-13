import type { Router } from 'vue-router'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { nativeOAuthCallbackPath } from './nativeOAuthCallback'
export { NATIVE_OAUTH_REDIRECT_URL } from './nativeOAuthCallback'

export const NATIVE_AUTH_CALLBACK_URL = 'tagai://auth-callback'

export const isNativePlatform = () => Capacitor.isNativePlatform()
const NativeOAuth = registerPlugin<{ prepare(): Promise<void>; cancel(): Promise<void> }>('NativeOAuth')

export async function initNativeApp(router: Router) {
  if (!isNativePlatform()) return

  document.documentElement.classList.add('is-native')

  const [{ App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
  ])

  let handledAuthCallbackUrl: string | undefined

  const handleAuthCallbackUrl = async (url: string, coldStart = false) => {
    const path = nativeOAuthCallbackPath(url)
    if (!path) return
    if (handledAuthCallbackUrl === url) return
    handledAuthCallbackUrl = url

    const { Browser } = await import('@capacitor/browser')
    await Browser.close().catch(() => {})

    // Privy OAuth 必须进入专用 callback 页。旧的 /login 是 TagAI 历史
    // Twitter state 轮询回调，会在看不到 `state` 时立即清空 URL，导致
    // Privy SDK 尚未消费 privy_oauth_* 参数就丢失登录结果。
    if (coldStart) {
      // Install params before the first Privy render, without a second startup.
      await router.replace(path)
    } else {
      window.location.replace(new URL(path, window.location.origin).toString())
    }
  }

  // Capacitor may replay a retained appUrlOpen while getLaunchUrl is pending.
  // Serialize and deduplicate both sources before the first Privy render.
  let starting = true
  let returnWork = Promise.resolve()
  const queueReturn = (url: string, coldStart: boolean) => {
    returnWork = returnWork.then(() => handleAuthCallbackUrl(url, coldStart))
    return returnWork
  }
  await App.addListener('appUrlOpen', ({ url }) => queueReturn(url, starting))

  const launchUrl = await App.getLaunchUrl()
  if (launchUrl?.url) {
    await queueReturn(launchUrl.url, true)
  }
  await returnWork
  starting = false

  await SplashScreen.hide()

  await App.addListener('backButton', async () => {
    if (router.options.history.state.back) {
      router.back()
      return
    }

    await App.minimizeApp()
  })
}

export async function runNativeBrowserOAuth(startOAuth: () => Promise<void>) {
  if (Capacitor.getPlatform() !== 'android') {
    await startOAuth()
    return
  }

  // Location.assign is an own, non-configurable browser property. A prototype
  // monkeypatch cannot intercept it. Intercept the actual WebView navigation
  // natively instead, after Privy stores its PKCE verifier in this WebView.
  await NativeOAuth.prepare()
  try {
    await startOAuth()
  } catch (error) {
    await NativeOAuth.cancel().catch(() => {})
    throw error
  }
}
