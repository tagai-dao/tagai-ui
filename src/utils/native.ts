import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'

export const NATIVE_AUTH_CALLBACK_URL = 'tagai://auth-callback'

export const isNativePlatform = () => Capacitor.isNativePlatform()

export async function initNativeApp(router: Router) {
  if (!isNativePlatform()) return

  document.documentElement.classList.add('is-native')

  const [{ App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
  ])

  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_CALLBACK_URL)) return

    const { Browser } = await import('@capacitor/browser')
    await Browser.close().catch(() => {})

    const callbackUrl = new URL(url)
    const loginUrl = new URL('/login', window.location.origin)
    callbackUrl.searchParams.forEach((value, key) => {
      loginUrl.searchParams.set(key, value)
    })
    loginUrl.hash = callbackUrl.hash

    window.location.assign(loginUrl.toString())
  })

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
