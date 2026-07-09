import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'

export const NATIVE_AUTH_CALLBACK_URL = 'tagai://auth-callback'

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
    const loginUrl = new URL('/login', window.location.origin)
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
