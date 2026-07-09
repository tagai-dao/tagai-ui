import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'

export const isNativePlatform = () => Capacitor.isNativePlatform()

export async function initNativeApp(router: Router) {
  if (!isNativePlatform()) return

  document.documentElement.classList.add('is-native')

  const [{ App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
  ])

  await SplashScreen.hide()

  await App.addListener('backButton', async () => {
    if (router.options.history.state.back) {
      router.back()
      return
    }

    await App.minimizeApp()
  })
}
