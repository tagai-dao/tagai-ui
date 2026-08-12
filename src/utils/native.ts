import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'

export const NATIVE_AUTH_CALLBACK_URL = 'tagai://auth-callback'

/**
 * Privy 的 redirect URL 只接受 http(s)（Dashboard 校验拒绝自定义 scheme），
 * 故 OAuth 回跳先落到这个托管跳板页，由它把参数原样转发到 tagai://auth-callback 唤起 App。
 * 跳板页源码在 public/native-oauth-redirect.html，随 Web 站点部署；域名必须在 Privy Allowed origins 内。
 */
export const NATIVE_OAUTH_REDIRECT_URL = 'https://tagai.fun/native-oauth-redirect.html'

export const isNativePlatform = () => Capacitor.isNativePlatform()

function isNativeAuthCallbackUrl(url: string) {
  try {
    const callbackUrl = new URL(url)
    return callbackUrl.protocol === 'tagai:' && callbackUrl.host === 'auth-callback'
  } catch {
    return false
  }
}

export async function initNativeApp(router: Router) {
  if (!isNativePlatform()) return

  document.documentElement.classList.add('is-native')

  const [{ App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
  ])

  let handledAuthCallbackUrl: string | undefined

  const handleAuthCallbackUrl = async (url: string) => {
    if (!isNativeAuthCallbackUrl(url)) return
    if (handledAuthCallbackUrl === url) return
    handledAuthCallbackUrl = url

    const { Browser } = await import('@capacitor/browser')
    await Browser.close().catch(() => {})

    const callbackUrl = new URL(url)
    // Privy OAuth 必须进入专用 callback 页。旧的 /login 是 TagAI 历史
    // Twitter state 轮询回调，会在看不到 `state` 时立即清空 URL，导致
    // Privy SDK 尚未消费 privy_oauth_* 参数就丢失登录结果。
    const loginUrl = new URL('/callback', window.location.origin)
    callbackUrl.searchParams.forEach((value, key) => {
      loginUrl.searchParams.set(key, value)
    })
    loginUrl.hash = callbackUrl.hash

    window.location.assign(loginUrl.toString())
  }

  await App.addListener('appUrlOpen', async ({ url }) => {
    await handleAuthCallbackUrl(url)
  })

  const launchUrl = await App.getLaunchUrl()
  if (launchUrl?.url) {
    await handleAuthCallbackUrl(launchUrl.url)
  }

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
  if (!isNativePlatform()) {
    await startOAuth()
    return
  }

  const { Browser } = await import('@capacitor/browser')
  const locationPrototype = Object.getPrototypeOf(window.location)
  const originalAssign = locationPrototype.assign

  locationPrototype.assign = function assign(url: string | URL) {
    void Browser.open({
      url: String(url),
      presentationStyle: 'fullscreen',
    })
  }

  try {
    await startOAuth()
  } finally {
    locationPrototype.assign = originalAssign
  }
}
